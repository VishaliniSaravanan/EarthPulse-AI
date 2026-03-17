import { useState } from 'react'
import { Search, BookOpen, Tag, AlertCircle } from 'lucide-react'
import { queryESG } from '../utils/api'
import { Spinner, EmptyState } from '../components/ui'

const SAMPLES = [
  "What are the company's Scope 1 and Scope 2 emissions?",
  "What renewable energy targets has the company set?",
  "How does the company plan to achieve net zero?",
  "What water conservation initiatives are in place?",
  "Which suppliers contribute the most emissions?",
  "What governance policies are mentioned?",
  "What social impact programs does the company have?",
  "Is there evidence of greenwashing?",
  "What is the carbon intensity trend?",
  "What TCFD disclosures are included?",
]

const SECTIONS = ['Any','emissions','energy','water','waste','governance','social','supply_chain','climate_risk','commitments','finance']

export default function QueryPage({ company }) {
  const [question, setQuestion] = useState('')
  const [section, setSection] = useState('Any')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  const doQuery = async (q) => {
    const qText = q || question
    if (!qText.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const sec = section === 'Any' ? null : section
      const res = await queryESG(qText, company || null, sec)
      setResult({ ...res, question: qText })
      setHistory(h => [qText, ...h.filter(x => x !== qText)].slice(0, 8))
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Query box */}
      <div className="card">
        <div className="card-header">
          <Search size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>Graph-Augmented RAG Query Engine</span>
          {company && <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{company}</span>}
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doQuery()}
              placeholder="Ask anything about the report..." style={{ flex: 1 }} />
            <select value={section} onChange={e => setSection(e.target.value)} style={{ width: 140, flexShrink: 0 }}>
              {SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => doQuery()} disabled={!question.trim() || loading} style={{ flexShrink: 0 }}>
              {loading ? <Spinner size={14} /> : <Search size={14} />}
              Search
            </button>
          </div>

          {/* Sample pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SAMPLES.map((q, i) => (
              <button key={i} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => { setQuestion(q); doQuery(q) }}>
                {q.slice(0, 45)}{q.length > 45 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ alignSelf: 'center' }}>History:</span>
          {history.slice(1).map((q, i) => (
            <button key={i} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => { setQuestion(q); doQuery(q) }}>
              {q.slice(0, 40)}…
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <Spinner />
          <span style={{ color: 'var(--text2)' }}>Traversing Graph-Augmented RAG graph...</span>
          </div>
          {[80, 60, 90].map((w, i) => (
            <div key={i} style={{ height: 12, background: 'var(--surface2)', borderRadius: 4, marginBottom: 8, width: `${w}%` }} />
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="card fade-up">
          <div className="card-header">
            <BookOpen size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600 }}>Results</span>
            <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{result.chunk_count} chunks</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'var(--accent)', marginBottom: 4 }}>
              Q: {result.question}
            </div>
            {result.chunks.map((chunk, i) => (
              <ChunkBlock key={i} chunk={chunk} index={i} />
            ))}
          </div>
        </div>
      )}

      {!company && !result && !loading && (
        <EmptyState icon="Q" title="No report loaded" desc="Upload and analyze a report to query it." />
      )}
    </div>
  )
}

function ChunkBlock({ chunk, index }) {
  const [expanded, setExpanded] = useState(false)
  const text = chunk.text || ''
  return (
    <div className="chunk-block">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className="badge badge-blue">#{index + 1}</span>
        {chunk.section && <span className="badge badge-purple" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{chunk.section}</span>}
        {chunk.page && <span style={{ fontSize: 11, color: 'var(--text3)' }}>p.{chunk.page}</span>}
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11 }}
          onClick={() => setExpanded(!expanded)}>
          {expanded ? 'collapse' : 'expand'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, margin: 0,
        overflow: expanded ? 'visible' : 'hidden',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? 'unset' : 3,
        WebkitBoxOrient: 'vertical'
      }}>
        {text}
      </p>
    </div>
  )
}
