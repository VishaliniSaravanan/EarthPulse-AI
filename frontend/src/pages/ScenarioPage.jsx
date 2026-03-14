import { useState } from 'react'
import { runOptimization } from '../utils/api'
import { Spinner, EmptyState } from '../components/ui'
import { Zap, TrendingUp, CheckCircle } from 'lucide-react'

export default function ScenarioPage({ data, company }) {
  if (!company) return <EmptyState icon="SC" title="No report loaded" desc="Upload a report to simulate ESG scenarios." />

  const [scenario, setScenario] = useState('all')
  const [params, setParams] = useState({ target_renewable_pct: 80, supply_chain_reduction_pct: 20, emissions_reduction_pct: 30 })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const res = await runOptimization(company, scenario, params)
      setResult(res)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally { setLoading(false) }
  }

  const scenarioColors = {
    renewable_transition: 'var(--green)',
    supply_chain_restructure: 'var(--accent)',
    emissions_reduction: 'var(--orange)',
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div className="card">
        <div className="card-header"><Zap size={14} style={{ color: 'var(--accent)' }} /><span style={{ fontWeight: 600 }}>Scenario Simulation</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 5 }}>Scenario</div>
              <select value={scenario} onChange={e => setScenario(e.target.value)}>
                <option value="all">All Scenarios</option>
                <option value="renewable_transition">Renewable Transition</option>
                <option value="supply_chain_restructure">Supply Chain Restructure</option>
                <option value="emissions_reduction">Emissions Reduction</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 5 }}>Target Renewable %</div>
                <input type="number" min={0} max={100} value={params.target_renewable_pct}
                  onChange={e => setParams(p => ({ ...p, target_renewable_pct: Number(e.target.value) }))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 5 }}>Supply Chain Reduction %</div>
                <input type="number" min={0} max={100} value={params.supply_chain_reduction_pct}
                  onChange={e => setParams(p => ({ ...p, supply_chain_reduction_pct: Number(e.target.value) }))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 5 }}>Emissions Reduction %</div>
                <input type="number" min={0} max={100} value={params.emissions_reduction_pct}
                  onChange={e => setParams(p => ({ ...p, emissions_reduction_pct: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? <><Spinner size={14} />Running...</> : <><Zap size={14} />Simulate</>}
          </button>
          {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>Error: {error}</div>}
        </div>
      </div>

      {/* Baseline */}
      {(result || data?.metrics) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            ['Current ESG Score', result?.current_esg_score ?? data?.metrics?.esg_scores?.composite, ''],
            ['Scope 1', result?.current_scope1 ?? data?.metrics?.scope1, 'tCO₂'],
            ['Scope 2', result?.current_scope2 ?? data?.metrics?.scope2, 'tCO₂'],
            ['Scope 3', result?.current_scope3 ?? data?.metrics?.scope3, 'tCO₂'],
          ].map(([label, val, unit]) => (
            <div key={label} className="metric-block">
              <div className="metric-label">{label} (baseline)</div>
              <div className="metric-value" style={{ fontSize: 16 }}>
                {val != null ? (val >= 1e6 ? (val/1e6).toFixed(1)+'M' : val >= 1e3 ? (val/1e3).toFixed(1)+'K' : Number(val).toFixed(1)) : '—'}
                <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 3 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {result?.scenarios && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(result.scenarios).map(([key, s]) => (
            <div key={key} className="card" style={{ borderLeft: `3px solid ${scenarioColors[key] || 'var(--accent)'}` }}>
              <div className="card-header">
                <TrendingUp size={14} style={{ color: scenarioColors[key] }} />
                <span style={{ fontWeight: 600 }}>{s.scenario}</span>
                {result.recommended_scenario === key && (
                  <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Recommended</span>
                )}
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {s.esg_score_change !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">ESG Score Change</div>
                      <div className="metric-value" style={{ color: 'var(--green)' }}>+{s.esg_score_change}</div>
                    </div>
                  )}
                  {s.new_esg_score !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">New ESG Score</div>
                      <div className="metric-value">{s.new_esg_score}</div>
                    </div>
                  )}
                  {s.scope2_reduction_tco2 !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">Scope 2 Reduction</div>
                      <div className="metric-value" style={{ color: 'var(--green)', fontSize: 15 }}>
                        {s.scope2_reduction_tco2 >= 1e3 ? (s.scope2_reduction_tco2/1e3).toFixed(1)+'K' : s.scope2_reduction_tco2} tCO₂
                      </div>
                    </div>
                  )}
                  {s.scope3_reduction_tco2 !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">Scope 3 Reduction</div>
                      <div className="metric-value" style={{ color: 'var(--green)', fontSize: 15 }}>
                        {s.scope3_reduction_tco2 >= 1e3 ? (s.scope3_reduction_tco2/1e3).toFixed(1)+'K' : s.scope3_reduction_tco2} tCO₂
                      </div>
                    </div>
                  )}
                  {s.scope1_reduction_tco2 !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">Scope 1 Reduction</div>
                      <div className="metric-value" style={{ color: 'var(--green)', fontSize: 15 }}>
                        {s.scope1_reduction_tco2 >= 1e3 ? (s.scope1_reduction_tco2/1e3).toFixed(1)+'K' : s.scope1_reduction_tco2} tCO₂
                      </div>
                    </div>
                  )}
                  {s.investment_required_m !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">Investment Required</div>
                      <div className="metric-value" style={{ fontSize: 15 }}>${s.investment_required_m}M</div>
                    </div>
                  )}
                  {s.cost_increase_pct !== undefined && (
                    <div className="metric-block">
                      <div className="metric-label">Cost Change</div>
                      <div className="metric-value" style={{ color: 'var(--orange)', fontSize: 15 }}>+{s.cost_increase_pct}%</div>
                    </div>
                  )}
                </div>
                {s.financing_eligibility?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Financing:</span>
                    {s.financing_eligibility.map(f => (
                      <span key={f} className="badge badge-green">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {result.sustainability_linked_loan_eligible && (
            <div className="alert alert-success" style={{ fontSize: 13 }}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} />
              This company qualifies for Sustainability-Linked Loan (SLL) instruments based on ESG performance.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
