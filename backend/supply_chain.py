import re
import networkx as nx

COMPANY_SUPPLY: dict[str, dict] = {}

SUPPLIER_PATTERNS = [
    r"(?:supplier|vendor|partner|contractor|subcontractor)\s+([A-Z][A-Za-z\s&,\.]+?)(?:\s+(?:provides?|supplied?|delivers?|manufactures?))",
    r"([A-Z][A-Za-z\s&]+?)\s+(?:is\s+(?:a|our|the)\s+(?:key\s+)?(?:supplier|vendor|partner))",
    r"(?:sourced?\s+from|purchased?\s+from|supplied?\s+by)\s+([A-Z][A-Za-z\s&,\.]+?)(?:\s|,|\.)",
    r"(?:logistics\s+partner|freight\s+partner|shipping\s+partner)\s+([A-Z][A-Za-z\s&]+)",
]

LOGISTICS_PATTERNS = [
    r"(?:shipped?|transported?|delivered?)\s+(?:via|by|through|using)\s+([A-Z][A-Za-z\s&]+?)(?:\s|,|\.)",
    r"(?:logistics|freight|shipping|transport)\s+(?:partner|company|provider)\s+([A-Z][A-Za-z\s&]+)",
]

HIGH_RISK_KEYWORDS = ["coal", "fossil", "deforestation", "labor violation", "child labor", "pollution", "sanction", "controversy"]
MED_RISK_KEYWORDS = ["emissions", "water stress", "drought", "flood risk", "regulatory"]


def _risk_score_text(text: str) -> tuple[float, str]:
    lower = text.lower()
    if any(k in lower for k in HIGH_RISK_KEYWORDS):
        return 75.0, "high"
    if any(k in lower for k in MED_RISK_KEYWORDS):
        return 45.0, "medium"
    return 20.0, "low"


def extract_supply_chain(text: str, company: str, sector: str) -> dict:
    suppliers = []
    logistics = []
    seen = set()

    for pat in SUPPLIER_PATTERNS:
        for m in re.finditer(pat, text):
            name = m.group(1).strip().rstrip(".,")
            if len(name) > 3 and name not in seen and len(name) < 60:
                seen.add(name)
                risk, rlevel = _risk_score_text(text[max(0, m.start()-200):m.end()+200])
                suppliers.append({
                    "name": name,
                    "type": "supplier",
                    "risk_score": risk,
                    "risk_level": rlevel,
                    "emissions_contribution": round(risk * 0.8, 1),
                    "labor_risk": "high" if rlevel == "high" else "low",
                    "sustainability_score": round(100 - risk, 1),
                })

    for pat in LOGISTICS_PATTERNS:
        for m in re.finditer(pat, text):
            name = m.group(1).strip().rstrip(".,")
            if len(name) > 3 and name not in seen and len(name) < 60:
                seen.add(name)
                logistics.append({
                    "name": name,
                    "type": "logistics",
                    "risk_score": 25.0,
                    "risk_level": "low",
                })

    # Build supply chain graph
    G = nx.DiGraph()
    G.add_node(company, type="company", sector=sector)
    for s in suppliers:
        G.add_node(s["name"], type="supplier", risk=s["risk_level"])
        G.add_edge(company, s["name"], relation="sources_from", weight=s["risk_score"])
    for l in logistics:
        G.add_node(l["name"], type="logistics", risk="low")
        G.add_edge(company, l["name"], relation="ships_via", weight=25.0)

    # Optimization recommendations
    recommendations = []
    high_risk = [s for s in suppliers if s["risk_level"] == "high"]
    for s in high_risk[:5]:
        recommendations.append({
            "action": f"Replace {s['name']} with certified sustainable supplier",
            "carbon_reduction_pct": 20,
            "cost_change_pct": +3,
            "esg_improvement": 15,
            "priority": "high",
        })
    for s in suppliers:
        if s["risk_level"] == "medium":
            recommendations.append({
                "action": f"Engage {s['name']} on emissions reduction targets",
                "carbon_reduction_pct": 10,
                "cost_change_pct": 0,
                "esg_improvement": 8,
                "priority": "medium",
            })

    result = {
        "suppliers": suppliers[:30],
        "logistics": logistics[:10],
        "recommendations": recommendations[:10],
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "high_risk_count": len(high_risk),
        "avg_supplier_risk": round(sum(s["risk_score"] for s in suppliers) / max(1, len(suppliers)), 1),
    }
    COMPANY_SUPPLY[company] = {"graph": G, **result}

    # Graph export
    nodes_export = []
    for n, d in G.nodes(data=True):
        nodes_export.append({"id": n, "type": d.get("type", ""), "risk": d.get("risk", "low")})
    edges_export = [
        {"source": u, "target": v, "relation": d.get("relation", ""), "weight": d.get("weight", 1.0)}
        for u, v, d in G.edges(data=True)
    ]
    result["graph_nodes"] = nodes_export[:50]
    result["graph_edges"] = edges_export[:80]
    return result
