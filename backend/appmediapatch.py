"""
app_media_patch.py
==================
Paste this ROUTE into app.py (anywhere before the `if __name__ == '__main__':` block).
Also add to requirements.txt:
  opencv-python-headless
  openai-whisper
  anthropic
  (ffmpeg must be installed on the OS: `sudo apt install ffmpeg` or `brew install ffmpeg`)

Set the env var:  ANTHROPIC_API_KEY=sk-ant-...
If the key is absent the system falls back to keyword-based analysis automatically.
"""

# ─────────────────────────────────────────────────────────────────────────────
# Audio / Video ESG Analysis  (VLM powered)
# ─────────────────────────────────────────────────────────────────────────────
MEDIA_VIDEO_EXT = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
MEDIA_AUDIO_EXT = {'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'}
MEDIA_MAX_MB    = 200

# NOTE: increase Flask's max content length to allow large video uploads.
# Add this line near the top of app.py where MAX_FILE_SIZE is configured:
#   app.config['MAX_MEDIA_SIZE'] = MEDIA_MAX_MB * 1024 * 1024

# ── route ─────────────────────────────────────────────────────────────────────
# @app.route('/api/analyze_media', methods=['POST'])
def analyze_media_route():
    try:
        file    = request.files.get('file')
        company = (request.form.get('company') or '').strip()

        if not file or not file.filename:
            return jsonify({'error': 'No file provided'}), 400

        filename = file.filename
        ext      = os.path.splitext(filename.lower())[1]

        if ext not in MEDIA_VIDEO_EXT | MEDIA_AUDIO_EXT:
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

        if 'error' in result:
            return jsonify(result), 422

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Registration line (copy-paste into app.py) ────────────────────────────────
# app.add_url_rule('/api/analyze_media', 'analyze_media_route',
#                  analyze_media_route, methods=['POST'])