"""
Thin wrapper around Chroma. Keeps all vector-store-specific code in one
place so the matching service doesn't need to know Chroma's API surface.

Chroma runs embedded (persisted to disk) for the MVP — no separate server
to deploy or pay for. If this ever needs to scale past a single-process
deployment, swap this module for a hosted vector DB client; the interface
(`upsert`, `query`) stays the same.
"""
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings

_client = None
_collection = None


def get_collection():
    """
    Lazily initializes the Chroma client/collection on first use rather
    than at import time, so importing this module never has side effects
    (useful for tests that don't need the vector store at all).
    """
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(name=settings.chroma_collection_name)
    return _collection


def upsert_situation(situation_id: str, embedding: list[float], metadata: dict) -> None:
    """
    metadata should include situation_type, stage, and has_outcome (bool)
    so we can filter before doing the (more expensive) similarity search.
    """
    collection = get_collection()
    collection.upsert(
        ids=[situation_id],
        embeddings=[embedding],
        metadatas=[metadata],
    )


def query_similar(
    embedding: list[float],
    situation_type: str,
    exclude_id: str,
    top_k: int = 20,
) -> list[dict]:
    """
    Returns up to top_k candidates as dicts with id, distance, metadata.
    Filters to the same situation_type first — comparing a "job rejection"
    situation against "grief" situations isn't useful no matter how similar
    the embedding vectors happen to be, so we narrow the candidate pool
    before ranking on similarity.
    """
    collection = get_collection()
    results = collection.query(
        query_embeddings=[embedding],
        n_results=top_k + 1,  # +1 in case the situation itself is in the results
        where={"situation_type": situation_type},
    )

    candidates = []
    ids = results.get("ids", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    for id_, distance, metadata in zip(ids, distances, metadatas):
        if id_ == exclude_id:
            continue
        candidates.append({"id": id_, "distance": distance, "metadata": metadata})

    return candidates[:top_k]
