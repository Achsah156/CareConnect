"""
Embedding generation, abstracted behind a simple interface.

Why this is split out: you don't want every test run or local dev session
calling a paid API and depending on network access. The real provider
(OpenAI) and a deterministic local fallback both implement the same
`embed(text) -> list[float]` contract, so the rest of the app never knows
which one it's talking to.

Set EMBEDDING_PROVIDER=local in .env for offline dev/testing.
Set EMBEDDING_PROVIDER=openai (default) for production.
"""
import hashlib
import struct

from openai import OpenAI

from app.core.config import settings

EMBEDDING_DIM = 256  # used by the local fallback; OpenAI's own dim is fixed by the model


class EmbeddingProvider:
    def embed(self, text: str) -> list[float]:
        raise NotImplementedError


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self._client = OpenAI(api_key=settings.openai_api_key)

    def embed(self, text: str) -> list[float]:
        response = self._client.embeddings.create(
            model=settings.embedding_model,
            input=text,
        )
        return response.data[0].embedding


class LocalDeterministicEmbeddingProvider(EmbeddingProvider):
    """
    Deterministic, dependency-free stand-in for OpenAI embeddings.

    NOT semantically meaningful in the way a real embedding model is —
    it won't capture "these two sentences mean similar things" the way
    text-embedding-3-small does. It exists purely so the matching
    pipeline (Chroma indexing, similarity search, re-ranking) can be
    built and tested end-to-end without an API key or network call.
    Swap EMBEDDING_PROVIDER to "openai" before relying on match quality.
    """

    def embed(self, text: str) -> list[float]:
        normalized = text.lower().strip()
        words = normalized.split()

        vector = [0.0] * EMBEDDING_DIM
        for word in words:
            digest = hashlib.sha256(word.encode("utf-8")).digest()
            # Use the hash bytes to deterministically bump several
            # dimensions per word, so word overlap between two texts
            # produces vector overlap.
            for i in range(0, len(digest) - 4, 4):
                idx = struct.unpack("I", digest[i:i + 4])[0] % EMBEDDING_DIM
                vector[idx] += 1.0

        norm = sum(v * v for v in vector) ** 0.5
        if norm > 0:
            vector = [v / norm for v in vector]
        return vector


def get_embedding_provider() -> EmbeddingProvider:
    if settings.embedding_provider == "local":
        return LocalDeterministicEmbeddingProvider()
    return OpenAIEmbeddingProvider()
