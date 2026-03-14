import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { EmptyState, ForceGraph } from '../components/ui'
import { Package, Truck, TrendingUp, AlertTriangle } from 'lucide-react'

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'Sora' } }

function RiskBadge({ level }) {
  const cls = level === 'high' ? 'badge-red' : level === 'medium' ? 'badge-orange' : 'badge-green'
  return <span className={`badge ${cls}`}>{level}</span>
}

export default function SupplyChainPage({ data, company }) {
  if (!company) return <EmptyState icon="SC" title="No report loaded" desc="Upload and analyze a report." />

  const sc = data?.supply_chain || {}
  const suppliers = sc.suppliers || []
  const logistics = sc.logistics || []
  const recs = sc.recommendations || []
  const graphNodes = sc.graph_nodes || []
  const graphEdges = sc.graph_edges || []

  const nodeColorFn = (n) => {
    if (n.type === 'company') return '#0ea5e9'
    if (n.type === 'supplier') return n.risk === 'high' ? '#ef4444' : n.risk === 'medium' ? '#f59e0b' : '#10b981'
    return '#8b5cf6'
  }

  const riskData = suppliers.slice(0, 10).map(s => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    risk: s.risk_score,
    sustainability: s.sustainability_score,
  }))

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { icon: <Package size={14} />, label: 'Suppliers Found', value: suppliers.length, color: 'var(--accent)' },
          { icon: <Truck size={14} />, label: 'Logistics Partners', value: logistics.length, color: 'var(--purple)' },
          { icon: <AlertTriangle size={14} />, label: 'High Risk Suppliers', value: sc.high_risk_count || 0, color: 'var(--red)' },
          { icon: <TrendingUp size={14} />, label: 'Avg Supplier Risk', value: `${sc.avg_supplier_risk || 0}%`, color: 'var(--orange)' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color }}>
              {icon}<span style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Suppliers table */}
        <div className="card">
          <div className="card-header"><Package size={14} style={{ color: 'var(--accent)' }} /><span style={{ fontWeight: 600 }}>Identified Suppliers</span></div>
          <div style={{ overflowX: 'auto' }}>
            {suppliers.length > 0 ? (
              <table className="data-table">
                <thead><tr><th>Supplier</th><th>Risk</th><th>Sustainability</th></tr></thead>
                <tbody>
                  {suppliers.slice(0, 15).map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td><RiskBadge level={s.risk_level} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${s.sustainability_score}%`, height: '100%', background: 'var(--green)', borderRadius: 99 }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{s.sustainability_score}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No suppliers extracted from text</div>}
          </div>
        </div>

        {/* Risk chart */}
        <div className="card">
          <div className="card-header"><span className="label">Supplier Risk vs Sustainability</span></div>
          <div className="card-body">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskData} barSize={12} layout="vertical">
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip {...TT} />
                  <Bar dataKey="risk" fill="#ef4444" name="Risk" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="sustainability" fill="#10b981" name="Sustainability" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No data</div>}
          </div>
        </div>
      </div>

      {/* Supply chain graph */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontWeight: 600 }}>Supply Chain Network</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {[['var(--accent)', 'Company'], ['var(--green)', 'Low Risk'], ['var(--orange)', 'Med Risk'], ['var(--red)', 'High Risk']].map(([c, l]) => (
              <span key={l} style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
        </div>
        <div className="card-body" style={{ padding: 12 }}>
          {graphNodes.length > 0 ? (
            <ForceGraph nodes={graphNodes.map(n => ({ id: n.id, label: n.id?.slice(0, 10), type: n.type, risk: n.risk }))}
              edges={graphEdges.map(e => ({ source: e.source, target: e.target, relation: e.relation }))}
              colorFn={nodeColorFn} height={320} />
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No supply chain graph data</div>}
        </div>
      </div>

      {/* Optimization recommendations */}
      {recs.length > 0 && (
        <div className="card">
          <div className="card-header"><TrendingUp size={14} style={{ color: 'var(--green)' }} /><span style={{ fontWeight: 600 }}>Optimization Recommendations</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Action</th><th>CO₂ Reduction</th><th>Cost Change</th><th>ESG Gain</th><th>Priority</th></tr></thead>
              <tbody>
                {recs.map((r, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: 300 }}>{r.action}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>-{r.carbon_reduction_pct}%</td>
                    <td className="mono" style={{ color: r.cost_change_pct > 0 ? 'var(--orange)' : 'var(--green)' }}>
                      {r.cost_change_pct > 0 ? '+' : ''}{r.cost_change_pct}%
                    </td>
                    <td className="mono" style={{ color: 'var(--accent)' }}>+{r.esg_improvement}</td>
                    <td><span className={`badge ${r.priority === 'high' ? 'badge-red' : r.priority === 'medium' ? 'badge-orange' : 'badge-blue'}`}>{r.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
