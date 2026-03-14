import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, FileText, Zap, CheckCircle, AlertCircle,
  Search, Globe, X, Download, AlertTriangle,
  FolderOpen, RefreshCw
} from 'lucide-react'
import { analyzeESG } from '../utils/api'
import { Spinner } from '../components/ui'

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
  'ESG content validation',
  'Section detection',
  'Semantic chunking',
  'Embedding generation',
  'Qdrant vector indexing',
  'HyperRAG graph construction',
  'ESG metrics extraction',
  'Discourse graph analysis',
  'Greenwashing detection',
  'Supply chain extraction',
  'Climate risk scoring',
  'ESG-CAM credit assessment',
]

// Colour per sector — same as the old library card colours
const SECTOR_HUE = {
  Energy: 24, Technology: 217, Manufacturing: 262, Finance: 174,
  Healthcare: 330, Consumer: 38, Utilities: 239, 'Real Estate': 142,
  Agriculture: 90, Other: 210,
}

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
  const [searchQuery,    setSearchQuery]    = useState('')

  // Library state
  const [libraryFiles,   setLibraryFiles]   = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError,   setLibraryError]   = useState(null)
  const [libraryFolder,  setLibraryFolder]  = useState('')
  const [libSectors,     setLibSectors]     = useState({})   // {filename: sector}
  const [libAnalyzing,   setLibAnalyzing]   = useState(null) // filename being analyzed

  const inputRef = useRef()

  // ── Load library from backend ──────────────────────────────────────────────
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true); setLibraryError(null)
    try {
      const res  = await fetch('/api/library')
      if (!res.ok) throw new Error(`HTTP ${res.status} — make sure you pasted the patch into app.py and restarted`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLibraryFiles(data.files || [])
      setLibraryFolder(data.folder || '')
    } catch (e) {
      setLibraryError(e.message)
    } finally { setLibraryLoading(false) }
  }, [])

  useEffect(() => { if (mode === 'library') loadLibrary() }, [mode, loadLibrary])

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
          setValidationMsg('This does not appear to be an ESG report. Please upload an ESG or sustainability report.')
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
      const res = await fetch(`/api/fetch_report?url=${encodeURIComponent(url)}`)
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

  // ── Analyze from library ───────────────────────────────────────────────────
  const analyzeLibraryFile = async (entry) => {
    setLibAnalyzing(entry.filename); setError(null)
    const chosenSector = libSectors[entry.filename] || 'Other'
    try {
      const res  = await fetch('/api/library/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: entry.filename, sector: chosenSector }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      onAnalyzed(data, null)
    } catch (e) {
      setError(`${entry.company_name}: ${e.message}`)
    } finally { setLibAnalyzing(null) }
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
        setFileValidation('invalid'); setValidationMsg(result.validation_reason || 'Not an ESG report.')
        setError('Please upload an ESG Report.'); return
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

  const filteredLibrary = libraryFiles.filter(f =>
    f.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (libSectors[f.filename] || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canAnalyze = file && company.trim() && !loading && fileValidation !== 'invalid'

  // ── Sector hue for library cards ───────────────────────────────────────────
  const cardHue = (filename) => {
    const sec = libSectors[filename] || 'Other'
    return SECTOR_HUE[sec] ?? 210
  }

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '0 12px' }} className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Upload ESG Report</div>
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>
          Upload a file, fetch from any URL, or pick from your local PDF library.
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
        <button className={`tab-item ${mode === 'library' ? 'active' : ''}`} onClick={() => setMode('library')}>
          <FolderOpen size={13} /> Company Library
          {libraryFiles.length > 0 && (
            <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(52,211,153,0.2)', color: 'var(--accent)',
              padding: '1px 5px', borderRadius: 99, fontFamily: 'JetBrains Mono' }}>
              {libraryFiles.length}
            </span>
          )}
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
              <strong>HTML page</strong> – scans for ESG PDF, downloads best match &nbsp;·&nbsp;
              <strong>No PDF found</strong> – extracts text from the page
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════ COMPANY LIBRARY (card grid) ══════════════ */}
      {mode === 'library' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600 }}>Company Library</span>
            <span className="badge badge-blue" style={{ marginLeft: 6 }}>
              {libraryFiles.length} report{libraryFiles.length !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-secondary" onClick={loadLibrary} disabled={libraryLoading}
              style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}>
              <RefreshCw size={11} className={libraryLoading ? 'spin' : ''} /> Refresh
            </button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        

            {/* Error */}
            {libraryError && (
              <div className="alert alert-error" style={{ fontSize: 13 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Cannot reach /api/library</strong><br />
                  {libraryError}<br />
                  <span style={{ fontSize: 11, opacity: 0.8 }}>
                    Make sure you pasted the patch into app.py and restarted the backend.
                  </span>
                </div>
              </div>
            )}

            {/* Loading */}
            {libraryLoading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text2)', padding: 12 }}>
                <Spinner size={14} /> Scanning esg_reports folder…
              </div>
            )}

            {/* Empty */}
            {!libraryLoading && !libraryError && libraryFiles.length === 0 && (
              <div style={{ padding: '28px 20px', background: 'rgba(52,211,153,0.05)',
                border: '1px dashed var(--accent)', borderRadius: 10, textAlign: 'center' }}>
                <FolderOpen size={30} style={{ color: 'var(--accent)', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No PDFs in esg_reports folder</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
                  Copy your downloaded ESG PDFs into:<br />
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--accent)' }}>
                    {libraryFolder || 'backend/esg_reports/'}
                  </span><br />
                  The filename becomes the company name automatically. Then click Refresh.
                </div>
              </div>
            )}

            {/* Search */}
            {libraryFiles.length > 0 && (
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${libraryFiles.length} reports…`} />
            )}

            {/* ── CARD GRID — same style as the old library UI ── */}
            {filteredLibrary.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                gap: 10,
                maxHeight: 480,
                overflowY: 'auto',
                paddingRight: 4,
              }}>
                {filteredLibrary.map((entry, i) => {
                  const hue         = cardHue(entry.filename)
                  const isAnalyzing = libAnalyzing === entry.filename
                  const sec         = libSectors[entry.filename] || 'Other'
                  return (
                    <div key={i} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.boxShadow  = '0 0 0 1px rgba(52,211,153,0.15)'
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.boxShadow  = 'none'
                      }}
                    >
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Letter avatar */}
                        <div style={{
                          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                          background: `hsl(${hue},55%,18%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 15,
                          color: `hsl(${hue},80%,72%)`,
                        }}>
                          {entry.company_name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.company_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {entry.ext.replace('.','').toUpperCase()} · {entry.size_mb} MB
                          </div>
                        </div>
                      </div>

                      {/* Sector selector */}
                      <select
                        value={sec}
                        onChange={e => setLibSectors(s => ({ ...s, [entry.filename]: e.target.value }))}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        {SECTORS.map(s => <option key={s}>{s}</option>)}
                      </select>

                      {/* Analyze button */}
                      <button
                        className="btn btn-primary"
                        style={{ justifyContent: 'center', padding: '7px 12px', fontSize: 12 }}
                        onClick={() => analyzeLibraryFile(entry)}
                        disabled={!!libAnalyzing}
                      >
                        {isAnalyzing
                          ? <><Spinner size={12} /> Analyzing…</>
                          : <><Zap size={12} /> Analyze Report</>
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {filteredLibrary.length === 0 && libraryFiles.length > 0 && (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                No files match "{searchQuery}"
              </div>
            )}

            {/* Library error from analyze */}
            {error && mode === 'library' && (
              <div className="alert alert-error" style={{ fontSize: 13 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Not-ESG banner ── */}
      {fileValidation === 'invalid' && mode !== 'library' && (
        <div style={{
          padding: '18px 20px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertTriangle size={22} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--red)', marginBottom: 4 }}>
              Please Upload an ESG Report
            </div>
            <div style={{ fontSize: 13, color: 'rgba(254,202,202,0.9)', lineHeight: 1.7 }}>
              {validationMsg || 'The file does not appear to be an ESG, sustainability, or corporate responsibility report.'}
            </div>
          </div>
        </div>
      )}

      {/* ── Company / Sector (upload + fetch modes) ── */}
      {mode !== 'library' && (
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
      )}

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

      {error && mode !== 'library' && fileValidation !== 'invalid' && (
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
      {mode !== 'library' && (
        <button className="btn btn-primary"
          style={{ width:'100%', justifyContent:'center', padding:'12px 18px', fontSize:14 }}
          onClick={handleAnalyze} disabled={!canAnalyze}>
          {loading
            ? <><Spinner size={14} /> Analyzing…</>
            : !file
            ? <><Upload size={14} /> Select a File to Analyze</>
            : fileValidation === 'invalid'
            ? <><AlertCircle size={14} /> Invalid File — Please Upload ESG Report</>
            : <><Zap size={14} /> Run Full ESG Analysis</>
          }
        </button>
      )}

      {/* ── Feature chips ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginTop:20 }}>
        {[
          ['PDF','Direct or via URL'],
          ['DOCX','Word documents'],
          ['TXT','Plain text reports'],
          ['HTML','Full page extraction'],
          ['URL Fetch','PDF or HTML auto-detect'],
          ['Company Library','Your downloaded PDFs'],
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