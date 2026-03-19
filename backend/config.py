import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance

COLLECTION = "esg_platform"
EMBED_DIM = 384

# Use an absolute path so Qdrant storage works regardless of working directory (Render/docker safe).
QDRANT_PATH = os.path.join(os.path.dirname(__file__), "qdrant_db")
os.makedirs(QDRANT_PATH, exist_ok=True)

client = QdrantClient(path=QDRANT_PATH)


def init_collection():
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


init_collection()
