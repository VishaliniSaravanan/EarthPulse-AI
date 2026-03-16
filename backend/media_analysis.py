"""
media_analysis.py — Audio/Video ESG analysis via VLM (Claude Vision)

Fixes applied
-------------
1. resize_frame      — guard against zero dimension with max(..., 1)
2. extract_frames    — handle zero/short duration; ensure at least t=0 is sampled
3. call_vlm          — robust JSON fence stripping with re.DOTALL; validates
                       parsed result is a dict before returning
4. transcribe_audio  — guard WHISPER_MODEL is not None AND file exists
5. analyze_media     — guard vlm_result is dict; re-run fallback if not
6. VLM_SYSTEM        — explicit instructions to fill every field; no empty defaults
7. vlm_available     — reflects BOTH library presence AND API key presence
8. fallback_analysis — sentiment derived from transcript content, not hardcoded
"""

import os
import re
import json
import base64
import tempfile
import traceback
import subprocess

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


# ── config ────────────────────────────────────────────────────────────────────

MODEL           = "claude-sonnet-4-20250514"
MAX_FRAMES      = 6
FRAME_INTERVAL  = 30        # seconds between sampled frames
FRAME_LONG_SIDE = 768       # resize longest side to this many pixels

VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}

MEDIA_RESULTS: dict[str, dict] = {}

# ── load Whisper once at import time ──────────────────────────────────────────

WHISPER_MODEL = None
if WHISPER_AVAILABLE:
    try:
        WHISPER_MODEL = whisper.load_model("tiny")
    except Exception:
        traceback.print_exc()

# ── VLM system prompt ─────────────────────────────────────────────────────────

VLM_SYSTEM = """You are an expert ESG (Environmental, Social, Governance) analyst.

You will receive:
- A TRANSCRIPT from a corporate audio/video presentation (may be empty).
- Up to 6 keyframe screenshots from the video (if it is a video).

Analyse all ESG content carefully and return ONLY valid JSON — no markdown fences,
no preamble, no trailing text — with EXACTLY this schema (fill every field):

{
  "summary": "<2-3 sentence executive summary of ESG content found>",
  "media_type": "<video or audio>",
  "esg_topics_detected": ["<topic1>", "<topic2>"],
  "key_claims": [
    {"claim": "<full sentence>", "category": "<E, S, or G>", "confidence": <0.0-1.0>}
  ],
  "metrics_mentioned": {
    "scope1": <number or null>,
    "scope2": <number or null>,
    "scope3": <number or null>,
    "renewable_pct": <number or null>,
    "net_zero_year": <4-digit year as number or null>
  },
  "greenwashing_flags": [
    {"text": "<verbatim quote>", "reason": "<why this is a greenwashing concern>"}
  ],
  "sentiment": "<positive, neutral, or negative>",
  "esg_score_estimate": <integer 0-100>,
  "visual_observations": "<ESG-relevant observations from video frames, or empty string>",
  "transcript_excerpt": "<first 300 characters of transcript, or empty string>"
}"""


# ── frame helpers ─────────────────────────────────────────────────────────────

def resize_frame(frame):
    """Resize so the longest side is at most FRAME_LONG_SIDE pixels."""
    h, w = frame.shape[:2]
    # FIX 1: guard against zero dimension
    scale = FRAME_LONG_SIDE / max(h, w, 1)
    if scale < 1.0:
        frame = cv2.resize(
            frame,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )
    return frame


def frame_to_b64(frame) -> str:
    """Encode an OpenCV BGR frame to a base64 JPEG string."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buf.tobytes()).decode()


# ── video processing ──────────────────────────────────────────────────────────

def extract_frames(video_path: str) -> list[str]:
    """Return up to MAX_FRAMES base64-encoded keyframes from a video file."""
    if not CV2_AVAILABLE:
        return []

    frames: list[str] = []
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        return frames

    fps      = cap.get(cv2.CAP_PROP_FPS) or 25
    total    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # FIX 2: guard zero duration; clamp to at least 1 second
    duration = max(total / fps, 0.0)

    if duration == 0:
        cap.release()
        return frames

    # Build sample timestamps — range needs a positive stop value
    timestamps: list[int] = list(range(0, max(1, int(duration)), FRAME_INTERVAL))

    # Always include a frame near the end
    end_t = max(0, int(duration) - 5)
    if end_t not in timestamps:
        timestamps.append(end_t)

    timestamps = sorted(set(timestamps))[:MAX_FRAMES]

    for t in timestamps:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        success, frame = cap.read()
        if success:
            frame = resize_frame(frame)
            frames.append(frame_to_b64(frame))

    cap.release()
    return frames


def extract_audio(video_path: str, out_path: str) -> bool:
    """Extract audio track from a video file to a WAV file via ffmpeg."""
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i",  video_path,
                "-vn",
                "-ar", "16000",
                "-ac", "1",
                "-f",  "wav",
                out_path,
            ],
            capture_output=True,
            timeout=120,
        )
        return result.returncode == 0 and os.path.exists(out_path)
    except Exception:
        traceback.print_exc()
        return False


# ── audio transcription ───────────────────────────────────────────────────────

def transcribe_audio(audio_path: str) -> str:
    """Transcribe an audio file using Whisper. Returns empty string on any failure."""
    # FIX 4: guard both model availability and file existence
    if not WHISPER_MODEL or not os.path.exists(audio_path):
        return ""
    try:
        result = WHISPER_MODEL.transcribe(audio_path, fp16=False)
        return (result or {}).get("text", "").strip()
    except Exception:
        traceback.print_exc()
        return ""


# ── fallback (no API key / no Anthropic library) ──────────────────────────────

def fallback_analysis(transcript: str, media_type: str) -> dict:
    """Rule-based ESG analysis used when VLM is unavailable."""
    lower = transcript.lower()

    topic_map = {
        "emissions":    ["scope 1", "scope 2", "scope 3", "ghg", "co2", "carbon"],
        "net zero":     ["net zero", "carbon neutral", "net-zero"],
        "renewable":    ["renewable", "solar", "wind", "clean energy"],
        "water":        ["water usage", "water consumption", "water management"],
        "waste":        ["waste", "recycling", "circular economy"],
        "governance":   ["governance", "board", "compliance", "ethics", "audit"],
        "social":       ["diversity", "health and safety", "community", "employees"],
        "supply chain": ["supply chain", "supplier", "procurement"],
        "climate risk": ["climate risk", "tcfd", "physical risk", "transition risk"],
        "sdgs":         ["sdg", "sustainable development goals"],
    }
    topics = [t for t, kws in topic_map.items() if any(k in lower for k in kws)]

    # FIX 8: derive sentiment from transcript content instead of hardcoding "neutral"
    pos_words = ["reduced", "improved", "achieved", "exceeded", "committed",
                 "target met", "progress", "certified", "awarded"]
    neg_words = ["increased emissions", "failed", "missed target", "violation",
                 "penalty", "lawsuit", "controversy", "cancelled"]
    pos_hits = sum(1 for w in pos_words if w in lower)
    neg_hits = sum(1 for w in neg_words if w in lower)

    if pos_hits > neg_hits:
        sentiment = "positive"
    elif neg_hits > pos_hits:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    score = min(100, max(0, 40 + len(topics) * 5 + pos_hits * 3 - neg_hits * 5))

    return {
        "summary": (
            f"Keyword-based ESG analysis (VLM unavailable). "
            f"Topics detected: {', '.join(topics) or 'general sustainability'}."
        ),
        "media_type":          media_type,
        "esg_topics_detected": topics,
        "key_claims":          [],
        "metrics_mentioned": {
            "scope1": None, "scope2": None, "scope3": None,
            "renewable_pct": None, "net_zero_year": None,
        },
        "greenwashing_flags":  [],
        "sentiment":           sentiment,
        "esg_score_estimate":  score,
        "visual_observations": "",
        "transcript_excerpt":  transcript[:300],
    }


# ── VLM call ──────────────────────────────────────────────────────────────────

def call_vlm(frames: list[str], transcript: str, media_type: str) -> dict:
    """Send frames + transcript to Claude Vision; parse and return ESG JSON."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if not ANTHROPIC_AVAILABLE or not api_key:
        return fallback_analysis(transcript, media_type)

    client = anthropic.Anthropic(api_key=api_key)

    content: list[dict] = [
        {
            "type": "text",
            "text": (
                f"TRANSCRIPT:\n{transcript[:4000] or '(No transcript available)'}\n\n"
                f"MEDIA TYPE: {media_type}"
            ),
        }
    ]

    for frame_b64 in frames[:MAX_FRAMES]:
        content.append({
            "type": "image",
            "source": {
                "type":       "base64",
                "media_type": "image/jpeg",
                "data":       frame_b64,
            },
        })

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=VLM_SYSTEM,
            messages=[{"role": "user", "content": content}],
        )

        raw = response.content[0].text.strip()

        # FIX 3: strip markdown fences robustly — handles ```json\n...\n``` with newlines
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.DOTALL)
        raw = re.sub(r"\s*```\s*$",       "", raw, flags=re.DOTALL)
        raw = raw.strip()

        parsed = json.loads(raw)

        # FIX 3 cont: validate we got a dict, not a list or scalar
        if not isinstance(parsed, dict):
            raise ValueError(f"Expected dict from VLM, got {type(parsed).__name__}")

        return parsed

    except Exception:
        traceback.print_exc()
        return fallback_analysis(transcript, media_type)


# ── main entry point ──────────────────────────────────────────────────────────

def analyze_media(file_bytes: bytes, filename: str, company: str) -> dict:
    """
    Full pipeline: save → extract frames → transcribe → VLM → return result dict.
    Result is also stored in MEDIA_RESULTS[company].
    """
    ext = os.path.splitext(filename.lower())[1]

    if ext not in VIDEO_EXT and ext not in AUDIO_EXT:
        return {"error": f"Unsupported media format: {ext}"}

    media_type: str       = "video" if ext in VIDEO_EXT else "audio"
    frames:     list[str] = []
    transcript: str       = ""

    with tempfile.TemporaryDirectory() as tmp:
        media_path = os.path.join(tmp, filename)
        with open(media_path, "wb") as f:
            f.write(file_bytes)

        if media_type == "video":
            if CV2_AVAILABLE:
                frames = extract_frames(media_path)
            audio_path = os.path.join(tmp, "audio.wav")
            if extract_audio(media_path, audio_path):
                transcript = transcribe_audio(audio_path)
        else:
            transcript = transcribe_audio(media_path)

    vlm_result = call_vlm(frames, transcript, media_type)

    # FIX 5: defensive guard — ensure vlm_result is always a dict
    if not isinstance(vlm_result, dict):
        vlm_result = fallback_analysis(transcript, media_type)

    result = {
        "company":        company,
        "filename":       filename,
        "media_type":     media_type,
        "frame_count":    len(frames),
        "transcript_len": len(transcript),
        "has_transcript": bool(transcript),
        # FIX 7: True only when the library is present AND the key is actually set
        "vlm_available":  ANTHROPIC_AVAILABLE and bool(os.environ.get("ANTHROPIC_API_KEY")),
        **vlm_result,
    }

    MEDIA_RESULTS[company] = result
    return result