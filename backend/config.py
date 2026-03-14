import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance

COLLECTION = "esg_platform"
EMBED_DIM = 384

os.makedirs("qdrant_db", exist_ok=True)

client = QdrantClient(path="qdrant_db")


def init_collection():
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


init_collection()
