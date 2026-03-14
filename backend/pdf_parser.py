import fitz
import re

ESG_SECTIONS = {
    "emissions": ["scope 1", "scope 2", "scope 3", "ghg", "greenhouse", "carbon emissions", "co2"],
    "energy": ["energy consumption", "renewable energy", "electricity", "fuel", "energy intensity"],
    "water": ["water usage", "water consumption", "water withdrawal", "water management"],
    "waste": ["waste generation", "recycling", "waste management", "landfill"],
    "governance": ["board", "governance", "compliance", "ethics", "audit", "remuneration"],
    "social": ["employee", "health and safety", "diversity", "human rights", "labor", "community"],
    "supply_chain": ["supplier", "supply chain", "procurement", "logistics", "vendor"],
    "climate_risk": ["climate risk", "physical risk", "transition risk", "tcfd", "climate scenario"],
    "commitments": ["target", "goal", "commitment", "pledge", "net zero", "carbon neutral"],
    "finance": ["green bond", "sustainability-linked", "esg financing", "sustainable finance"],
}


def detect_section(text: str) -> str:
    lower = text.lower()
    best = "general"
    best_count = 0
    for section, keywords in ESG_SECTIONS.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count > best_count:
            best_count = count
            best = section
    return best


def extract_tables_from_page(page) -> list[dict]:
    tables = []
    try:
        tabs = page.find_tables()
        for tab in tabs.tables:
            df_data = tab.extract()
            if df_data and len(df_data) > 1:
                tables.append({
                    "header": df_data[0] if df_data else [],
                    "rows": df_data[1:] if len(df_data) > 1 else [],
                    "text": " | ".join(str(cell) for row in df_data for cell in row if cell)
                })
    except Exception:
        pass
    return tables


def extract_document(file_bytes: bytes) -> dict:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    full_text = ""
    all_tables = []

    for i, page in enumerate(doc):
        text = page.get_text("text")
        tables = extract_tables_from_page(page)
        section = detect_section(text)
        pages.append({
            "page": i + 1,
            "text": text,
            "section": section,
            "tables": tables,
            "char_count": len(text),
        })
        full_text += text + "\n"
        all_tables.extend(tables)

    metadata = {
        "page_count": len(pages),
        "total_chars": len(full_text),
        "table_count": len(all_tables),
    }
    try:
        meta = doc.metadata
        metadata.update({
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "created": meta.get("creationDate", ""),
        })
    except Exception:
        pass

    return {
        "full_text": full_text,
        "pages": pages,
        "tables": all_tables,
        "metadata": metadata,
    }
