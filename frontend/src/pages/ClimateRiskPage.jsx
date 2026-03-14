import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { EmptyState, ProgressBar, ScoreGauge } from '../components/ui'
import { CloudRain, Wind, Thermometer, AlertTriangle } from 'lucide-react'

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'Sora' } }

export default function ClimateRiskPage({ data, company }) {
  if (!company) return <EmptyState icon="CR" title="No report loaded" desc="Upload a report to see climate risk analysis." />

  const cr = data?.climate_risk || {}
  const hazards = cr.hazards || []
  const scenarios = cr.scenarios || []
  const overall = cr.overall_risk_score || 0
  const level = cr.risk_level || 'LOW'
  const riskColor = level === 'HIGH' ? 'var(--red)' : level === 'MEDIUM' ? 'var(--orange)' : 'var(--green)'

  const radarData = hazards.map(h => ({ subject: h.hazard.replace(' Risk', ''), A: h.score }))

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
        <div className="card">
          <div className="card-body">
            <div className="label" style={{ marginBottom: 4 }}>Overall Climate Risk</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text2)' }}>{cr.sector} sector</span>
                  <span className="mono" style={{ fontWeight: 700, color: riskColor }}>{overall}/100</span>
                </div>
                <ProgressBar value={overall} color={riskColor} />
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <div className="metric-block" style={{ flex: 1 }}>
                    <div className="metric-label">Physical Risk</div>
                    <div className="metric-value" style={{ fontSize: 16 }}>{cr.physical_risk}</div>
                  </div>
                  <div className="metric-block" style={{ flex: 1 }}>
                    <div className="metric-label">Transition Risk</div>
                    <div className="metric-value" style={{ fontSize: 16 }}>{cr.transition_risk}</div>
                  </div>
                  <div className="metric-block" style={{ flex: 1 }}>
                    <div className="metric-label">TCFD Score</div>
                    <div className="metric-value" style={{ fontSize: 16 }}>{cr.tcfd_disclosure_score}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ScoreGauge score={overall} size={100} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Hazard bars */}
        <div className="card">
          <div className="card-header"><AlertTriangle size={14} style={{ color: 'var(--orange)' }} /><span style={{ fontWeight: 600 }}>Climate Hazards</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hazards.map(h => (
                <div key={h.hazard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{h.hazard}</span>
                    <span className="mono" style={{ fontSize: 12, color: h.level === 'high' ? 'var(--red)' : h.level === 'medium' ? 'var(--orange)' : 'var(--green)' }}>
                      {h.score}
                    </span>
                  </div>
                  <ProgressBar value={h.score} color={h.level === 'high' ? 'var(--red)' : h.level === 'medium' ? 'var(--orange)' : 'var(--green)'} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Radar */}
        <div className="card">
          <div className="card-header"><span className="label">Risk Radar</span></div>
          <div className="card-body">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Radar dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No data</div>}
          </div>
        </div>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <div className="card">
          <div className="card-header"><Thermometer size={14} style={{ color: 'var(--red)' }} /><span style={{ fontWeight: 600 }}>Climate Scenarios</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Scenario</th><th>Reduction Required</th><th>Transition Cost</th><th>Stranded Asset Risk</th><th>Feasibility</th></tr></thead>
              <tbody>
                {scenarios.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{s.emissions_reduction_required}</td>
                    <td className="mono" style={{ color: 'var(--orange)' }}>{s.transition_cost_pct_revenue}% revenue</td>
                    <td><span className={`badge ${s.stranded_asset_risk === 'High' || s.stranded_asset_risk === 'Very High' ? 'badge-red' : 'badge-green'}`}>{s.stranded_asset_risk}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.feasibility}</td>
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
