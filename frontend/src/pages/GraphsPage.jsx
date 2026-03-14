import { useState, useEffect } from 'react'
import { getHyperRAGGraph, getDiscourseGraph } from '../utils/api'
import { ForceGraph, Spinner, EmptyState } from '../components/ui'
import { Network, GitBranch, RefreshCw } from 'lucide-react'

export default function GraphsPage({ company }) {
  const [tab, setTab] = useState('hyperrag')
  const [hyperData, setHyperData] = useState(null)
  const [discData, setDiscData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => { if (company) load() }, [company])

  const load = async () => {
    if (!company) return
    setLoading(true)
    try {
      const [h, d] = await Promise.all([getHyperRAGGraph(company), getDiscourseGraph(company)])
      setHyperData(h); setDiscData(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!company) return <EmptyState icon="KG" title="No report loaded" desc="Upload a report to view knowledge graphs." />

  const SECTION_COLORS = {
    emissions: '#10b981', energy: '#f59e0b', water: '#0ea5e9',
    waste: '#8b5cf6', governance: '#ef4444', social: '#ec4899',
    supply_chain: '#14b8a6', climate_risk: '#f97316', commitments: '#6366f1',
    finance: '#eab308', general: '#94a3b8'
  }
  const hyperColorFn = (n) => SECTION_COLORS[n.section] || '#94a3b8'
  const discColorFn = (n) => n.type === 'claim' ? '#0ea5e9' : n.type === 'evidence' ? '#10b981' : '#f59e0b'

  const current = tab === 'hyperrag' ? hyperData : discData

  const describeNode = (n) => {
    if (!n) return null
    if (tab === 'hyperrag') {
      return `Section: ${n.section || 'general'} · Page ${n.page ?? 'n/a'}. This node represents a text chunk from the report used in retrieval.`
    }
    if (tab === 'discourse') {
      if (n.type === 'claim') {
        return 'This is a sustainability claim sentence identified from the report.'
      }
      if (n.type === 'evidence') {
        return 'This is an evidence sentence that may support or contradict a claim.'
      }
      if (n.type === 'vague') {
        return 'This is a vague or unsubstantiated sustainability statement.'
      }
      return 'Graph node extracted from the discourse analysis of the report.'
    }
    return null
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <Network size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>Knowledge Graphs</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: 12 }} onClick={load}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          {/* Tab toggle */}
          <div className="tab-nav" style={{ marginBottom: 16 }}>
            <button className={`tab-item ${tab === 'hyperrag' ? 'active' : ''}`} onClick={() => setTab('hyperrag')}>
              <GitBranch size={13} /> HyperRAG Graph
            </button>
            <button className={`tab-item ${tab === 'discourse' ? 'active' : ''}`} onClick={() => setTab('discourse')}>
              <Network size={13} /> Discourse Graph
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 11 }}>
            {tab === 'hyperrag' ? (
              Object.entries(SECTION_COLORS).slice(0, 8).map(([sec, color]) => (
                <span key={sec} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {sec}
                </span>
              ))
            ) : (
              [['#0ea5e9', 'Claim'], ['#10b981', 'Evidence'], ['#f59e0b', 'Vague'], ['#ef4444', 'Contradiction edge'], ['#10b981', 'Support edge']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))
            )}
          </div>

          {/* Stats */}
          {current && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: 'var(--text2)' }}>
              <span><strong className="mono">{current.nodes?.length || 0}</strong> nodes</span>
              <span><strong className="mono">{current.edges?.length || 0}</strong> edges</span>
            </div>
          )}

          {/* Graph canvas */}
          {loading ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8 }}>
              <Spinner /> Building graph...
            </div>
          ) : current?.nodes?.length ? (
            <>
              <ForceGraph
                nodes={current.nodes.map(n => ({ id: n.id, label: n.label, section: n.section, type: n.type, page: n.page }))}
                edges={current.edges.map(e => ({ source: e.source, target: e.target, relation: e.relation }))}
                colorFn={tab === 'hyperrag' ? hyperColorFn : discColorFn}
                height={380}
                onNodeClick={setSelectedNode}
              />
              {selectedNode && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Selected node</div>
                  <div style={{ marginBottom: 2 }}>Label: <span className="mono">{selectedNode.label ?? selectedNode.id}</span></div>
                  {selectedNode.section && <div style={{ marginBottom: 2 }}>Section: {selectedNode.section}</div>}
                  {selectedNode.type && <div style={{ marginBottom: 2 }}>Type: {selectedNode.type}</div>}
                  <div style={{ color: 'var(--text3)' }}>{describeNode(selectedNode)}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 8 }}>
              No graph data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
