"""
vector_store.py  —  fixed for qdrant-client 1.17
  • search()         → client.query_points()   (replaces the old client.search / search_points)
  • delete_company() → FilterSelector wrapper  (required since qdrant-client 1.7)
  • Payloads/vectors sanitized to native Python types for Qdrant local SQLite backend.
"""
import uuid
from embeddings import embed, embed_batch
from config import client, COLLECTION, init_collection
from qdrant_client.http.models import (
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    FilterSelector,
)


def _native_value(v):
    """Recursively convert numpy/other types to native Python for SQLite compatibility."""
    if hasattr(v, "item"):
        return v.item()
    if isinstance(v, dict):
        return {k: _native_value(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_native_value(x) for x in v]
    return v


def index_chunks(chunks: list[dict]) -> int:
    if not chunks:
        return 0
    texts = [c["text"] for c in chunks]
    vectors = embed_batch(texts)
    points = []
    for chunk, vec in zip(chunks, vectors):
        payload = _native_value(chunk)
        vector = [float(x) for x in vec]
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload=payload,
        ))
    for i in range(0, len(points), 100):
        client.upsert(collection_name=COLLECTION, points=points[i:i + 100])
    return len(points)


def search(query: str, k: int = 6, company: str = None, section: str = None) -> list[dict]:
    vec = embed(query)
    vec = [float(x) for x in vec]

    must_filters = []
    if company:
        must_filters.append(FieldCondition(key="company", match=MatchValue(value=company)))
    if section:
        must_filters.append(FieldCondition(key="section", match=MatchValue(value=section)))

    query_filter = Filter(must=must_filters) if must_filters else None

    try:
        response = client.query_points(
            collection_name=COLLECTION,
            query=vec,
            limit=k,
            query_filter=query_filter,
            with_payload=True,
        )
        return [pt.payload for pt in response.points]
    except IndexError:
        # Local Qdrant collection state can be corrupted after a failed/partial upsert.
        # Recreate the collection so the next analyze repopulates it; return empty for this request.
        try:
            client.delete_collection(collection_name=COLLECTION)
        except Exception:
            pass
        init_collection()
        return []


def delete_company(company: str) -> None:
    """Remove all vectors belonging to a company."""
    try:
        client.delete(
            collection_name=COLLECTION,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="company", match=MatchValue(value=company))]
                )
            ),
        )
    except Exception:
        pass


def get_all_companies() -> list[str]:
    companies: set[str] = set()
    offset = None
    while True:
        results, next_offset = client.scroll(
            collection_name=COLLECTION,
            limit=100,
            offset=offset,
            with_payload=True,
        )
        for r in results:
            c = r.payload.get("company")
            if c:
                companies.add(c)
        if next_offset is None:
            break
        offset = next_offset
    return sorted(companies)