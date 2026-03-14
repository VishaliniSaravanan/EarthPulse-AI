import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Core analysis ─────────────────────────────────────────────────────────────
export const analyzeESG = (file, company, sector, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  form.append('company', company)
  form.append('sector', sector)
  return api.post('/analyze', form, {
    // Allow up to 100 MB uploads — increase default timeout for large files
    timeout: 600000, // 10 minutes
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: e => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  }).then(r => r.data)
}

// Report fetcher (URL -> blob, then re-upload)
/**
 * Fetch a remote ESG report via the backend proxy.
 * Returns a File object that can be passed directly to analyzeESG().
 */
export const fetchReportFromUrl = async (url) => {
  const res = await fetch(`/api/fetch_report?url=${encodeURIComponent(url)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  // Derive filename from URL
  const rawName = url.split('/').pop().split('?')[0]
  const filename = rawName && rawName.length > 3 ? rawName : 'esg-report.pdf'
  return new File([blob], filename, { type: blob.type || 'application/pdf' })
}

// ── Query engine ──────────────────────────────────────────────────────────────
export const queryESG = (question, company, section) =>
  api.post('/query', { question, company, section }).then(r => r.data)

// ── Greenwashing ──────────────────────────────────────────────────────────────
export const getGreenwashing = (company) =>
  api.get(`/greenwashing/${encodeURIComponent(company)}`).then(r => r.data)

// ── Graphs ────────────────────────────────────────────────────────────────────
export const getHyperRAGGraph = (company) =>
  api.get(`/graph/hyperrag/${encodeURIComponent(company)}`).then(r => r.data)

export const getDiscourseGraph = (company) =>
  api.get(`/graph/discourse/${encodeURIComponent(company)}`).then(r => r.data)

// ── Supply Chain ──────────────────────────────────────────────────────────────
export const getSupplyChain = (company) =>
  api.get(`/supply_chain/${encodeURIComponent(company)}`).then(r => r.data)

// ── Credit Score ──────────────────────────────────────────────────────────────
export const getCreditScore = (company) =>
  api.get(`/esg_credit_score/${encodeURIComponent(company)}`).then(r => r.data)

// ── Benchmark ─────────────────────────────────────────────────────────────────
export const getBenchmark = (company) =>
  api.get(`/esg_benchmark/${encodeURIComponent(company)}`).then(r => r.data)

// ── Climate Risk ──────────────────────────────────────────────────────────────
export const getClimateRisk = (company) =>
  api.get(`/climate_risk/${encodeURIComponent(company)}`).then(r => r.data)

// ── Scenario simulation ───────────────────────────────────────────────────────
export const runOptimization = (company, scenario, params) =>
  api.post('/sustainability_optimization', { company, scenario, params }).then(r => r.data)

// ── Companies list ────────────────────────────────────────────────────────────
export const getCompanies = () =>
  api.get('/companies').then(r => r.data)

// ── Health check ──────────────────────────────────────────────────────────────
export const healthCheck = () =>
  api.get('/health').then(r => r.data)

// ── PDF text (for PDF Analyzer inline viewer) ─────────────────────────────────
export const getPdfText = (company) =>
  api.get(`/pdf_text/${encodeURIComponent(company)}`).then(r => r.data)