import { EmptyState, RatingBadge, ProgressBar } from '../components/ui'
import { DollarSign, CheckCircle, TrendingUp } from 'lucide-react'

export default function FinancingPage({ data, company }) {
  if (!company) return <EmptyState icon="FI" title="No report loaded" desc="Upload a report for financing recommendations." />

  const cam = data?.esg_cam || {}
  const financing = data?.financing || []
  const comps = cam.components || {}

  const priorityColor = (p) => p === 'high' ? 'var(--green)' : p === 'medium' ? 'var(--accent)' : 'var(--text3)'
  const eligColor = (e) => e === 'Eligible' ? 'badge-green' : e === 'Recommended' ? 'badge-blue' : 'badge-orange'

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ESG-CAM summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><DollarSign size={14} style={{ color: 'var(--green)' }} /><span style={{ fontWeight: 600 }}>ESG-CAM Credit Rating</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div>
                <RatingBadge rating={cam.rating || 'BBB'} />
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>Outlook: <strong>{cam.outlook || 'Stable'}</strong></div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{cam.composite_score || 55}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Composite Score /100</div>
              </div>
              <div style={{ flex: 1 }}>
                {Object.entries(comps).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span>{v.label}</span>
                      <span className="mono">{v.score}</span>
                    </div>
                    <ProgressBar value={v.score} color={v.score >= 70 ? 'var(--green)' : v.score >= 50 ? 'var(--orange)' : 'var(--red)'} />
                  </div>
                ))}
              </div>
            </div>
            {cam.interpretation && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                {cam.interpretation}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><TrendingUp size={14} style={{ color: 'var(--accent)' }} /><span style={{ fontWeight: 600 }}>ICMA-Aligned Instruments</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {financing.slice(0, 4).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                <CheckCircle size={14} style={{ color: priorityColor(f.priority), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{f.instrument}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{f.standard}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`badge ${eligColor(f.eligibility)}`}>{f.eligibility}</span>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>-{f.estimated_rate_reduction_bps}bps</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full financing table */}
      <div className="card">
        <div className="card-header"><span className="label">Full Financing Recommendations</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Instrument</th><th>Eligibility</th><th>Rate Reduction</th><th>Standard</th><th>Priority</th><th>Rationale</th></tr></thead>
            <tbody>
              {financing.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{f.instrument}</td>
                  <td><span className={`badge ${eligColor(f.eligibility)}`}>{f.eligibility}</span></td>
                  <td className="mono" style={{ color: 'var(--green)' }}>-{f.estimated_rate_reduction_bps} bps</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{f.standard}</td>
                  <td><span className={`badge ${f.priority === 'high' ? 'badge-green' : f.priority === 'medium' ? 'badge-blue' : 'badge-orange'}`}>{f.priority}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 280 }}>{f.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
