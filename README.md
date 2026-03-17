# EarthPulse AI — Climate Risk & Multimodal Document Intelligence RAG Platform

An end-to-end AI-powered platform designed to analyze corporate ESG (Environmental, Social, Governance) reports and generate actionable insights. It ingests PDF disclosures, extracts structured data, builds semantic and graph-based intelligence layers, and delivers advanced analytics like climate risk scoring, greenwashing detection, ESG credit ratings, and financing recommendations through an interactive dashboard.

## Architecture

```
PDF Upload
  → PyMuPDF parsing (text + tables per page)
  → Section detection (emissions/energy/water/governance/supply_chain/...)
  → Semantic chunking (300-600 token, section-aware, overlap)
  → MiniLM-L6 embedding (384-dim)
  → Qdrant local vector store (cosine similarity, metadata filtering)
  → HyperRAG graph traversal (sequential + cross-section edges)
  → Discourse graph (claim/evidence nodes, contradiction/support edges)
  → ESG metrics extraction (regex: Scope 1/2/3, revenue, renewable %, ...)
  → Supply chain extraction (supplier/logistics pattern matching)
  → Climate risk scoring (sector-adjusted + TCFD keyword analysis)
  → ESG-CAM credit model (C/A/M/E/S components → rating)
  → Financing recommendations (ICMA-aligned instruments)
  → React dashboard (9 pages)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Flask + Flask-CORS |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (~90MB) |
| Vector DB | Qdrant (local file mode, `qdrant_db/`) |
| Graphs | NetworkX (HyperRAG + Discourse) |
| PDF | PyMuPDF (fitz) — text + table extraction |
| ML | scikit-learn (optional utilities) |

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

> First run downloads MiniLM model (~90MB) to `~/.cache/huggingface/`

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Pages

| Page | Description |
|------|-------------|
| Upload Report | PDF upload with pipeline progress visualization |
| ESG Metrics | Scope 1/2/3, carbon intensity, renewable %, ESG-CAM, radar chart |
| Query Engine | HyperRAG semantic search with section filtering |
| Greenwashing | Discourse graph contradiction detection + vague claim analysis |
| Supply Chain | Supplier extraction, risk scoring, force-directed network graph |
| Climate Risk | Hazard scores, transition risk, TCFD quality, scenario analysis |
| Financing | ESG-CAM credit rating, ICMA instrument recommendations |
| Scenarios | Simulate renewable transition / supply restructure / emissions reduction |
| Graphs | Interactive canvas HyperRAG + discourse knowledge graphs |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/analyze` | POST | Full analysis pipeline |
| `/api/query` | POST | Graph-Augmented RAG query |
| `/api/greenwashing/:company` | GET | Greenwashing report |
| `/api/graph/hyperrag/:company` | GET | Graph-Augmented RAG graph data |
| `/api/graph/discourse/:company` | GET | Discourse graph data |
| `/api/supply_chain/:company` | GET | Supply chain data |
| `/api/esg_credit_score/:company` | GET | ESG-CAM + financing |
| `/api/esg_benchmark/:company` | GET | Sector benchmarking |
| `/api/climate_risk/:company` | GET | Climate risk report |
| `/api/sustainability_optimization` | POST | Scenario simulation |
| `/api/companies` | GET | List analyzed companies |

## File Structure

```
esg-platform/
├── backend/
│   ├── app.py              Flask API — all 12 endpoints
│   ├── config.py           Qdrant initialization
│   ├── embeddings.py       MiniLM embedding engine (lazy loaded)
│   ├── pdf_parser.py       PyMuPDF + table extraction + section detection
│   ├── chunker.py          Semantic section-aware chunking
│   ├── vector_store.py     Qdrant upsert/search/delete + company filter
│   ├── hyperrag.py         NetworkX HyperRAG graph + multi-hop retrieval
│   ├── discourse_graph.py  Claim/evidence/contradiction detection
│   ├── esg_metrics.py      Full metric extraction + ESG score computation
│   ├── supply_chain.py     Supplier/logistics extraction + optimization recs
│   ├── climate_risk.py     Sector-adjusted climate hazard scoring
│   ├── esg_credit.py       ESG-CAM model + financing recommendations
│   ├── benchmarking.py     In-memory sector benchmark registry
│   ├── scenario_sim.py     Renewable/supply/emissions scenario simulation
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx                  Sidebar layout + routing
    │   ├── components/
    │   │   └── ui.jsx               Shared: Spinner, MetricBlock, ScoreGauge, ForceGraph, ...
    │   ├── pages/
    │   │   ├── UploadPage.jsx       PDF upload + pipeline steps
    │   │   ├── MetricsPage.jsx      Full metrics dashboard
    │   │   ├── QueryPage.jsx        HyperRAG query engine
    │   │   ├── GreenwashingPage.jsx Contradiction explorer
    │   │   ├── SupplyChainPage.jsx  Network graph + tables
    │   │   ├── ClimateRiskPage.jsx  Hazard scores + scenarios
    │   │   ├── FinancingPage.jsx    ESG-CAM + ICMA instruments
    │   │   ├── ScenarioPage.jsx     Strategy simulation
    │   │   └── GraphsPage.jsx       Canvas force graphs
    │   └── utils/api.js             Axios API layer
    ├── index.html
    ├── package.json
    └── vite.config.js
```
