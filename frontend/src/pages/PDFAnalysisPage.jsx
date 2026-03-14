import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ZoomIn, ZoomOut, Eye, EyeOff, FileSearch,
  ChevronLeft, ChevronRight, Upload, X, Download, Info
} from 'lucide-react'

// ── colour tokens ─────────────────────────────────────────────────────────────
const HL = {
  supported:   { bg: '#bbf7d0', text: '#064e3b', border: '#34d399', dot: '#2E7D32', label: 'Supported Claim'   },
  unsupported: { bg: '#fecaca', text: '#7f1d1d', border: '#f87171', dot: '#dc2626', label: 'Unsupported Claim' },
  evidence:    { bg: '#bfdbfe', text: '#1e3a8a', border: '#93c5fd', dot: '#2563eb', label: 'Evidence'          },
  vague:       { bg: '#fde68a', text: '#78350f', border: '#fbbf24', dot: '#d97706', label: 'Vague Claim'       },
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Normalise whitespace for comparison */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()

/**
 * Find all non-overlapping positions of `needle` inside `haystack`.
 * Uses a sliding 60-char key so PDF.js re-flow differences don't break matching.
 * Returns [{start, end}]
 */
function findAll(haystack, needle) {
  if (!haystack || !needle) return []
  const n = norm(needle)
  const h = norm(haystack)
  if (n.length < 12) return []

  // Try exact match first (fastest)
  const results = []
  // Use first 60 normalised chars as the key
  const KEY_LEN = Math.min(60, n.length)
  const key = n.slice(0, KEY_LEN)
  let pos = 0
  while (pos < h.length) {
    const idx = h.indexOf(key, pos)
    if (idx < 0) break
    // Try to extend to full needle length
    const end = Math.min(idx + n.length, h.length)
    results.push({ start: idx, end })
    pos = idx + 1
  }
  return results
}

/**
 * Classify each claim as supported/unsupported/vague.
 *
 * Logic (authentic, not stub):
 *  - A claim is SUPPORTED if there exists at least one evidence sentence
 *    whose normalised text shares >= SUPPORT_THRESHOLD words with the claim
 *    AND the evidence does NOT appear in the contradictions list for that claim.
 *  - A claim that only appears in the contradictions list (contradiction.claim ≈ claim)
 *    with no supporting evidence is UNSUPPORTED.
 *  - A claim matching any vague_claims entry is VAGUE.
 *
 * This correctly inverts the old logic which was treating "contradicted" as "supported".
 */
function classifyClaims(claims, evidences, contradictions, vagueRaw) {
  const SUPPORT_THRESHOLD = 3   // shared content words required

  const stopWords = new Set(['the','a','an','is','are','was','were','be','been',
    'to','of','and','in','that','it','its','we','our','has','have','will',
    'this','by','for','with','on','at','as','from','or','but','not','all',
    'their','they','been'])

  const contentWords = (s) =>
    norm(s).toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))

  // Build a set of contradiction claim prefixes so we can match quickly
  const contradictedPrefixes = new Set(
    contradictions.map(c => norm(c.claim || '').slice(0, 55))
  )

  // Build supported evidence set — evidences not listed as contradicting evidence
  const contradictingEvidenceSet = new Set(
    contradictions.map(c => norm(c.evidence || '').slice(0, 55))
  )

  const vagueSet = new Set(vagueRaw.map(v => norm(v).slice(0, 55)))

  return claims.map((claim, _i) => {
    const nc = norm(claim)
    const claimWords = new Set(contentWords(nc))

    // 1. Vague check
    if (vagueSet.has(nc.slice(0, 55))) return 'vague'

    // 2. Is this claim contradicted?
    const isContradicted = contradictedPrefixes.has(nc.slice(0, 55))

    // 3. Does any evidence SUPPORT this claim (without contradicting it)?
    let hasSupport = false
    for (const ev of evidences) {
      const evWords = new Set(contentWords(norm(ev)))
      const shared = [...claimWords].filter(w => evWords.has(w)).length
      if (shared >= SUPPORT_THRESHOLD) {
        // Make sure this evidence is not itself a contradiction for this claim
        const evKey = norm(ev).slice(0, 55)
        if (!contradictingEvidenceSet.has(evKey)) {
          hasSupport = true
          break
        }
      }
    }

    if (hasSupport && !isContradicted) return 'supported'
    return 'unsupported'
  })
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function Ring({ score = 0, size = 88 }) {
  const r      = size * 0.38
  const circ   = 2 * Math.PI * r
  const pct    = Math.min(100, Math.max(0, score))
  const offset = circ - (pct / 100) * circ
  const color  = pct >= 70 ? '#2E7D32' : pct >= 45 ? '#d97706' : '#dc2626'
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.09} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: size * 0.23, fontWeight: 800, color, lineHeight: 1 }}>{pct}</div>
        <div style={{ fontSize: size * 0.115, color: '#9ca3af', marginTop: 1 }}>/100</div>
      </div>
    </div>
  )
}

function Pill({ type }) {
  const h = HL[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
      background: h.bg, color: h.text, border: `1px solid ${h.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: h.dot, flexShrink: 0 }} />
      {h.label}
    </span>
  )
}

function MiniBar({ label, value = 0, color }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
        <span style={{ color: '#374151' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(168,194,167,0.6)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 1.2s ease' }} />
      </div>
    </div>
  )
}

function Chip({ value, label, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '7px 4px', background: '#C8E6C9', borderRadius: 8, border: '1px solid rgba(46,125,50,0.3)' }}>
      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

// ── Build annotated span list from plain text ─────────────────────────────────
function buildSpans(text, annotations) {
  if (!text || !annotations.length) return [{ text, type: 'plain' }]
  const nt = norm(text)

  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  // Merge overlapping
  const merged = []
  for (const ann of sorted) {
    if (!merged.length || ann.start >= merged[merged.length - 1].end) {
      merged.push(ann)
    }
  }

  const spans = []
  let cursor = 0
  for (const ann of merged) {
    if (ann.start > cursor) spans.push({ text: text.slice(cursor, ann.start), type: 'plain' })
    if (ann.end > ann.start) spans.push({ text: text.slice(ann.start, ann.end), type: ann.type, idx: ann.idx, sentence: ann.sentence })
    cursor = ann.end
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), type: 'plain' })
  return spans
}

// ── Detail popover ────────────────────────────────────────────────────────────
function DetailCard({ info, onClose }) {
  if (!info) return null
  const h = HL[info.type] || HL.vague
  return (
    <div style={{
      marginBottom: 12, padding: '10px 13px',
      background: h.bg, border: `1px solid ${h.border}`,
      borderRadius: 8, position: 'relative', fontSize: 12, lineHeight: 1.65, color: h.text,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 6, right: 8, background: 'none', border: 'none',
        cursor: 'pointer', color: h.text, opacity: 0.5, padding: 0,
      }}><X size={13} /></button>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, color: h.dot }}>
        {h.label}
      </div>
      <div>{info.text.slice(0, 280)}{info.text.length > 280 ? '…' : ''}</div>
      {info.linkedEvidence?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: HL.evidence.dot, marginBottom: 4 }}>
            Linked Evidence
          </div>
          {info.linkedEvidence.map((ev, i) => (
            <div key={i} style={{
              padding: '5px 8px', background: HL.evidence.bg,
              border: `1px solid ${HL.evidence.border}`, borderRadius: 6,
              marginBottom: 4, fontSize: 11, color: HL.evidence.text, lineHeight: 1.5,
            }}>
              {ev.slice(0, 200)}{ev.length > 200 ? '…' : ''}
            </div>
          ))}
        </div>
      )}
      {(info.type === 'unsupported' || info.type === 'vague') && (
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
          {info.type === 'vague' ? 'Vague language — no measurable target stated.' : 'No supporting evidence found in this document.'}
        </div>
      )}
    </div>
  )
}

// ── PDF download with highlights (using canvas annotation via PDF.js render) ──
async function downloadHighlightedPdf(pages, annotations, company) {
  // We render each page to canvas with highlights drawn on top, then compile
  // into a multi-page PDF using a simple PDF builder approach.
  // Since we can't use server-side PDF editing here, we export as a
  // multi-page HTML file that prints/saves with highlights preserved.

  const htmlPages = pages.map((pg, pi) => {
    const ann = annotations[pi] || []
    const spans = buildSpans(pg.text, ann)

    const spanHtml = spans.map(sp => {
      if (sp.type === 'plain') {
        return `<span>${escHtml(sp.text)}</span>`
      }
      const h = HL[sp.type] || HL.vague
      return `<mark class="hl-${sp.type}" title="${h.label}" style="background:${h.bg};color:${h.text};border-bottom:2px solid ${h.border};border-radius:3px;padding:1px 2px;">${escHtml(sp.text)}</mark>`
    }).join('')

    return `
      <div class="pdf-page" style="page-break-after:always;background:white;padding:48px 56px;
        max-width:820px;margin:0 auto 40px;box-shadow:0 2px 16px rgba(0,0,0,0.1);border-radius:4px;
        font-family:Georgia,serif;font-size:13.5px;line-height:1.75;color:#1a1a1a;">
        <div style="font-size:10px;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:20px;
          display:flex;justify-content:space-between;">
          <span>${escHtml(company)} — ESG Report (Annotated)</span>
          <span>Page ${pg.pageNum}</span>
        </div>
        <div style="white-space:pre-wrap;">${spanHtml}</div>
      </div>`
  }).join('\n')

  const legend = Object.entries(HL).map(([k, h]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${h.dot};"></span>
      <mark style="background:${h.bg};color:${h.text};border:1px solid ${h.border};border-radius:3px;padding:1px 6px;font-size:11px;">${h.label}</mark>
    </span>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(company)} — ESG Report (Highlighted)</title>
<style>
  body { background:#f3f4f6; margin:0; padding:32px 16px; font-family:Georgia,serif; }
  @media print {
    body { background:white; padding:0; }
    .no-print { display:none !important; }
    .pdf-page { box-shadow:none !important; margin:0 !important; border-radius:0 !important; }
  }
  mark { cursor:pointer; }
</style>
</head>
<body>
  <div class="no-print" style="background:white;border-bottom:2px solid #e5e7eb;padding:14px 24px;
    position:sticky;top:0;z-index:99;display:flex;align-items:center;gap:16px;flex-wrap:wrap;
    font-family:Sora,sans-serif;">
    <strong style="font-size:14px;color:#111827;">${escHtml(company)}</strong>
    <span style="font-size:12px;color:#6b7280;">ESG Report — Annotated Highlights</span>
    <div style="margin-left:auto;display:flex;flex-wrap:wrap;gap:4px;">${legend}</div>
    <button onclick="window.print()" style="padding:6px 16px;background:#2E7D32;color:white;border:none;
      border-radius:6px;cursor:pointer;font-size:12px;font-family:Sora,sans-serif;">⬇ Print / Save as PDF</button>
  </div>
  <div style="max-width:900px;margin:32px auto;">
    ${htmlPages}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${company.replace(/\s+/g,'_')}_ESG_Highlighted.html`
  a.click()
  URL.revokeObjectURL(url)
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

const btnStyle = {
  background: '#C8E6C9', border: '1px solid rgba(46,125,50,0.3)', borderRadius: 6,
  color: '#374151', cursor: 'pointer', padding: '4px 7px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 3, transition: 'all 0.15s', fontSize: 11, fontFamily: 'Sora,sans-serif',
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PDFAnalysisPage({ data, company, pdfFileRef }) {
  const [zoom,          setZoom]          = useState(1.0)
  const [showHL,        setShowHL]        = useState(true)
  const [activeTab,     setActiveTab]     = useState('score')
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [detail,        setDetail]        = useState(null)
  const [pages,         setPages]         = useState([])
  const [pageNum,       setPageNum]       = useState(1)
  const [pdfStatus,     setPdfStatus]     = useState('idle')
  const [pdfError,      setPdfError]      = useState('')
  const [dlStatus,      setDlStatus]      = useState('idle') // idle|working|done
  const fileInputRef = useRef()

  // ── Raw ESG data ────────────────────────────────────────────────────────────
  const gw             = data?.greenwashing  || {}
  const metrics        = data?.metrics       || {}
  const scores         = metrics?.esg_scores || {}
  const cam            = data?.esg_cam       || {}
  const claims         = useMemo(() => gw.claims         || [], [gw])
  const evidences      = useMemo(() => gw.evidences      || [], [gw])
  const contradictions = useMemo(() => gw.contradictions || [], [gw])
  const vagueRaw       = useMemo(() => gw.vague_claims   || [], [gw])
  const riskScore      = gw.risk_score || 0
  const composite      = +(scores.composite || cam.composite_score || 0)

  // ── Classify every claim correctly ─────────────────────────────────────────
  const claimTypes = useMemo(
    () => classifyClaims(claims, evidences, contradictions, vagueRaw),
    [claims, evidences, contradictions, vagueRaw]
  )

  const supportedCount   = useMemo(() => claimTypes.filter(t => t === 'supported').length,   [claimTypes])
  const unsupportedCount = useMemo(() => claimTypes.filter(t => t === 'unsupported').length, [claimTypes])
  const vagueCount       = useMemo(() => claimTypes.filter(t => t === 'vague').length,       [claimTypes])

  // Evidence indices linked to selected claim
  const activeEvidIdxs = useMemo(() => {
    if (selectedClaim === null) return []
    const claim = claims[selectedClaim]
    if (!claim) return []
    return contradictions
      .filter(c => c.claim && norm(c.claim).slice(0,55) === norm(claim).slice(0,55))
      .map(c => evidences.findIndex(e => e && norm(e).slice(0,55) === norm(c.evidence||'').slice(0,55)))
      .filter(i => i >= 0)
  }, [selectedClaim, claims, contradictions, evidences])

  // ── Load PDF via PDF.js ─────────────────────────────────────────────────────
  const loadPdf = async (file) => {
    setPdfStatus('loading'); setPdfError('')
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return }
      const s = document.createElement('script')
      s.src = src; s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
    try {
      const VER = '3.11.174'
      if (!window.pdfjsLib) {
        await loadScript(`https://unpkg.com/pdfjs-dist@${VER}/build/pdf.min.js`)
        let t = 0
        while (!window.pdfjsLib && t++ < 40) await new Promise(r => setTimeout(r, 100))
      }
      if (!window.pdfjsLib) throw new Error('PDF.js did not load from CDN')
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${VER}/build/pdf.worker.min.js`

      const buf  = await file.arrayBuffer()
      const pdf  = await window.pdfjsLib.getDocument({ data: buf }).promise
      const out  = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i)
        const content = await page.getTextContent()
        let text = '', lastY = null
        for (const item of content.items) {
          if (item.str === undefined) continue
          const y = item.transform[5]
          if (lastY !== null && Math.abs(y - lastY) > 5) text += '\n'
          text += item.str + ' '
          lastY = y
        }
        out.push({ pageNum: i, text: text.trim() })
      }
      setPages(out); setPageNum(1); setPdfStatus('ready')
    } catch (err) {
      console.error('PDF.js error:', err)
      setPdfError(err.message)
      if (data?._fullText) {
        // Split _fullText into ~3000 char chunks as pseudo-pages
        const full = data._fullText
        const CHUNK = 3000
        const pseudoPages = []
        for (let i = 0; i < full.length; i += CHUNK) {
          pseudoPages.push({ pageNum: pseudoPages.length + 1, text: full.slice(i, i + CHUNK) })
        }
        setPages(pseudoPages.length ? pseudoPages : [{ pageNum: 1, text: full }])
        setPageNum(1); setPdfStatus('ready')
      } else { setPdfStatus('error') }
    }
  }

  useEffect(() => {
    if (pdfFileRef?.current) loadPdf(pdfFileRef.current)
    else if (data?._fullText) {
      const full = data._fullText
      const CHUNK = 3000
      const pseudoPages = []
      for (let i = 0; i < full.length; i += CHUNK)
        pseudoPages.push({ pageNum: pseudoPages.length + 1, text: full.slice(i, i + CHUNK) })
      setPages(pseudoPages.length ? pseudoPages : [{ pageNum: 1, text: full }])
      setPdfStatus('ready')
    }
  }, [])

  // ── Build annotations for current page ────────────────────────────────────
  const pageText = pages[pageNum - 1]?.text || ''

  const annotations = useMemo(() => {
    if (!showHL || !pageText) return []
    const ann = []
    const used = []
    const overlaps = (s, e) => used.some(([us, ue]) => s < ue && e > us)
    const addSentences = (sentences, typeFn) => {
      sentences.forEach((sent, i) => {
        findAll(pageText, sent).forEach(({ start, end }) => {
          if (!overlaps(start, end)) {
            ann.push({ start, end, type: typeFn(i), idx: i, sentence: sent })
            used.push([start, end])
          }
        })
      })
    }
    // Add in priority order: evidence -> claims -> vague
    addSentences(evidences, (i) =>
      activeEvidIdxs.includes(i) ? 'evidence_active' : 'evidence')
    addSentences(claims, (i) => claimTypes[i] || 'unsupported')
    addSentences(vagueRaw, () => 'vague')
    return ann
  }, [pageText, showHL, claims, evidences, vagueRaw, claimTypes, activeEvidIdxs])

  const spans = useMemo(() => buildSpans(pageText, annotations), [pageText, annotations])

  // Count highlights actually visible on this page
  const pageHL = useMemo(() => ({
    supported:   annotations.filter(a => a.type === 'supported').length,
    unsupported: annotations.filter(a => a.type === 'unsupported').length,
    evidence:    annotations.filter(a => a.type === 'evidence' || a.type === 'evidence_active').length,
    vague:       annotations.filter(a => a.type === 'vague').length,
  }), [annotations])

  const handleSpanClick = (span) => {
    if (span.type === 'plain') { setSelectedClaim(null); setDetail(null); return }
    if (span.type === 'supported' || span.type === 'unsupported') {
      const newIdx = selectedClaim === span.idx ? null : span.idx
      setSelectedClaim(newIdx)
      if (newIdx !== null) {
        const linked = contradictions
          .filter(c => c.claim && norm(c.claim).slice(0,55) === norm(claims[span.idx]||'').slice(0,55))
          .map(c => c.evidence).filter(Boolean)
        setDetail({ type: span.type, text: span.sentence || span.text, linkedEvidence: linked })
        setActiveTab('claims')
      } else setDetail(null)
    } else if (span.type === 'evidence' || span.type === 'evidence_active') {
      setDetail({ type: 'evidence', text: span.sentence || span.text })
      setActiveTab('evidence')
    } else if (span.type === 'vague') {
      setDetail({ type: 'vague', text: span.sentence || span.text })
    }
  }

  const hlStyle = (type) => {
    const t   = type === 'evidence_active' ? 'evidence' : type
    const h   = HL[t] || HL.vague
    const isBright = type === 'evidence_active'
    return {
      background:               isBright ? '#93c5fd' : h.bg,
      color:                    h.text,
      borderRadius:             3,
      padding:                  '1px 2px',
      cursor:                   'pointer',
      borderBottom:             `2px solid ${isBright ? '#1d4ed8' : h.border}`,
      transition:               'filter 0.15s',
      userSelect:               'text',
    }
  }

  // ── Highlighted PDF download ────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!pages.length) return
    setDlStatus('working')
    // Build per-page annotation map
    const perPageAnnotations = pages.map(pg => {
      const ann = [], used = []
      const overlaps = (s, e) => used.some(([us, ue]) => s < ue && e > us)
      const addSentences = (sentences, typeFn) => {
        sentences.forEach((sent, i) => {
          findAll(pg.text, sent).forEach(({ start, end }) => {
            if (!overlaps(start, end)) { ann.push({ start, end, type: typeFn(i), sentence: sent }); used.push([start, end]) }
          })
        })
      }
      addSentences(evidences, () => 'evidence')
      addSentences(claims, (i) => claimTypes[i] || 'unsupported')
      addSentences(vagueRaw, () => 'vague')
      return ann
    })
    await downloadHighlightedPdf(pages, perPageAnnotations, company || 'ESG-Report')
    setDlStatus('done')
    setTimeout(() => setDlStatus('idle'), 3000)
  }

  if (!company) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontFamily: 'Sora,sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <FileSearch size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No report loaded</div>
          <div style={{ fontSize: 13 }}>Upload and analyze a report first.</div>
        </div>
      </div>
    )
  }

  const ratingColor = cam.rating
    ? (['AAA','AA+','AA'].includes(cam.rating) ? '#2E7D32' : ['A+','A'].includes(cam.rating) ? '#2563eb' : '#d97706')
    : '#6b7280'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 96px)', minHeight: 560, fontFamily: 'Sora,sans-serif', background: '#C8E6C9' }}>

      {/* ══════ LEFT — document viewer ══════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', flexWrap: 'wrap',
          background: '#E8F5E9', borderBottom: '1px solid rgba(46,125,50,0.3)', flexShrink: 0,
        }}>
          <FileSearch size={14} style={{ color: '#2E7D32', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{company}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>ESG Report Analyzer</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Object.keys(HL).map(k => <Pill key={k} type={k} />)}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {pages.length > 1 && <>
              <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} style={btnStyle}>
                <ChevronLeft size={12} />
              </button>
              <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono,monospace', color: '#6b7280', minWidth: 52, textAlign: 'center' }}>
                {pageNum} / {pages.length}
              </span>
              <button onClick={() => setPageNum(p => Math.min(pages.length, p + 1))} disabled={pageNum >= pages.length} style={btnStyle}>
                <ChevronRight size={12} />
              </button>
              <div style={{ width: 1, height: 16, background: 'rgba(46,125,50,0.35)' }} />
            </>}
            <button onClick={() => setZoom(z => Math.max(0.7, +(z - 0.1).toFixed(1)))} style={btnStyle}><ZoomOut size={12} /></button>
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#9ca3af', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))} style={btnStyle}><ZoomIn size={12} /></button>
            <button onClick={() => setShowHL(h => !h)} style={{ ...btnStyle, padding: '4px 9px', fontSize: 11 }}>
              {showHL ? <EyeOff size={11} /> : <Eye size={11} />}
              {showHL ? 'Hide highlights' : 'Show highlights'}
            </button>
            <button onClick={handleDownload} disabled={!pages.length || dlStatus === 'working'}
              style={{ ...btnStyle, padding: '4px 10px', fontSize: 11, background: dlStatus === 'done' ? 'rgba(46,125,50,0.15)' : 'rgba(255,255,255,0.5)', color: dlStatus === 'done' ? '#2E7D32' : '#374151' }}>
              <Download size={11} />
              {dlStatus === 'working' ? 'Preparing…' : dlStatus === 'done' ? 'Downloaded!' : 'Download Highlighted'}
            </button>
          </div>
        </div>

        {/* page body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#fff' }}>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && loadPdf(e.target.files[0])} />

          {pdfStatus === 'idle' && (
            <div onClick={() => fileInputRef.current?.click()} style={{
              maxWidth: 700, margin: '60px auto', padding: '48px 36px', textAlign: 'center',
              background: '#E8F5E9', borderRadius: 12, border: '2px dashed rgba(46,125,50,0.4)', cursor: 'pointer',
            }}>
              <Upload size={36} style={{ color: '#d1d5db', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Load PDF to see highlights</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Drop the same PDF here to overlay ESG claim highlights</div>
            </div>
          )}

          {pdfStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: '#9ca3af' }}>
              <div style={{ width: 20, height: 20, border: '3px solid rgba(46,125,50,0.4)', borderTopColor: '#2E7D32', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Extracting text from PDF…
            </div>
          )}

          {pdfStatus === 'error' && (
            <div style={{ maxWidth: 600, margin: '60px auto', padding: 28, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>Could not load PDF</div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 14 }}>{pdfError}</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, padding: '7px 16px', fontSize: 12 }}>
                <Upload size={12} /> Try another file
              </button>
            </div>
          )}

          {pdfStatus === 'ready' && pageText && (
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
              {/* page highlight bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                {Object.entries(pageHL).filter(([,v]) => v > 0).map(([type, count]) => {
                  const t = type === 'evidence' || type === 'evidence_active' ? 'evidence' : type
                  const h = HL[t] || HL.vague
                  return (
                    <span key={type} style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 99, background: h.bg, color: h.text, border: `1px solid ${h.border}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: h.dot }} />
                      {count} {t}
                    </span>
                  )
                })}
                <span style={{ fontSize: 10.5, color: '#9ca3af', marginLeft: 'auto' }}>
                  {Object.values(pageHL).reduce((a, b) => a + b, 0)} highlights on this page
                </span>
              </div>

              {/* detail popover */}
              {detail && <DetailCard info={detail} onClose={() => { setDetail(null); setSelectedClaim(null) }} />}

              {/* document text with highlights */}
              <div style={{
                background: '#fff', borderRadius: 10, padding: '40px 48px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)', lineHeight: 1.85,
                fontSize: `${13 * zoom}px`, color: '#1a1a1a',
                fontFamily: 'Georgia,"Times New Roman",serif',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                minHeight: 480,
              }}>
                {spans.map((sp, i) => {
                  if (sp.type === 'plain') return <span key={i}>{sp.text}</span>
                  const isSelected = (sp.type === 'supported' || sp.type === 'unsupported') && selectedClaim === sp.idx
                  return (
                    <mark
                      key={i}
                      onClick={() => handleSpanClick(sp)}
                      style={{
                        ...hlStyle(sp.type),
                        outline: isSelected ? `2px solid ${HL[sp.type]?.border || '#f59e0b'}` : 'none',
                        outlineOffset: 1,
                        fontWeight: isSelected ? 600 : 'inherit',
                      }}
                      title={HL[sp.type === 'evidence_active' ? 'evidence' : sp.type]?.label || ''}
                    >
                      {sp.text}
                    </mark>
                  )
                })}
              </div>

              {/* load different button */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, padding: '6px 14px', fontSize: 12 }}>
                  <Upload size={12} /> Load different PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════ RIGHT — analysis panel ══════ */}
      <div style={{
        width: 280, flexShrink: 0, borderLeft: '1px solid rgba(46,125,50,0.3)',
        background: '#E8F5E9', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(46,125,50,0.3)', flexShrink: 0 }}>
          {[
            { id: 'score',    label: 'ESG Report' },
            { id: 'claims',   label: `Claims (${claims.length})` },
            { id: 'evidence', label: `Evidence (${evidences.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? '#2E7D32' : '#6b7280',
              borderBottom: activeTab === t.id ? '2px solid #2E7D32' : '2px solid transparent',
              fontFamily: 'Sora,sans-serif', whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </div>

        {/* panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── ESG SCORE TAB ── */}
          {activeTab === 'score' && <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 4 }}>
              <Ring score={composite} size={90} />
              <div style={{ fontSize: 13, fontWeight: 700, color: composite >= 70 ? '#2E7D32' : composite >= 45 ? '#d97706' : '#dc2626', marginTop: 2 }}>
                {composite >= 70 ? 'Strong ESG' : composite >= 45 ? 'Moderate ESG' : 'Weak ESG'}
              </div>
              <div style={{ fontSize: 10.5, color: '#9ca3af' }}>Analyzed across {data?.page_count || pages.length} pages</div>
            </div>

            <div style={{ height: 1, background: 'rgba(168,194,167,0.4)' }} />

            <div>
              <MiniBar label="Environmental" value={scores.environmental || 50} color="#2E7D32" />
              <MiniBar label="Social"        value={scores.social        || 50} color="#2563eb" />
              <MiniBar label="Governance"    value={scores.governance    || 50} color="#7c3aed" />
            </div>

            <div style={{ height: 1, background: 'rgba(168,194,167,0.4)' }} />

            {/* Greenwashing risk */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Greenwashing Risk</span>
                <span style={{ fontSize: 11, fontWeight: 700,
                  color: riskScore >= 60 ? '#dc2626' : riskScore >= 30 ? '#d97706' : '#2E7D32' }}>
                  {gw.risk_level || 'LOW'}
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(168,194,167,0.5)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${riskScore}%`, height: '100%', borderRadius: 99, transition: 'width 1.2s ease',
                  background: riskScore >= 60 ? '#ef4444' : riskScore >= 30 ? '#f59e0b' : '#2E7D32' }} />
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', margin: '10px 0 6px' }}>
                ESG CLAIM SENTENCES
              </div>
              {[
                { label: 'Supported Claims',   count: supportedCount,   dot: HL.supported.dot   },
                { label: 'Unsupported Claims', count: unsupportedCount, dot: HL.unsupported.dot },
                { label: 'Vague Claims',       count: vagueCount,       dot: HL.vague.dot       },
                { label: 'Evidence Sentences', count: evidences.length, dot: HL.evidence.dot    },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#374151' }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: 'JetBrains Mono,monospace' }}>
                    {row.count} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 10.5 }}>sentences</span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <Chip value={supportedCount}   label="Supported"    color="#2E7D32" />
              <Chip value={unsupportedCount} label="Unsupported"  color="#dc2626" />
              <Chip value={vagueCount}       label="Vague"        color="#d97706" />
            </div>

            <div style={{ height: 1, background: 'rgba(168,194,167,0.4)' }} />

            {/* Credit rating */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: 10, background: '#C8E6C9', border: '1px solid rgba(46,125,50,0.3)' }}>
              <div>
                <div style={{ fontSize: 9.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>ESG-CAM Rating</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 26, fontWeight: 900, color: ratingColor }}>
                  {cam.rating || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Outlook</div>
                <div style={{ fontSize: 13, fontWeight: 700,
                  color: cam.outlook === 'Positive' ? '#2E7D32' : cam.outlook === 'Negative' ? '#dc2626' : '#6b7280' }}>
                  {cam.outlook || 'Stable'}
                </div>
              </div>
            </div>

            <div style={{ padding: '9px 11px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.65,
              background: 'rgba(46,125,50,0.1)', border: '1px solid rgba(46,125,50,0.3)', color: '#2E7D32' }}>
              <strong style={{ color: '#2E7D32' }}>How to read:</strong>{' '}
              <mark style={{ background: HL.supported.bg, color: HL.supported.text, padding: '0 3px', borderRadius: 3 }}>Green</mark> = claim backed by evidence.{' '}
              <mark style={{ background: HL.unsupported.bg, color: HL.unsupported.text, padding: '0 3px', borderRadius: 3 }}>Red</mark> = no evidence found.{' '}
              <mark style={{ background: HL.vague.bg, color: HL.vague.text, padding: '0 3px', borderRadius: 3 }}>Yellow</mark> = vague language.{' '}
              Click any highlight to inspect.
            </div>
          </>}

          {/* ── CLAIMS TAB ── */}
          {activeTab === 'claims' && <>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
              Click a claim to see linked evidence. {supportedCount} supported · {unsupportedCount} unsupported · {vagueCount} vague.
            </p>
            {claims.length === 0 && <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', marginTop: 20 }}>No claims detected.</div>}
            {claims.map((c, i) => {
              const type   = claimTypes[i] || 'unsupported'
              const isSel  = selectedClaim === i
              const h      = HL[type] || HL.unsupported
              return (
                <div key={i} onClick={() => {
                  const newIdx = isSel ? null : i
                  setSelectedClaim(newIdx)
                  if (newIdx !== null) {
                    const linked = contradictions
                      .filter(con => con.claim && norm(con.claim).slice(0,55) === norm(c).slice(0,55))
                      .map(con => con.evidence).filter(Boolean)
                    setDetail({ type, text: c, linkedEvidence: linked })
                  } else setDetail(null)
                }} style={{
                  padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                  background: isSel ? h.bg : '#F8FFF8',
                  border: `1px solid ${isSel ? h.border : 'rgba(46,125,50,0.3)'}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: h.dot, flexShrink: 0, marginTop: 4 }} />
                    <span style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.55 }}>
                      {c.slice(0, 120)}{c.length > 120 ? '…' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: h.dot, fontWeight: 700, paddingLeft: 14 }}>
                    {type === 'supported' ? 'Evidence found' : type === 'vague' ? 'Vague language' : 'No evidence found'}
                  </div>
                  {isSel && activeEvidIdxs.length > 0 && activeEvidIdxs.map(ei => (
                    <div key={ei} style={{
                      marginTop: 5, padding: '5px 8px', borderRadius: 6, fontSize: 10.5,
                      background: HL.evidence.bg, border: `1px solid ${HL.evidence.border}`, color: HL.evidence.text,
                    }}>
                      {(evidences[ei] || '').slice(0, 130)}…
                    </div>
                  ))}
                </div>
              )
            })}
          </>}

          {/* ── EVIDENCE TAB ── */}
          {activeTab === 'evidence' && <>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
              Evidence sentences extracted from the report. Select a claim to see which evidence links to it.
            </p>
            {evidences.length === 0 && <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', marginTop: 20 }}>No evidence detected.</div>}
            {evidences.map((e, i) => {
              const isActive = activeEvidIdxs.includes(i)
              return (
                <div key={i} style={{
                  padding: '9px 11px', borderRadius: 9, transition: 'all 0.2s',
                  background: isActive ? HL.evidence.bg : '#F8FFF8',
                  border: `1px solid ${isActive ? HL.evidence.border : 'rgba(46,125,50,0.3)'}`,
                }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? HL.evidence.dot : '#d1d5db', flexShrink: 0, marginTop: 4 }} />
                    <span style={{ fontSize: 11, color: isActive ? HL.evidence.text : '#6b7280', lineHeight: 1.55 }}>
                      {e.slice(0, 160)}{e.length > 160 ? '…' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </>}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}