import re
import networkx as nx

COMPANY_DG: dict[str, dict] = {}

CLAIM_PATTERNS = [
    r"(?:committed?|pledged?|target(?:ing)?|aim(?:ing)?|strive?|plan(?:ning)?)\s+to\s+[\w\s,]+",
    r"(?:carbon neutral|net.?zero|climate positive|100%?\s+renewable|zero\s+waste)",
    r"(?:sustainable|responsible|ethical|green)\s+(?:sourcing|supply chain|operations|business)",
    r"(?:reduce|cut|eliminate|offset)\s+(?:emissions|carbon|ghg|footprint)",
    r"we\s+(?:are|will be|have been)\s+(?:committed|dedicated|focused)\s+to\s+[\w\s]+",
]

EVIDENCE_PATTERNS = [
    r"emissions?\s+(?:increased|rose|grew|up|higher)\s+by\s+\d+",
    r"(?:failed?|miss(?:ed)?|delayed?|postponed?|cancelled?)\s+[\w\s]+(?:target|goal|commitment)",
    r"(?:fine|penalty|sanction|violation|lawsuit|investigation)\s+(?:of|for|by|against)\s+[\w\s]+",
    r"(?:coal|fossil fuel|oil sands?|deforestation|illegal)\s+[\w\s]+(?:continued?|increased?|expanded?)",
    r"only\s+\d+\.?\d*\s*%\s+renewable",
    r"water\s+(?:consumption|usage|withdrawal)\s+(?:increased?|rose|grew)",
    r"waste\s+(?:increased?|grew|rose)",
    r"carbon\s+intensity\s+(?:increased?|rose|grew|worsened?)",
]

VAGUE_PATTERNS = [
    r"we\s+(?:care|are\s+committed)\s+(?:deeply\s+)?(?:about|to)\s+(?:the\s+)?(?:environment|sustainability|planet)",
    r"sustainability\s+is\s+(?:core|central|fundamental|key)\s+to\s+(?:who\s+we\s+are|our\s+business|our\s+values)",
    r"we\s+(?:strive|aspire|aim)\s+to\s+(?:be|become)\s+(?:a\s+)?(?:sustainable|responsible|green)",
    r"(?:doing|working)\s+our\s+(?:part|best|bit)\s+(?:for|to\s+protect)\s+the\s+(?:planet|environment)",
    r"environmental(?:ly)?\s+(?:conscious|friendly|responsible)\s+(?:company|organization|business)?",
]

CONTRADICTION_RULES = [
    (r"carbon neutral|net.?zero|zero\s+emissions", r"emissions?\s+(?:increased|rose|grew)"),
    (r"100%?\s+renewable", r"only\s+\d+\s*%\s+renewable"),
    (r"reduce\s+(?:carbon|emissions|ghg)", r"emissions?\s+(?:increased|rose|grew)\s+by\s+\d+"),
    (r"sustainable\s+supply\s+chain", r"(?:deforestation|child\s+labor|violation)\s+found"),
    (r"zero\s+waste", r"waste\s+(?:increased|grew|rose)"),
    (r"water\s+(?:neutral|steward)", r"water\s+(?:consumption|usage)\s+(?:increased|rose)"),
    (r"committed?\s+to\s+transparency", r"(?:fine|penalty|investigation|sanction)\s+for"),
    (r"net\s+zero\s+by\s+20[23]\d", r"(?:coal|oil|fossil)\s+(?:plant|expansion|project)\s+(?:opened|built|approved)"),
]


def _split_sentences(text: str) -> list[str]:
    sents = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sents if len(s.strip()) > 20]


def build_discourse_graph(text: str, company: str) -> dict:
    DG = nx.DiGraph()
    sentences = _split_sentences(text)

    claims, evidences, vague = [], [], []

    for sent in sentences:
        low = sent.lower()
        is_claim = any(re.search(p, low) for p in CLAIM_PATTERNS)
        is_evidence = any(re.search(p, low) for p in EVIDENCE_PATTERNS)
        is_vague = any(re.search(p, low) for p in VAGUE_PATTERNS)

        if is_claim:
            claims.append(sent)
            DG.add_node(sent, type="claim")
        if is_evidence:
            evidences.append(sent)
            DG.add_node(sent, type="evidence")
        if is_vague and not is_claim:
            vague.append(sent)
            DG.add_node(sent, type="vague")

    contradictions = []
    for claim in claims:
        for evidence in evidences:
            for c_pat, e_pat in CONTRADICTION_RULES:
                if re.search(c_pat, claim, re.I) and re.search(e_pat, evidence, re.I):
                    DG.add_edge(evidence, claim, relation="contradicts")
                    contradictions.append({
                        "claim": claim[:300],
                        "evidence": evidence[:300],
                        "rule": f"{c_pat[:40]}...",
                        "severity": "high" if "net zero" in claim.lower() or "carbon neutral" in claim.lower() else "medium",
                    })

    # Support edges: evidence that reinforces a claim direction
    for claim in claims:
        for evidence in evidences:
            if not DG.has_edge(evidence, claim):
                # Check if they share keywords suggesting alignment
                claim_words = set(re.findall(r'\b\w{4,}\b', claim.lower()))
                evid_words = set(re.findall(r'\b\w{4,}\b', evidence.lower()))
                shared = claim_words & evid_words
                if len(shared) > 3:
                    DG.add_edge(evidence, claim, relation="supports")

    risk_score = min(100, len(contradictions) * 25 + len(vague) * 5)

    result = {
        "contradictions": contradictions[:20],
        "vague_claims": vague[:15],
        "claims": claims[:20],
        "evidences": evidences[:20],
        "claim_count": len(claims),
        "evidence_count": len(evidences),
        "vague_count": len(vague),
        "contradiction_count": len(contradictions),
        "risk_score": risk_score,
        "risk_level": "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 30 else "LOW",
    }

    COMPANY_DG[company] = {"graph": DG, **result}
    return result


def get_discourse_export(company: str) -> dict:
    if company not in COMPANY_DG:
        return {"nodes": [], "edges": [], "risk_score": 0, "contradictions": [], "vague_claims": []}
    data = COMPANY_DG[company]
    G = data["graph"]
    node_list = list(G.nodes(data=True))
    node_index = {n: i for i, (n, _) in enumerate(node_list)}
    nodes = [
        {"id": i, "label": n[:60], "type": d.get("type", ""), "full": n[:200]}
        for i, (n, d) in enumerate(node_list[:80])
    ]
    edges = [
        {"source": node_index[u], "target": node_index[v], "relation": d.get("relation", "")}
        for u, v, d in G.edges(data=True)
        if u in node_index and v in node_index
    ]
    return {
        "nodes": nodes[:80],
        "edges": edges[:120],
        "risk_score": data.get("risk_score", 0),
        "contradictions": data.get("contradictions", []),
        "vague_claims": data.get("vague_claims", []),
        "risk_level": data.get("risk_level", "LOW"),
    }
