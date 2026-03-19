from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import traceback
import os
import io
import re
import requests as req_lib

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE    = MAX_FILE_SIZE_MB * 1024 * 1024
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

SUPPORTED_MIMETYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/html',
}
SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt', '.html'}

ESG_REQUIRED_KEYWORDS = [
    'scope', 'emissions', 'carbon', 'ghg', 'greenhouse', 'sustainability',
    'esg', 'environmental', 'social', 'governance', 'climate', 'renewable',
    'energy', 'waste', 'water', 'biodiversity', 'net zero', 'carbon neutral',
    'tcfd', 'disclosure', 'reporting', 'stakeholder', 'diversity', 'health',
    'safety', 'supply chain', 'circular economy', 'responsible', 'impact',
    'sdg', 'co2', 'methane', 'pollution', 'recycling', 'fugitive',
    'emission', 'sustainability report', 'annual report',
]
ESG_MIN_HITS = 3

ANALYZED: dict[str, dict] = {}

# region agent log
def _dbglog(message: str, data: dict | None = None, runId: str = "pre-fix", hypothesisId: str = "A"):
    """NDJSON debug logger (debug mode)."""
    try:
        import json, time
        payload = {
            "sessionId": "c59668",
            "runId": runId,
            "hypothesisId": hypothesisId,
            "location": "backend/app.py",
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        log_path = os.path.join(root, "debug-c59668.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass
# endregion agent log


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extension(filename: str) -> str:
    return os.path.splitext(filename.lower())[1]


def _friendly_name(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[_\-]+', ' ', name)
    return re.sub(r'\s+', ' ', name).strip()


def _validate_esg_content(text: str) -> tuple[bool, str]:
    lower = text.lower()
    hits  = [kw for kw in ESG_REQUIRED_KEYWORDS if kw in lower]
    if len(hits) < ESG_MIN_HITS:
        return False, (
            f"Only {len(hits)} ESG keyword(s) found "
            f"({', '.join(hits[:3]) if hits else 'none'}). "
            f"At least {ESG_MIN_HITS} required. "
            f"Please upload an ESG or sustainability report."
        )
    return True, f"ESG content confirmed ({len(hits)} keywords matched)."


def _extract_text_from_bytes(file_bytes: bytes, filename: str, mimetype: str = '') -> dict:
    ext = _extension(filename)
    if ext == '.pdf' or 'pdf' in mimetype:
        from pdf_parser import extract_document
        return extract_document(file_bytes)
    if ext in ('.docx', '.doc') or 'wordprocessingml' in mimetype or 'msword' in mimetype:
        return _parse_docx(file_bytes, filename)
    if ext == '.txt' or mimetype == 'text/plain':
        return _parse_text(file_bytes, filename)
    if ext == '.html' or 'html' in mimetype:
        return _parse_html(file_bytes, filename)
    raise ValueError(f"Unsupported file format: {ext or mimetype}")


def _parse_docx(file_bytes: bytes, filename: str) -> dict:
    try:
        import docx as docx_lib
        doc = docx_lib.Document(io.BytesIO(file_bytes))
        full_text = '\n'.join(p.text.strip() for p in doc.paragraphs if p.text.strip())
    except ImportError:
        import zipfile
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
            full_text = ' '.join(re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml))
        except Exception:
            full_text = file_bytes.decode('utf-8', errors='ignore')
    return _wrap_plain_text(full_text, filename)


def _parse_text(file_bytes: bytes, filename: str) -> dict:
    for enc in ('utf-8', 'latin-1', 'cp1252'):
        try:
            return _wrap_plain_text(file_bytes.decode(enc), filename)
        except UnicodeDecodeError:
            pass
    return _wrap_plain_text(file_bytes.decode('utf-8', errors='replace'), filename)


def _parse_html(file_bytes: bytes, filename: str) -> dict:
    from html.parser import HTMLParser
    class _E(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []
            self._skip = False
        def handle_starttag(self, tag, _):
            if tag in ('script', 'style', 'head', 'nav', 'footer'):
                self._skip = True
            if tag in ('p', 'h1', 'h2', 'h3', 'h4', 'li', 'tr', 'div'):
                self.parts.append('\n')
        def handle_endtag(self, tag):
            if tag in ('script', 'style', 'head', 'nav', 'footer'):
                self._skip = False
        def handle_data(self, data):
            if not self._skip and data.strip():
                self.parts.append(data)
    p = _E()
    p.feed(file_bytes.decode('utf-8', errors='replace'))
    return _wrap_plain_text(' '.join(p.parts), filename)


def _wrap_plain_text(full_text: str, filename: str) -> dict:
    from pdf_parser import detect_section
    words      = full_text.split()
    chunk_size = 500
    pseudo_pages = []
    for i in range(0, max(1, len(words)), chunk_size):
        chunk = ' '.join(words[i:i + chunk_size])
        pseudo_pages.append({
            'page':       len(pseudo_pages) + 1,
            'text':       chunk,
            'section':    detect_section(chunk),
            'tables':     [],
            'char_count': len(chunk),
        })
    if not pseudo_pages:
        pseudo_pages = [{'page': 1, 'text': '', 'section': 'general',
                         'tables': [], 'char_count': 0}]
    return {
        'full_text': full_text,
        'pages':     pseudo_pages,
        'tables':    [],
        'metadata': {
            'page_count':  len(pseudo_pages),
            'total_chars': len(full_text),
            'table_count': 0,
            'title':       filename,
            'author':      '',
            'created':     '',
        },
    }


def _run_pipeline(full_text: str, doc: dict, company: str, sector: str, ext: str):
    """Shared analysis pipeline used by /api/analyze."""
    from chunker import semantic_chunk
    chunks = semantic_chunk(doc['pages'], company, sector)

    from vector_store import delete_company, index_chunks
    delete_company(company)
    indexed = index_chunks(chunks)

    from hyperrag import build_hyperrag_graph
    build_hyperrag_graph(chunks, company)

    from esg_metrics import extract_all
    metrics = extract_all(full_text)

    from discourse_graph import build_discourse_graph
    greenwashing = build_discourse_graph(full_text, company)

    from supply_chain import extract_supply_chain
    supply = extract_supply_chain(full_text, company, sector)

    from climate_risk import analyze_climate_risk
    climate = analyze_climate_risk(full_text, sector, metrics)

    from esg_credit import compute_esg_cam, financing_recommendations
    cam       = compute_esg_cam(metrics, greenwashing)
    financing = financing_recommendations(cam, metrics)

    from benchmarking import register_company
    register_company(company, sector, metrics, metrics.get('esg_scores', {}))

    result = {
        'success':        True,
        'esg_validation': True,
        'company':        company,
        'sector':         sector,
        'file_format':    ext,
        'page_count':     doc['metadata']['page_count'],
        'chunk_count':    len(chunks),
        'indexed_count':  indexed,
        'table_count':    doc['metadata']['table_count'],
        'metrics':        metrics,
        'greenwashing':   greenwashing,
        'supply_chain':   supply,
        'climate_risk':   climate,
        'esg_cam':        cam,
        'financing':      financing,
        '_fullText':      full_text[:120000],
    }
    ANALYZED[company] = result
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────────────────
# Error handlers
# ─────────────────────────────────────────────────────────────────────────────
@app.errorhandler(413)
def too_large(_):
    return jsonify({
        'error': f'File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.',
        'max_size_mb': MAX_FILE_SIZE_MB,
    }), 413


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'version': '2.2',
                    'max_file_mb': MAX_FILE_SIZE_MB})


# ─────────────────────────────────────────────────────────────────────────────
# Fetch report from external URL
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/fetch_report')
def fetch_report():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'url parameter required'}), 400
    if not url.startswith(('http://', 'https://')):
        if url.startswith('www.'):
            url = 'https://' + url
        else:
            return jsonify({'error': 'Only http/https URLs are allowed'}), 400

    try:
        headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/pdf,application/octet-stream,*/*',
        }
        r = req_lib.get(url, headers=headers, timeout=45,
                        stream=True, allow_redirects=True)

        if r.status_code == 404:
            return jsonify({'error': 'Report not found (404). The URL may have moved. '
                                     'Download manually and use File Upload instead.'}), 404
        if r.status_code in (401, 403):
            return jsonify({'error': f'Access denied ({r.status_code}). '
                                     'This page requires login. Download manually and use File Upload.'}), 403
        if r.status_code >= 400:
            return jsonify({'error': f'Server returned HTTP {r.status_code}.'}), 502

        content_type  = r.headers.get('Content-Type', '').lower()
        is_pdf        = 'pdf' in content_type or url.lower().split('?')[0].endswith('.pdf')
        is_html       = 'html' in content_type

        # # ── Direct PDF ────────────────────────────────────────────────────────
        # if is_pdf:
        #     chunks, total = [], 0
        #     for chunk in r.iter_content(65536):
        #         total += len(chunk)
        #         if total > MAX_FILE_SIZE:
        #             return jsonify({'error': f'Remote PDF exceeds {MAX_FILE_SIZE_MB} MB.'}), 413
        #         chunks.append(chunk)
        #     file_bytes = b''.join(chunks)
        #     filename   = url.rstrip('/').split('/')[-1].split('?')[0] or 'report.pdf'
        #     return Response(file_bytes, content_type='application/pdf',
        #                     headers={'Content-Disposition': f'attachment; filename="{filename}"',
        #                              'X-Detected-Filename': filename,
        #                              'X-File-Size': str(len(file_bytes))})

        # ── HTML page — scan for embedded PDF link ────────────────────────────
        if is_html:
            html_bytes = b''
            for chunk in r.iter_content(65536):
                html_bytes += chunk
                if len(html_bytes) > 6 * 1024 * 1024:
                    break
            html_text = html_bytes.decode('utf-8', errors='replace')

            # Score every href that looks like a PDF
            ESG_HINTS = ['esg', 'sustainability', 'annual', 'environmental',
                         'climate', 'impact', 'csr', 'responsible', 'tcfd',
                         'disclosure', 'carbon', 'ghg', 'green']
            hrefs = re.findall(r'href=["\']([^"\']+)["\']', html_text, re.I)
            scored = []
            for href in hrefs:
                hl = href.lower()
                if '.pdf' not in hl:
                    continue
                score = sum(1 for h in ESG_HINTS if h in hl)
                if score > 0:
                    scored.append((score, href))

            if scored:
                from urllib.parse import urljoin
                scored.sort(key=lambda x: -x[0])
                pdf_url = urljoin(url, scored[0][1])
                r2 = req_lib.get(pdf_url, headers=headers,
                                 timeout=45, stream=True, allow_redirects=True)
                if r2.status_code == 200:
                    chunks, total = [], 0
                    for chunk in r2.iter_content(65536):
                        total += len(chunk)
                        if total > MAX_FILE_SIZE:
                            return jsonify({'error': f'Remote PDF exceeds {MAX_FILE_SIZE_MB} MB.'}), 413
                        chunks.append(chunk)
                    file_bytes = b''.join(chunks)
                    filename   = pdf_url.rstrip('/').split('/')[-1].split('?')[0] or 'report.pdf'
                    return Response(file_bytes, content_type='application/pdf',
                                    headers={'Content-Disposition': f'attachment; filename="{filename}"',
                                             'X-Detected-Filename': filename,
                                             'X-File-Size': str(len(file_bytes))})

            # No PDF found — return the HTML itself
            from urllib.parse import urlparse
            hostname = urlparse(url).netloc.replace('www.', '')
            filename = hostname + '_page.html'
            return Response(html_bytes, content_type='text/html',
                            headers={'Content-Disposition': f'attachment; filename="{filename}"',
                                     'X-Detected-Filename': filename,
                                     'X-File-Size': str(len(html_bytes))})

        # ── Any other content type ────────────────────────────────────────────
        chunks, total = [], 0
        for chunk in r.iter_content(65536):
            total += len(chunk)
            if total > MAX_FILE_SIZE:
                return jsonify({'error': f'Remote file exceeds {MAX_FILE_SIZE_MB} MB.'}), 413
            chunks.append(chunk)
        file_bytes = b''.join(chunks)
        filename   = url.rstrip('/').split('/')[-1].split('?')[0] or 'report.bin'
        return Response(file_bytes, content_type=content_type,
                        headers={'Content-Disposition': f'attachment; filename="{filename}"',
                                 'X-Detected-Filename': filename,
                                 'X-File-Size': str(len(file_bytes))})

    except req_lib.exceptions.Timeout:
        return jsonify({'error': 'Request timed out (45 s).'}), 504
    except req_lib.exceptions.SSLError:
        return jsonify({'error': 'SSL error. Try http:// instead of https://.'}), 502
    except req_lib.exceptions.ConnectionError as e:
        return jsonify({'error': f'Could not connect: {e}'}), 502
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────────────────────
# Main Analysis Pipeline (manual upload)
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        file    = request.files.get('file')
        company = request.form.get('company', '').strip()
        sector  = request.form.get('sector', 'Other').strip()

        if not file:
            return jsonify({'error': 'No file uploaded'}), 400
        if not company:
            return jsonify({'error': 'Company name required'}), 400

        filename = file.filename or 'upload.pdf'
        mimetype = file.mimetype or ''
        ext      = _extension(filename)

        if ext not in SUPPORTED_EXTENSIONS and mimetype not in SUPPORTED_MIMETYPES:
            return jsonify({
                'error': (f'Unsupported file format "{ext or mimetype}". '
                          f'Accepted formats: {", ".join(SUPPORTED_EXTENSIONS)}')
            }), 415

        file_bytes = file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            return jsonify({
                'error': f'File too large ({len(file_bytes)//1024//1024} MB). Maximum: {MAX_FILE_SIZE_MB} MB.'
            }), 413

        doc       = _extract_text_from_bytes(file_bytes, filename, mimetype)
        full_text = doc['full_text']

        is_esg, reason = _validate_esg_content(full_text)
        if not is_esg:
            return jsonify({
                'error': 'Please upload an ESG Report. ' + reason,
                'esg_validation': False,
                'validation_reason': reason,
            }), 422

        return _run_pipeline(full_text, doc, company, sector, ext)

    except Exception as e:
        traceback.print_exc()
        err_msg = str(e)
        if 'cannot identify image file' in err_msg or 'EOF' in err_msg:
            err_msg = 'The PDF appears to be corrupted or empty. Please try a different file.'
        elif 'password' in err_msg.lower() or 'encrypted' in err_msg.lower():
            err_msg = 'The PDF is password-protected. Please upload an unlocked version.'
        return jsonify({'error': err_msg}), 500


# ─────────────────────────────────────────────────────────────────────────────
# PDF text (for PDF Analyzer page)
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/pdf_text/<company>')
def pdf_text(company):
    try:
        if company not in ANALYZED:
            return jsonify({'error': 'Company not analyzed'}), 404
        return jsonify({'company': company,
                        'text': ANALYZED[company].get('_fullText', '')})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Query Engine
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/query', methods=['POST'])
def query():
    try:
        data     = request.json or {}
        question = data.get('question', '').strip()
        company  = data.get('company') or None
        section  = data.get('section') or None

        if not question:
            return jsonify({'error': 'No question provided'}), 400

        from hyperrag import hyperrag_query
        chunks = hyperrag_query(question, company, k=5)

        if not chunks:
            return jsonify({'answer': 'No relevant information found.',
                            'chunks': [], 'chunk_count': 0})

        answer_parts = [
            f'[{c.get("section","").upper()} | Page {c.get("page","")}]\n{c.get("text","")}'
            for c in chunks
        ]
        return jsonify({'answer': '\n\n---\n\n'.join(answer_parts),
                        'chunks': chunks, 'chunk_count': len(chunks)})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Greenwashing
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/greenwashing/<company>')
def greenwashing(company):
    try:
        from discourse_graph import get_discourse_export
        return jsonify(get_discourse_export(company))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Graphs
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/graph/hyperrag/<company>')
def graph_hyperrag(company):
    try:
        from hyperrag import get_graph_export
        return jsonify(get_graph_export(company))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/graph/discourse/<company>')
def graph_discourse(company):
    try:
        from discourse_graph import get_discourse_export
        d = get_discourse_export(company)
        return jsonify({'nodes': d.get('nodes', []), 'edges': d.get('edges', [])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Supply Chain
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/supply_chain/<company>')
def supply_chain_risk(company):
    try:
        if company in ANALYZED:
            return jsonify(ANALYZED[company].get('supply_chain', {}))
        return jsonify({'error': 'Company not analyzed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Credit Score
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/esg_credit_score/<company>')
def esg_credit_score(company):
    try:
        if company in ANALYZED:
            return jsonify({'esg_cam':   ANALYZED[company].get('esg_cam', {}),
                            'financing': ANALYZED[company].get('financing', [])})
        return jsonify({'error': 'Company not analyzed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/esg_benchmark/<company>')
def esg_benchmark(company):
    try:
        from benchmarking import get_benchmark_comparison
        return jsonify(get_benchmark_comparison(company))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Climate Risk
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/climate_risk/<company>')
def climate_risk_endpoint(company):
    try:
        if company in ANALYZED:
            return jsonify(ANALYZED[company].get('climate_risk', {}))
        return jsonify({'error': 'Company not analyzed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Scenario Simulation
# ─────────────────────────────────────────────────────────────────────────────
VALID_SCENARIOS = {'renewable_transition', 'supply_chain_restructure', 'emissions_reduction', 'all'}


@app.route('/api/sustainability_optimization', methods=['POST'])
def sustainability_optimization():
    try:
        data     = request.json or {}
        company  = (data.get('company') or '').strip()
        scenario = (data.get('scenario') or 'all').strip() or 'all'
        params   = data.get('params') if isinstance(data.get('params'), dict) else {}

        if scenario not in VALID_SCENARIOS:
            scenario = 'all'

        if not company or company not in ANALYZED:
            return jsonify({'error': 'Company not analyzed'}), 404

        from scenario_sim import simulate_scenario
        metrics = ANALYZED[company].get('metrics') or {}
        return jsonify(simulate_scenario(metrics, scenario, params))
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Companies list
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/companies')
def companies():
    return jsonify({
        'companies': list(ANALYZED.keys()),
        'details': {
            k: {'sector':      v.get('sector'),
                'esg_score':   v.get('metrics', {}).get('esg_scores', {}).get('composite'),
                'file_format': v.get('file_format', '.pdf')}
            for k, v in ANALYZED.items()
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
# Audio / Video ESG Analysis (VLM powered)
# ─────────────────────────────────────────────────────────────────────────────
MEDIA_VIDEO_EXT = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
MEDIA_AUDIO_EXT = {'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'}
MEDIA_MAX_MB    = 100


@app.route('/api/analyze_media', methods=['POST'])
def analyze_media_route():
    _dbglog("analyze_media_route:enter", {"has_file": bool(request.files.get("file")), "company": (request.form.get("company") or "")[:80]}, runId="pre-fix", hypothesisId="A")
    try:
        file    = request.files.get('file')
        company = (request.form.get('company') or '').strip()

        if not file or not file.filename:
            return jsonify({'error': 'No file provided'}), 400

        filename = file.filename
        ext      = os.path.splitext(filename.lower())[1]

        if ext not in (MEDIA_VIDEO_EXT | MEDIA_AUDIO_EXT):
            return jsonify({'error': f'Unsupported media format: {ext}. '
                            f'Supported: {sorted(MEDIA_VIDEO_EXT | MEDIA_AUDIO_EXT)}'}), 415

        file_bytes = file.read()
        size_mb    = len(file_bytes) / 1024 / 1024
        if size_mb > MEDIA_MAX_MB:
            return jsonify({'error': f'File too large ({size_mb:.1f} MB). Max: {MEDIA_MAX_MB} MB.'}), 413

        if not company:
            company = os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ').strip()

        from media_analysis import analyze_media
        result = analyze_media(file_bytes, filename, company)
        _dbglog("analyze_media_route:analyzed", {"company": company[:120], "vlm_available": bool((result or {}).get("vlm_available")), "media_type": (result or {}).get("media_type")}, runId="pre-fix", hypothesisId="A")

        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 422

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        _dbglog("analyze_media_route:exception", {"error": str(e)[:500]}, runId="pre-fix", hypothesisId="A")
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5001, use_reloader=False)