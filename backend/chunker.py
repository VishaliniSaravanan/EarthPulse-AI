import re
from pdf_parser import detect_section

TARGET_MIN = 300
TARGET_MAX = 600  # approx chars ( for MiniLM)

def _approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def semantic_chunk(pages: list[dict], company: str, sector: str) -> list[dict]:
    """
    Group text by detected ESG section. Within each section,
    split on sentence boundaries trying to stay within token budget.
    Tables are kept as single chunks with their section.
    """
    chunks = []
    section_buffers: dict[str, list] = {}

    # Group pages by section
    for page in pages:
        sec = page["section"]
        if sec not in section_buffers:
            section_buffers[sec] = []
        section_buffers[sec].append({
            "page": page["page"],
            "text": page["text"],
            "tables": page["tables"],
        })

    for section, page_group in section_buffers.items():
        # First add tables as dedicated chunks
        for pg in page_group:
            for table in pg["tables"]:
                ttext = table["text"].strip()
                if len(ttext) > 30:
                    chunks.append({
                        "text": f"[TABLE] {ttext}",
                        "section": section,
                        "page": pg["page"],
                        "company": company,
                        "sector": sector,
                        "chunk_type": "table",
                    })

        # Combine all text for this section
        combined = " ".join(pg["text"] for pg in page_group)
        sentences = re.split(r'(?<=[.!?])\s+', combined)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

        buffer = []
        buffer_len = 0
        start_page = page_group[0]["page"] if page_group else 1

        for sent in sentences:
            sent_len = _approx_tokens(sent)
            if buffer_len + sent_len > TARGET_MAX and buffer:
                chunk_text = " ".join(buffer).strip()
                if len(chunk_text) > 50:
                    chunks.append({
                        "text": chunk_text,
                        "section": section,
                        "page": start_page,
                        "company": company,
                        "sector": sector,
                        "chunk_type": "text",
                    })
                buffer = [sent]
                buffer_len = sent_len
            else:
                buffer.append(sent)
                buffer_len += sent_len

        if buffer:
            chunk_text = " ".join(buffer).strip()
            if len(chunk_text) > 50:
                chunks.append({
                    "text": chunk_text,
                    "section": section,
                    "page": start_page,
                    "company": company,
                    "sector": sector,
                    "chunk_type": "text",
                })

    return chunks
