import { useState, useEffect, useRef } from 'react'
import {
  Upload, BarChart2, Search, ShieldAlert, Link2, Globe2,
  DollarSign, Zap, Network, Wifi, WifiOff, ChevronRight,
  FileSearch, Video
} from 'lucide-react'
import { healthCheck } from './utils/api'
import UploadPage        from './pages/UploadPage'
import MetricsPage       from './pages/MetricsPage'
import QueryPage         from './pages/QueryPage'
import GreenwashingPage  from './pages/GreenwashingPage'
import SupplyChainPage   from './pages/SupplyChainPage'
import ClimateRiskPage   from './pages/ClimateRiskPage'
import FinancingPage     from './pages/FinancingPage'
import ScenarioPage      from './pages/ScenarioPage'
import GraphsPage        from './pages/GraphsPage'
import PDFAnalysisPage   from './pages/PDFAnalysisPage'
import MediaAnalysisPage from './pages/MediaAnalysisPage'
import LandingPage       from './pages/LandingPage'

const NAV = [
  { key: 'upload',       label: 'Upload Report',  icon: Upload,      group: 'START',        free: true  },
  { key: 'pdfview',      label: 'PDF Analyzer',   icon: FileSearch,  group: 'START',        free: false },
  { key: 'media',        label: 'Audio / Video',  icon: Video,       group: 'START',        free: true  },
  { key: 'metrics',      label: 'ESG Metrics',    icon: BarChart2,   group: 'ANALYTICS',    free: false },
  { key: 'query',        label: 'Query Engine',   icon: Search,      group: 'ANALYTICS',    free: false },
  { key: 'greenwashing', label: 'Greenwashing',   icon: ShieldAlert, group: 'ANALYTICS',    free: false },
  { key: 'supply',       label: 'Supply Chain',   icon: Link2,       group: 'ANALYTICS',    free: false },
  { key: 'climate',      label: 'Climate Risk',   icon: Globe2,      group: 'INTELLIGENCE', free: false },
  { key: 'financing',    label: 'Financing',      icon: DollarSign,  group: 'INTELLIGENCE', free: false },
  { key: 'scenario',     label: 'Scenarios',      icon: Zap,         group: 'INTELLIGENCE', free: false },
  { key: 'graphs',       label: 'Graphs',         icon: Network,     group: 'INTELLIGENCE', free: false },
]

export default function App() {
  const [page,         setPage]         = useState('landing')
  const [analysisData, setAnalysisData] = useState(null)
  const [backend,      setBackend]      = useState(null)
  const pdfFileRef = useRef(null)

  useEffect(() => {
    healthCheck().then(() => setBackend(true)).catch(() => setBackend(false))
  }, [])

  useEffect(() => {
    const onPop = () => setPage('landing')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleAnalyzed = (result, file) => {
    pdfFileRef.current = file
    setAnalysisData(result)
    setPage('metrics')
  }

  const company = analysisData?.company
  const groups  = [...new Set(NAV.map(n => n.group))]

  const renderPage = () => {
    switch (page) {
      case 'upload':       return <UploadPage onAnalyzed={handleAnalyzed} />
      case 'pdfview':      return <PDFAnalysisPage data={analysisData} company={company} pdfFileRef={pdfFileRef} />
      case 'media':        return <MediaAnalysisPage company={company} />
      case 'metrics':      return <MetricsPage data={analysisData} />
      case 'query':        return <QueryPage company={company} />
      case 'greenwashing': return <GreenwashingPage data={analysisData} company={company} />
      case 'supply':       return <SupplyChainPage data={analysisData} company={company} />
      case 'climate':      return <ClimateRiskPage data={analysisData} company={company} />
      case 'financing':    return <FinancingPage data={analysisData} company={company} />
      case 'scenario':     return <ScenarioPage data={analysisData} company={company} />
      case 'graphs':       return <GraphsPage company={company} />
      default:             return null
    }
  }

  const goToUpload = () => {
    window.history.pushState({ page: 'upload' }, '', window.location.pathname || '/')
    setPage('upload')
  }

  if (page === 'landing') return <LandingPage onStart={goToUpload} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: '#2E7D32',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Globe2 size={14} style={{ color: 'white' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--sidebar-text)' }}>ESG Intelligence</div>
              <div style={{ fontSize: 10, color: 'var(--sidebar-text3)', fontFamily: 'JetBrains Mono' }}>v2.1 Platform</div>
            </div>
          </div>
        </div>

        {/* Active report badge */}
        {company && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(46,125,50,0.12)' }}>
            <div style={{ fontSize: 10, color: 'var(--sidebar-text2)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Active Report</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sidebar-text)' }}>{company}</div>
            <div style={{ fontSize: 11, color: 'var(--sidebar-text3)' }}>
              {analysisData?.sector} · ESG {analysisData?.metrics?.esg_scores?.composite ?? '—'}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--sidebar-text3)',
                padding: '8px 8px 4px', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}>
                {group}
              </div>
              {NAV.filter(n => n.group === group).map(({ key, label, icon: Icon, free }) => {
                const isActive = page === key
                const isLocked = !free && !company
                return (
                  <button
                    key={key}
                    onClick={() => !isLocked && setPage(key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 7, border: 'none',
                      cursor: isLocked ? 'default' : 'pointer',
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      color: isActive ? 'var(--sidebar-text)' : isLocked ? 'var(--sidebar-text3)' : 'var(--sidebar-text2)',
                      fontWeight: isActive ? 600 : 400, fontSize: 13,
                      textAlign: 'left', fontFamily: 'Sora', transition: 'all 0.1s',
                      marginBottom: 1,
                    }}
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {isActive && <ChevronRight size={12} style={{ flexShrink: 0 }} />}
                    {isLocked && (
                      <span style={{ fontSize: 9, color: 'var(--sidebar-text3)', fontFamily: 'JetBrains Mono' }}>
                        LOCKED
                      </span>
                    )}
                    {key === 'media' && !isActive && (
                      <span style={{ fontSize: 8, background: 'rgba(106,27,154,0.2)',
                        color: 'var(--purple)', padding: '1px 5px', borderRadius: 99,
                        fontFamily: 'JetBrains Mono' }}>NEW</span>
                    )}
                    {key === 'pdfview' && company && !isActive && (
                      <span style={{ fontSize: 8, background: 'rgba(46,125,50,0.2)',
                        color: 'var(--sidebar-text)', padding: '1px 5px', borderRadius: 99,
                        fontFamily: 'JetBrains Mono' }}>NEW</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Backend status */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            {backend === null ? null : backend ? (
              <><Wifi size={11} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>Backend Online</span></>
            ) : (
              <><WifiOff size={11} style={{ color: 'var(--red)' }} /><span style={{ color: 'var(--red)' }}>Backend Offline</span></>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--main-bg)' }}>
        {/* Top bar */}
        <div style={{
          height: 48, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 8, flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 10, color: 'var(--text)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {NAV.find(n => n.key === page)?.label}
          </span>
          {company && page !== 'upload' && page !== 'media' && (
            <>
              <span style={{ color: 'var(--text3)', margin: '0 4px' }}>/</span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{company}</span>
              <span className="badge badge-blue" style={{ marginLeft: 4 }}>{analysisData?.sector}</span>
            </>
          )}
        </div>

        {/* Page content */}
        <div style={{
          flex: 1,
          padding:    page === 'pdfview' ? 0 : 24,
          overflowY:  page === 'pdfview' ? 'hidden' : 'auto',
          display:    'flex',
          flexDirection: 'column',
        }}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}