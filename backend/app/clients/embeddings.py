from typing import Protocol
from ..config import settings


class EmbeddingClient(Protocol):
    def embed(self, text: str) -> list[float]: ...


class StubEmbeddingClient:
    """Zero-vector stub. Replace with real provider after ⚠ CONFIRMAR with Ángel."""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def embed(self, text: str) -> list[float]:
        return [0.0] * self.dim


def get_embedding_client() -> EmbeddingClient:
    if settings.embedding_provider == "stub":
        return StubEmbeddingClient(settings.embedding_dim)
    raise NotImplementedError(
        f"Embedding provider '{settings.embedding_provider}' not yet wired. "
        "Confirm provider with Ángel and implement here."
    )
