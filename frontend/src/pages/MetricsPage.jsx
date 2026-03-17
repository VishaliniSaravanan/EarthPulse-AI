import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line
} from 'recharts'
import { ScoreGauge, MetricBlock, ProgressBar, RatingBadge, EmptyState } from '../components/ui'

const fmt = (v, d = 1) => {
  if (v == null) return null
  if (v >= 1e9) return (v / 1e9).toFixed(d) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(d) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(d) + 'K'
  return Number(v).toFixed(d)
}

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'Sora' }, labelStyle: { color: '#475569' } }

export default function MetricsPage({ data }) {
  if (!data) return <EmptyState icon="MX" title="No data yet" desc="Upload and analyze a report first." />

  const m = data.metrics || {}
  const scores = m.esg_scores || {}
  const cam = data.esg_cam || {}
  const camComp = cam.components || {}

  const scopeData = [
    { name: 'Scope 1', value: m.scope1, fill: '#10b981' },
    { name: 'Scope 2', value: m.scope2, fill: '#0ea5e9' },
    { name: 'Scope 3', value: m.scope3, fill: '#8b5cf6' },
  ].filter(d => d.value != null)

  const radarData = [
    { subject: 'Environmental', A: scores.environmental || 50 },
    { subject: 'Social', A: scores.social || 50 },
    { subject: 'Governance', A: scores.governance || 50 },
    { subject: 'Renewable', A: m.renewable_pct || 0 },
    { subject: 'Carbon Eff.', A: m.carbon_intensity ? Math.max(0, 100 - m.carbon_intensity * 10) : 40 },
    { subject: 'Reporting', A: [m.scope1, m.scope2, m.scope3].filter(Boolean).length * 33 },
  ]

  const camData = Object.entries(camComp).map(([k, v]) => ({
    name: v.label || k,
    score: v.score,
    fill: v.score >= 70 ? '#10b981' : v.score >= 50 ? '#f59e0b' : '#ef4444'
  }))

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.company}</div>
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>{data.sector} · {data.page_count} pages · {data.chunk_count} chunks indexed</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <RatingBadge rating={cam.rating || 'BBB'} />
                <span className="badge badge-blue">{cam.outlook || 'Stable'} Outlook</span>
                <span className="badge badge-purple">{data.table_count} Tables Extracted</span>
              </div>
            </div>
            <ScoreGauge score={scores.composite || 50} size={110} />
          </div>
        </div>
      </div>

      {/* Metric grid */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Environmental Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <MetricBlock label="Scope 1" value={fmt(m.scope1)} unit="tCO₂" color="var(--green)" />
          <MetricBlock label="Scope 2" value={fmt(m.scope2)} unit="tCO₂" color="var(--accent)" />
          <MetricBlock label="Scope 3" value={fmt(m.scope3)} unit="tCO₂" color="var(--purple)" />
          <MetricBlock label="Carbon Intensity" value={m.carbon_intensity?.toFixed(3)} unit="tCO₂/$M" color="var(--orange)" />
          <MetricBlock label="Renewable Energy" value={m.renewable_pct} unit="%" color="var(--green)" />
          <MetricBlock label="Energy Consumption" value={fmt(m.energy_consumption)} unit="" />
          <MetricBlock label="Water Usage" value={fmt(m.water_usage)} unit="m³" color="var(--accent)" />
          <MetricBlock label="Waste" value={fmt(m.waste)} unit="tonnes" />
        </div>
      </div>

      <div>
        <div className="label" style={{ marginBottom: 10 }}>Social & Governance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <MetricBlock label="Employees" value={m.employees?.toLocaleString()} />
          <MetricBlock label="Women in Leadership" value={m.women_leadership} unit="%" />
          <MetricBlock label="Safety Incident Rate" value={m.safety_incidents} unit="TRIR" />
          <MetricBlock label="Revenue" value={fmt(m.revenue, 2)} unit="USD" />
        </div>
      </div>

      {/* Sub-scores */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Pillar Scores</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Environmental', score: scores.environmental || 50, color: 'var(--green)' },
            { label: 'Social', score: scores.social || 50, color: 'var(--accent)' },
            { label: 'Governance', score: scores.governance || 50, color: 'var(--purple)' },
          ].map(({ label, score, color }) => (
            <div key={label} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span className="mono" style={{ color, fontWeight: 700 }}>{score}</span>
              </div>
              <ProgressBar value={score} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Scope emissions */}
        <div className="card">
          <div className="card-header"><span className="label">GHG Emissions by Scope</span></div>
          <div className="card-body">
            {scopeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scopeData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} formatter={v => [fmt(v, 0), 'tCO₂']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {scopeData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No scope data extracted</div>}
          </div>
        </div>

        {/* Radar */}
        <div className="card">
          <div className="card-header"><span className="label">Performance Radar</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Radar dataKey="A" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.1} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ESG-CAM breakdown */}
      {camData.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="label">ESG-CAM Credit Components</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={camData} layout="vertical" barSize={14}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip {...TT} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {camData.map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'center', padding: '8px 16px' }}>
                <RatingBadge rating={cam.rating || 'BBB'} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>ESG-CAM Score</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{cam.composite_score || 55}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{cam.outlook} Outlook</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
