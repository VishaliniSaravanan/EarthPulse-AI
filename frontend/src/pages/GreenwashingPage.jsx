import { useState } from 'react'
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { ProgressBar, EmptyState } from '../components/ui'

export default function GreenwashingPage({ data, company }) {
  if (!company) return <EmptyState icon="GW" title="No report loaded" desc="Upload and analyze a report to detect greenwashing." />

  const gw = data?.greenwashing || {}
  const risk = gw.risk_score || 0
  const level = gw.risk_level || 'LOW'
  const contradictions = gw.contradictions || []
  const vague = gw.vague_claims || []

  const riskColor = level === 'HIGH' ? 'var(--red)' : level === 'MEDIUM' ? 'var(--orange)' : 'var(--green)'
  const riskBadge = level === 'HIGH' ? 'badge-red' : level === 'MEDIUM' ? 'badge-orange' : 'badge-green'

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Risk summary card */}
      <div className="card">
        <div className="card-header">
          <ShieldAlert size={15} style={{ color: riskColor }} />
          <span style={{ fontWeight: 600 }}>Greenwashing Risk Assessment</span>
          <span className={`badge ${riskBadge}`} style={{ marginLeft: 'auto' }}>{level} RISK</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text2)' }}>Risk Score</span>
                <span className="mono" style={{ fontWeight: 700, color: riskColor }}>{risk}/100</span>
              </div>
              <ProgressBar value={risk} color={riskColor} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>Low</span><span>Medium</span><span>High</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Contradictions', value: contradictions.length, color: contradictions.length > 0 ? 'var(--red)' : 'var(--green)' },
                { label: 'Vague Claims', value: vague.length, color: vague.length > 2 ? 'var(--orange)' : 'var(--green)' },
                { label: 'Total Claims', value: gw.claim_count || 0, color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contradictions */}
      <div className="card">
        <div className="card-header">
          <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
          <span style={{ fontWeight: 600 }}>Detected Contradictions</span>
          <span className="badge badge-red" style={{ marginLeft: 'auto' }}>{contradictions.length}</span>
        </div>
        <div className="card-body">
          {contradictions.length === 0 ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--green)', padding: 8 }}>
              <ShieldCheck size={18} />
              <span style={{ fontWeight: 500 }}>No claim-evidence contradictions detected</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contradictions.map((c, i) => <ContradictionBlock key={i} c={c} index={i} />)}
            </div>
          )}
        </div>
      </div>

      {/* Vague claims */}
      <div className="card">
        <div className="card-header">
          <Info size={14} style={{ color: 'var(--orange)' }} />
          <span style={{ fontWeight: 600 }}>Vague / Unsubstantiated Claims</span>
          <span className="badge badge-orange" style={{ marginLeft: 'auto' }}>{vague.length}</span>
        </div>
        <div className="card-body">
          {vague.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No vague claims detected.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vague.map((v, i) => (
                <div key={i} className="vague-block">
                  <span className="mono" style={{ color: 'var(--orange)', marginRight: 8, fontSize: 11 }}>#{i+1}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Methodology note */}
      <div className="alert alert-info" style={{ fontSize: 12 }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        <div>
          <strong>Methodology:</strong> The discourse graph analyzes sustainability claims and evidence sentences. Contradictions are detected when a commitment claim is paired with contradicting evidence using pattern matching. Vague claims are identified by generic sustainability language without measurable targets.
        </div>
      </div>
    </div>
  )
}

function ContradictionBlock({ c, index }) {
  const [open, setOpen] = useState(false)
  const severityColor = c.severity === 'high' ? 'var(--red)' : 'var(--orange)'
  return (
    <div className="contradiction-block">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-red">#{index + 1}</span>
          <span className="badge" style={{ background: 'transparent', border: `1px solid ${severityColor}`, color: severityColor }}>
            {c.severity?.toUpperCase()} SEVERITY
          </span>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.claim?.slice(0, 70)}…</span>
        </div>
        {open ? <ChevronUp size={14} style={{ flexShrink: 0, color: 'var(--text3)' }} /> : <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text3)' }} />}
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6 }}>
            <div className="label" style={{ color: '#1e40af', marginBottom: 4 }}>Claim</div>
            <p style={{ fontSize: 13, margin: 0, color: '#1e3a8a' }}>{c.claim}</p>
          </div>
          <div style={{ padding: '10px 12px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6 }}>
            <div className="label" style={{ color: '#991b1b', marginBottom: 4 }}>Contradicting Evidence</div>
            <p style={{ fontSize: 13, margin: 0, color: '#7f1d1d' }}>{c.evidence}</p>
          </div>
        </div>
      )}
    </div>
  )
}
