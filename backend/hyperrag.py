import networkx as nx
from vector_store import search

# company -> NetworkX graph
COMPANY_GRAPHS: dict[str, nx.Graph] = {}
# company -> list of chunk texts
COMPANY_CHUNKS: dict[str, list[dict]] = {}


def build_hyperrag_graph(chunks: list[dict], company: str):
    G = nx.Graph()
    for i, chunk in enumerate(chunks):
        G.add_node(i, text=chunk["text"], section=chunk.get("section", ""), page=chunk.get("page", 0))
    # Sequential edges within same section
    section_indices: dict[str, list[int]] = {}
    for i, chunk in enumerate(chunks):
        sec = chunk.get("section", "general")
        section_indices.setdefault(sec, []).append(i)
    for sec, indices in section_indices.items():
        for j in range(len(indices) - 1):
            G.add_edge(indices[j], indices[j+1], weight=1.0, relation="sequential")
    # Cross-section edges for high similarity keywords
    RELATED = {
        ("emissions", "energy"): 0.8,
        ("emissions", "commitments"): 0.9,
        ("supply_chain", "emissions"): 0.7,
        ("governance", "commitments"): 0.6,
        ("climate_risk", "emissions"): 0.8,
    }
    for (s1, s2), w in RELATED.items():
        nodes_s1 = [i for i, c in enumerate(chunks) if c.get("section") == s1]
        nodes_s2 = [i for i, c in enumerate(chunks) if c.get("section") == s2]
        for n1 in nodes_s1[:3]:
            for n2 in nodes_s2[:3]:
                G.add_edge(n1, n2, weight=w, relation="cross_section")
    COMPANY_GRAPHS[company] = G
    COMPANY_CHUNKS[company] = chunks


def hyperrag_query(query: str, company: str = None, k: int = 4) -> list[dict]:
    hits = search(query, k=k, company=company)
    seen_texts = set()
    context = []
    for h in hits:
        t = h.get("text", "")
        if t and t not in seen_texts:
            seen_texts.add(t)
            context.append(h)
    # Graph expansion
    if company and company in COMPANY_GRAPHS:
        G = COMPANY_GRAPHS[company]
        chunks = COMPANY_CHUNKS[company]
        text_to_idx = {c["text"]: i for i, c in enumerate(chunks)}
        initial_nodes = [text_to_idx[h["text"]] for h in hits if h.get("text") in text_to_idx]
        expanded = set(initial_nodes)
        for node in initial_nodes:
            if node in G:
                for neighbor in G.neighbors(node):
                    if neighbor not in expanded and len(expanded) < k + 8:
                        expanded.add(neighbor)
                        neighbor_text = chunks[neighbor]["text"] if neighbor < len(chunks) else ""
                        if neighbor_text and neighbor_text not in seen_texts:
                            seen_texts.add(neighbor_text)
                            context.append(chunks[neighbor])
    return context[:8]


def get_graph_export(company: str) -> dict:
    if company not in COMPANY_GRAPHS:
        return {"nodes": [], "edges": []}
    G = COMPANY_GRAPHS[company]
    chunks = COMPANY_CHUNKS.get(company, [])
    nodes = []
    for node_id, data in list(G.nodes(data=True))[:80]:
        nodes.append({
            "id": node_id,
            "label": f"C{node_id}",
            "section": data.get("section", ""),
            "text": data.get("text", "")[:100],
            "page": data.get("page", 0),
        })
    edges = []
    for u, v, d in list(G.edges(data=True))[:150]:
        edges.append({"source": u, "target": v, "relation": d.get("relation", ""), "weight": d.get("weight", 1.0)})
    return {"nodes": nodes, "edges": edges}
