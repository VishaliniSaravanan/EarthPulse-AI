import { useState, useRef, useCallback } from 'react'
import {
  Video, Music, Upload, Zap, AlertCircle, CheckCircle,
  FileVideo, FileAudio, Eye, ShieldAlert,
  MessageSquare, BarChart2, X
} from 'lucide-react'
import { Spinner, ProgressBar } from '../components/ui'

// ── constants ──────────────────────────────────────────────────────────────
const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']
const ALL_EXT   = [...VIDEO_EXT, ...AUDIO_EXT]
const MAX_MB    = 200

const fmtMB = (b) => (b / 1024 / 1024).toFixed(1) + ' MB'
const sentimentColor = (s) =>
  s === 'positive' ? 'var(--green)' : s === 'negative' ? 'var(--red)' : 'var(--orange)'
const categoryLabel = { E: 'Environmental', S: 'Social', G: 'Governance' }
const categoryColor = { E: 'var(--green)', S: 'var(--accent)', G: 'var(--purple)' }

const STEPS = [
  'Uploading media file…',
  'Extracting keyframes…',
  'Transcribing audio…',
  'Running VLM ESG analysis…',
  'Structuring results…',
]

// ── tiny helpers ──────────────────────────────────────────────────────────
function Chip({ label, color = 'var(--accent)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function ScoreRing({ score = 0, size = 88 }) {
  const r    = size * 0.38
  const circ = 2 * Math.PI * r
  const off  = circ - (Math.min(100, score) / 100) * circ
  const col  = score >= 65 ? 'var(--green)' : score >= 40 ? 'var(--orange)' : 'var(--red)'
  return (
    <div style={{ position: 'relative', width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--border)" strokeWidth={size * 0.09} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={col} strokeWidth={size * 0.09}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: size * 0.22,
          fontWeight: 800, color: col, lineHeight: 1 }}>{Math.round(score)}</div>
        <div style={{ fontSize: size * 0.11, color: 'var(--text3)', marginTop: 1 }}>/100</div>
      </div>
    </div>
  )
}

// ── Drop zone ──────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()
  const handle = useCallback((f) => {
    if (!f) return
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALL_EXT.includes(ext)) { alert(`Unsupported: ${ext}`); return }
    if (f.size > MAX_MB * 1024 * 1024) { alert(`Max ${MAX_MB} MB`); return }
    onFile(f)
  }, [onFile])

  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      style={{
        border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border2)'}`,
        borderRadius: 12, padding: '28px 20px', textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: drag ? 'var(--accent-light)' : 'var(--surface2)',
        transition: 'all 0.2s', opacity: disabled ? 0.5 : 1,
      }}>
      <input ref={ref} type="file" accept={ALL_EXT.join(',')}
        style={{ display: 'none' }} onChange={e => handle(e.target.files?.[0])} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
        <FileVideo size={26} style={{ color: 'var(--accent)' }} />
        <FileAudio size={26} style={{ color: 'var(--purple)' }} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Drop audio or video here</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
        Video: {VIDEO_EXT.join(' ')} · Audio: {AUDIO_EXT.join(' ')} · Max {MAX_MB} MB
      </div>
      <span className="btn btn-secondary" style={{ fontSize: 11, pointerEvents: 'none' }}>
        <Upload size={12} /> Browse file
      </span>
    </div>
  )
}

// ── result sub-panels ─────────────────────────────────────────────────────
function SummaryPanel({ r }) {
  return (
    <div className="card fade-up">
      <div className="card-header">
        <Eye size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600 }}>Analysis Summary</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto', textTransform: 'uppercase' }}>
          {r.media_type}
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <ScoreRing score={r.esg_score_estimate || 0} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="label" style={{ marginBottom: 5 }}>Executive Summary</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>
              {r.summary || '—'}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Chip label={`Sentiment: ${r.sentiment || 'neutral'}`}
                color={sentimentColor(r.sentiment)} />
              {r.has_transcript && <Chip label="Transcript ✓" color="var(--green)" />}
              {r.frame_count > 0 && <Chip label={`${r.frame_count} frames`} color="var(--accent)" />}
              {!r.vlm_available && <Chip label="Keyword fallback" color="var(--orange)" />}
            </div>
          </div>
        </div>

        {r.esg_topics_detected?.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Topics Detected</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.esg_topics_detected.map(t => <Chip key={t} label={t} />)}
            </div>
          </div>
        )}

        {r.visual_observations && !r.visual_observations.includes('VLM not available') && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--accent-light)',
            borderRadius: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
            <strong>Visual:</strong> {r.visual_observations}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricsPanel({ r }) {
  const m = r.metrics_mentioned || {}
  const rows = [
    ['Scope 1', m.scope1, 'tCO₂'],
    ['Scope 2', m.scope2, 'tCO₂'],
    ['Scope 3', m.scope3, 'tCO₂'],
    ['Renewable %', m.renewable_pct, '%'],
    ['Net Zero Year', m.net_zero_year, ''],
  ].filter(([, v]) => v != null)
  if (!rows.length) return null
  return (
    <div className="card fade-up">
      <div className="card-header">
        <BarChart2 size={14} style={{ color: 'var(--green)' }} />
        <span style={{ fontWeight: 600 }}>Metrics Mentioned</span>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {rows.map(([label, value, unit]) => (
            <div key={label} className="metric-block">
              <div className="metric-label">{label}</div>
              <div className="metric-value" style={{ fontSize: 18 }}>
                {typeof value === 'number' && value >= 1e6
                  ? (value / 1e6).toFixed(1) + 'M' : value}
                {unit && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 3 }}>{unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ClaimsPanel({ r }) {
  const claims = r.key_claims || []
  if (!claims.length) return null
  return (
    <div className="card fade-up">
      <div className="card-header">
        <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600 }}>Key ESG Claims</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{claims.length}</span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {claims.map((c, i) => (
          <div key={i} style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${categoryColor[c.category] || 'var(--accent)'}`,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
              <Chip label={categoryLabel[c.category] || c.category}
                color={categoryColor[c.category] || 'var(--accent)'} />
              <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
                {Math.round((c.confidence || 0) * 100)}% conf
              </span>
            </div>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text2)', lineHeight: 1.6 }}>{c.claim}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function GreenwashPanel({ r }) {
  const flags = r.greenwashing_flags || []
  return (
    <div className="card fade-up">
      <div className="card-header">
        <ShieldAlert size={14} style={{ color: flags.length ? 'var(--red)' : 'var(--green)' }} />
        <span style={{ fontWeight: 600 }}>Greenwashing Flags</span>
        <span className={`badge ${flags.length ? 'badge-red' : 'badge-green'}`}
          style={{ marginLeft: 'auto' }}>{flags.length}</span>
      </div>
      <div className="card-body">
        {!flags.length ? (
          <div style={{ display: 'flex', gap: 8, color: 'var(--green)', fontSize: 13 }}>
            <CheckCircle size={16} /> No greenwashing patterns detected.
          </div>
        ) : flags.map((f, i) => (
          <div key={i} style={{
            marginBottom: 8, padding: '10px 12px', borderRadius: 8,
            background: 'var(--red-light)', border: '1px solid rgba(198,40,40,0.2)',
            borderLeft: '3px solid var(--red)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 3 }}>
              "{f.text}"
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{f.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TranscriptPanel({ r }) {
  const [exp, setExp] = useState(false)
  const excerpt = r.transcript_excerpt || ''
  if (!excerpt) return null
  return (
    <div className="card fade-up">
      <div className="card-header">
        <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600 }}>Transcript Excerpt</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
          {r.transcript_len || 0} chars
        </span>
      </div>
      <div className="card-body">
        <p style={{
          fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0,
          fontStyle: 'italic',
          overflow: exp ? 'visible' : 'hidden',
          display: exp ? 'block' : '-webkit-box',
          WebkitLineClamp: exp ? 'unset' : 4,
          WebkitBoxOrient: 'vertical',
        }}>"{excerpt}"</p>
        {excerpt.length > 200 && (
          <button className="btn btn-secondary"
            style={{ marginTop: 8, padding: '4px 10px', fontSize: 11 }}
            onClick={() => setExp(e => !e)}>
            {exp ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
export default function MediaAnalysisPage({ company }) {
  const [file,     setFile]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [stepIdx,  setStepIdx]  = useState(0)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [name,     setName]     = useState(company || '')

  const ext     = file ? ('.' + file.name.split('.').pop().toLowerCase()) : ''
  const isVideo = VIDEO_EXT.includes(ext)

  const handleFile = (f) => {
    setFile(f); setResult(null); setError(null)
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim())
  }

  const reset = () => { setFile(null); setResult(null); setError(null); setProgress(0) }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setProgress(0); setStepIdx(0)
    let s = 0
    const iv = setInterval(() => {
      s = Math.min(s + 1, STEPS.length - 1)
      setStepIdx(s)
      setProgress(Math.round((s / STEPS.length) * 85))
    }, 1800)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('company', name || file.name)
      const res  = await fetch('/api/analyze_media', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      setProgress(100)
      setResult(data)
    } catch (e) {
      setError(e.message || 'Media analysis failed.')
    } finally {
      clearInterval(iv); setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      maxWidth: 860, margin: '0 auto', width: '100%',
    }}>
      {/* ── Upload card ── */}
      <div className="card">
        <div className="card-header">
          {isVideo
            ? <Video size={14} style={{ color: 'var(--accent)' }} />
            : <Music size={14} style={{ color: 'var(--purple)' }} />}
          <span style={{ fontWeight: 600 }}>Audio / Video ESG Analyser</span>
          <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>VLM · Whisper</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            Upload a sustainability presentation, earnings call, investor day video, or audio
            briefing. Keyframes are extracted and speech is transcribed, then Claude Vision
            analyses ESG content, detects claims, and flags greenwashing.
          </p>

          {/* Name input + clear button */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Company / Presentation Name</div>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corp ESG Briefing 2024" disabled={loading} />
            </div>
            {file && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={reset}
                  style={{ padding: '9px 12px' }} disabled={loading}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {!file && <DropZone onFile={handleFile} disabled={loading} />}

          {/* Selected file pill */}
          {file && !loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 9,
              background: 'var(--accent-light)', border: '1px solid var(--border)',
            }}>
              {isVideo
                ? <FileVideo size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                : <FileAudio size={18} style={{ color: 'var(--purple)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {fmtMB(file.size)} · {ext.replace('.','').toUpperCase()}
                </div>
              </div>
              <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            </div>
          )}

          {/* Progress + pipeline steps */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size={14} />
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
                  {STEPS[stepIdx]}
                </span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>
                  {progress}%
                </span>
              </div>
              <ProgressBar value={progress} color="var(--accent)" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    opacity: i <= stepIdx ? 1 : 0.3, fontSize: 12, transition: 'opacity 0.3s' }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      background: i < stepIdx ? 'var(--green)' : i === stepIdx ? 'var(--accent)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i < stepIdx  && <span style={{ color: 'white', fontSize: 8 }}>✓</span>}
                      {i === stepIdx && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <span style={{ color: i === stepIdx ? 'var(--text)' : 'var(--text2)' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {!loading && (
            <button className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '11px 18px' }}
              onClick={handleAnalyze} disabled={!file}>
              {file
                ? <><Zap size={14} /> Analyse {isVideo ? 'Video' : 'Audio'}</>
                : <><Upload size={14} /> Select a file above</>}
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {result && (
        <>
          <SummaryPanel    r={result} />
          <MetricsPanel    r={result} />
          <ClaimsPanel     r={result} />
          <GreenwashPanel  r={result} />
          <TranscriptPanel r={result} />
        </>
      )}

      {/* ── Feature chips ── */}
      {!result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            ['🎬 Keyframes', 'Every 30s, up to 6'],
            ['🎙 Whisper STT', 'Tiny model, fast'],
            ['🤖 Claude VLM', 'Vision + language'],
            ['🛡 Greenwashing', 'Flag detection'],
            ['📊 ESG Score', 'AI-estimated 0–100'],
            ['🔒 No storage', 'Processed in-memory'],
          ].map(([t, d]) => (
            <div key={t} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{t}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}