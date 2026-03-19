import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, FileText, Zap, CheckCircle, AlertCircle,
  Globe, X, Download, AlertTriangle,
} from 'lucide-react'
import { analyzeESG } from '../utils/api'
import { Spinner } from '../components/ui'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

const SECTORS = ['Energy','Technology','Manufacturing','Finance','Healthcare',
                 'Consumer','Utilities','Real Estate','Agriculture','Other']

const SUPPORTED_EXTENSIONS = ['.pdf','.docx','.doc','.txt','.html']
const MAX_FILE_SIZE_MB      = 100

const ESG_KEYWORDS = [
  'scope','emissions','carbon','ghg','greenhouse','sustainability','esg',
  'environmental','social','governance','climate','renewable','energy','waste',
  'water','net zero','carbon neutral','tcfd','disclosure','reporting',
  'diversity','health','safety','supply chain','responsible','impact',
  'sdg','co2','pollution','recycling','annual report',
]

const PIPELINE_STEPS = [
  'File parsing & format detection',
  'Content validation',
  'Section detection',
  'Semantic chunking',
  'Embedding generation',
  'Qdrant vector indexing',
  'Graph-Augmented RAG construction',
  'Impact metrics extraction',
  'Discourse graph analysis',
  'Greenwashing detection',
  'Supply chain extraction',
  'Climate risk scoring',
  'ESG-CAM credit assessment',
]

export default function UploadPage({ onAnalyzed }) {
  const [mode,           setMode]           = useState('upload')
  const [file,           setFile]           = useState(null)
  const [company,        setCompany]        = useState('')
  const [sector,         setSector]         = useState('Other')
  const [loading,        setLoading]        = useState(false)
  const [progress,       setProgress]       = useState(0)
  const [step,           setStep]           = useState(0)
  const [error,          setError]          = useState(null)
  const [done,           setDone]           = useState(false)
  const [drag,           setDrag]           = useState(false)
  const [fetchUrl,       setFetchUrl]       = useState('')
  const [fetchLoading,   setFetchLoading]   = useState(false)
  const [fetchStatus,    setFetchStatus]    = useState(null)
  const [fileValidation, setFileValidation] = useState(null)
  const [validationMsg,  setValidationMsg]  = useState('')

  const inputRef = useRef()

  // ── File validation ────────────────────────────────────────────────────────
  const validateFile = useCallback(async (f) => {
    if (!f) return false
    const sizeMB = f.size / 1024 / 1024
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setFileValidation('invalid')
      setValidationMsg(`File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_FILE_SIZE_MB} MB.`)
      return false
    }
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setFileValidation('invalid')
      setValidationMsg(`Unsupported format "${ext}". Please upload: ${SUPPORTED_EXTENSIONS.join(', ')}`)
      return false
    }
    if (f.type === 'text/plain') {
      try {
        const text = await f.slice(0, 10240).text()
        const hits = ESG_KEYWORDS.filter(kw => text.toLowerCase().includes(kw))
        if (hits.length === 0) {
          setFileValidation('invalid')
          setValidationMsg('This does not appear to be a climate or sustainability report. Please upload a relevant report.')
          return false
        }
      } catch {}
    }
    setFileValidation('valid')
    setValidationMsg('File accepted.')
    return true
  }, [])

  const handleFileSelect = async (f) => {
    if (!f) return
    setFileValidation(null); setValidationMsg(''); setError(null)
    const ok = await validateFile(f)
    if (ok !== false) setFile(f); else setFile(null)
  }

  const handleDrop = async (e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  // ── Fetch from URL ─────────────────────────────────────────────────────────
  const fetchFromUrl = async () => {
    if (!fetchUrl.trim()) return
    setFetchLoading(true); setFetchStatus(null); setError(null)
    setFile(null); setFileValidation(null)
    try {
      let url = fetchUrl.trim()
      if (!url.startsWith('http')) url = 'https://' + url
      const res = await fetch(`${API_BASE_URL}/fetch_report?url=${encodeURIComponent(url)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const blob     = await res.blob()
      const detected = res.headers.get('X-Detected-Filename') || ''
      const rawName  = detected || url.split('/').pop().split('?')[0]
      const fname    = rawName && rawName.length > 3 ? rawName : 'esg-report.pdf'
      const f        = new File([blob], fname, { type: blob.type || 'application/pdf' })
      await handleFileSelect(f)
      setFetchStatus('success')
      if (!company) setCompany(fname.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim())
    } catch (e) {
      setFetchStatus('error'); setError(e.message || 'Failed to fetch.')
    } finally { setFetchLoading(false) }
  }

  // ── Pipeline simulation ────────────────────────────────────────────────────
  const simulate = () => {
    let s = 0
    const iv = setInterval(() => { s++; setStep(s); if (s >= PIPELINE_STEPS.length) clearInterval(iv) }, 700)
    return iv
  }

  // ── Main analyze ───────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file || !company.trim() || fileValidation === 'invalid') return
    setLoading(true); setError(null); setDone(false); setStep(0); setProgress(0)
    const iv = simulate()
    try {
      const result = await analyzeESG(file, company.trim(), sector, setProgress)
      if (result.esg_validation === false) {
        setFileValidation('invalid'); setValidationMsg(result.validation_reason || 'Not a suitable climate or sustainability report.')
        setError('Please upload a suitable report.'); return
      }
      clearInterval(iv); setDone(true)
      setTimeout(() => onAnalyzed(result, file), 600)
    } catch (e) {
      clearInterval(iv)
      const msg = e.response?.data?.error || e.message || 'Analysis failed'
      if (msg.toLowerCase().includes('esg')) { setFileValidation('invalid'); setValidationMsg(msg) }
      setError(msg)
    } finally { setLoading(false) }
  }

  const canAnalyze = file && company.trim() && !loading && fileValidation !== 'invalid'

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '0 12px' }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Upload Climate / Sustainability Report</div>
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>
          Upload a file or fetch from any URL.
          Supports PDF, DOCX, TXT, HTML · up to {MAX_FILE_SIZE_MB} MB.
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        <button className={`tab-item ${mode === 'upload'  ? 'active' : ''}`} onClick={() => setMode('upload')}>
          <Upload size={13} /> File Upload
        </button>
        <button className={`tab-item ${mode === 'fetch'   ? 'active' : ''}`} onClick={() => setMode('fetch')}>
          <Globe size={13} /> Fetch from URL
        </button>
      </div>

      {/* ══════════════════════════════ FILE UPLOAD ══════════════════════════ */}
      {mode === 'upload' && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${drag ? 'var(--accent)' : file && fileValidation === 'valid' ? 'var(--green)' : file && fileValidation === 'invalid' ? 'var(--red)' : 'var(--border2)'}`,
              borderRadius: 10, padding: '36px 32px', textAlign: 'center', cursor: 'pointer',
              background: drag ? 'var(--accent-light)' : file && fileValidation === 'valid' ? 'var(--green-light)'
                : file && fileValidation === 'invalid' ? 'var(--red-light)' : 'var(--surface2)',
              transition: 'all 0.2s', marginBottom: 12,
            }}
          >
            <input ref={inputRef} type="file"
              accept=".pdf,.docx,.doc,.txt,.html,application/pdf,text/plain,text/html"
              style={{ display: 'none' }}
              onChange={e => handleFileSelect(e.target.files[0])} />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <FileText size={24} style={{ color: fileValidation === 'invalid' ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {(file.size/1024/1024).toFixed(2)} MB · {file.name.split('.').pop().toUpperCase()}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setFileValidation(null); setValidationMsg('') }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:4, marginLeft:8 }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} style={{ color: 'var(--text3)', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: 15 }}>Drop file here or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>ESG reports, sustainability disclosures, annual reports</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {SUPPORTED_EXTENSIONS.map(ext => (
                    <span key={ext} className="badge badge-blue" style={{ fontSize: 10 }}>{ext.toUpperCase()}</span>
                  ))}
                  <span className="badge badge-orange" style={{ fontSize: 10 }}>MAX {MAX_FILE_SIZE_MB}MB</span>
                </div>
              </div>
            )}
          </div>

          {fileValidation && (
            <div className={`alert ${fileValidation === 'valid' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12, fontSize: 13 }}>
              {fileValidation === 'valid'
                ? <CheckCircle size={14} style={{ flexShrink: 0 }} />
                : <AlertCircle  size={14} style={{ flexShrink: 0 }} />}
              {validationMsg}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════ FETCH FROM URL ═══════════════════════ */}
      {mode === 'fetch' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <Globe size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600 }}>Fetch from URL</span>
            <span className="badge badge-green" style={{ marginLeft: 'auto', fontSize: 10 }}>PDF · HTML · Any site</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
              Paste <strong>any URL</strong> — a direct PDF link or a company ESG webpage.
              The server auto-detects the best PDF on the page if it's HTML.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={fetchUrl}
                onChange={e => setFetchUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchFromUrl()}
                placeholder="https://www.apple.com/environment/pdf/Apple_Environmental_Progress_Report_2025.pdf"
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={fetchFromUrl}
                disabled={!fetchUrl.trim() || fetchLoading} style={{ flexShrink: 0 }}>
                {fetchLoading ? <Spinner size={14} /> : <Download size={14} />}
                Fetch
              </button>
            </div>
            {fetchStatus === 'success' && file && (
              <div className="alert alert-success" style={{ fontSize: 13 }}>
                <CheckCircle size={14} style={{ flexShrink: 0 }} />
                Downloaded: <strong>{file.name}</strong> ({(file.size/1024/1024).toFixed(2)} MB)
              </div>
            )}
            {fetchStatus === 'error' && (
              <div className="alert alert-error" style={{ fontSize: 13 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}
            <div style={{ padding: '9px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.7 }}>
              <strong>Direct PDF link</strong> – downloads immediately &nbsp;·&nbsp;
              <strong>HTML page</strong> – scans for a suitable PDF, downloads best match &nbsp;·&nbsp;
              <strong>No PDF found</strong> – extracts text from the page
            </div>
          </div>
        </div>
      )}

      

      {/* ── Not-valid banner ── */}
      {fileValidation === 'invalid' && (
        <div style={{
          padding: '18px 20px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertTriangle size={22} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--red)', marginBottom: 4 }}>
              Please Upload a Suitable Report
            </div>
            <div style={{ fontSize: 13, color: 'rgba(254,202,202,0.9)', lineHeight: 1.7 }}>
              {validationMsg || 'The file does not appear to be a climate, sustainability, or corporate responsibility report.'}
            </div>
          </div>
        </div>
      )}

      {/* ── Company / Sector (upload + fetch modes) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 5 }}>Company Name *</div>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Infosys Ltd." />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 5 }}>Sector</div>
          <select value={sector} onChange={e => setSector(e.target.value)}>
            {SECTORS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Pipeline progress ── */}
      {loading && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Spinner size={14} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Running analysis pipeline…</span>
            <span className="mono" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>{progress}%</span>
          </div>
          {progress > 0 && progress < 100 && (
            <div className="progress-bar" style={{ height: 8, marginBottom: 14 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {PIPELINE_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                opacity: i <= step ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i < step  && <span style={{ color:'white', fontSize:9 }}>Y</span>}
                  {i === step && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                </div>
                <span style={{ fontSize: 12, color: i === step ? 'var(--text)' : 'var(--text2)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && fileValidation !== 'invalid' && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}
      {done && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          <CheckCircle size={15} style={{ flexShrink: 0 }} /> Analysis complete! Loading dashboard…
        </div>
      )}

      {/* ── Analyze button ── */}
      <button className="btn btn-primary"
        style={{ width:'100%', justifyContent:'center', padding:'12px 18px', fontSize:14 }}
        onClick={handleAnalyze} disabled={!canAnalyze}>
        {loading
          ? <><Spinner size={14} /> Analyzing…</>
          : !file
          ? <><Upload size={14} /> Select a File to Analyze</>
          : fileValidation === 'invalid'
          ? <><AlertCircle size={14} /> Invalid File — Please Upload a Suitable Report</>
          : <><Zap size={14} /> Run Full Analysis</>
        }
      </button>

      {/* ── Feature chips ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginTop:20 }}>
        {[
          ['PDF','Direct or via URL'],
          ['DOCX','Word documents'],
          ['TXT','Plain text reports'],
          ['HTML','Full page extraction'],
          ['URL Fetch','PDF or HTML auto-detect'],
        ].map(([title, desc]) => (
          <div key={title} className="card" style={{ padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{title}</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}