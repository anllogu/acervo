"""
Phase 5 — Multi-signal ranking.
Combines: relevance (RRF), capped usage, avg rating, recency, featured flag.
"""
import math
from datetime import datetime, timezone

USO_CAP = 20
RECENCY_HALF_LIFE_DAYS = 90.0


def _recencia(creado_en: datetime) -> float:
    age_days = (datetime.now(timezone.utc) - creado_en).total_seconds() / 86400.0
    return math.exp(-age_days / RECENCY_HALF_LIFE_DAYS)


def _norm_val(avg_senal: float | None) -> float:
    if avg_senal is None:
        return 0.5  # neutral when no ratings
    return (float(avg_senal) + 1.0) / 2.0  # [-1, 1] → [0, 1]


def multi_signal_score(
    *,
    rrf_score: float,
    max_rrf: float,
    uso_count: int,
    avg_senal: float | None,
    creado_en: datetime,
    destacado: bool,
) -> float:
    """Search ranking: relevance-first, modulated by usage, rating, recency, featured."""
    norm_rrf = rrf_score / max_rrf if max_rrf > 0 else 0.0
    capped_uso = min(uso_count, USO_CAP) / USO_CAP
    return (
        0.50 * norm_rrf
        + 0.15 * capped_uso
        + 0.20 * _norm_val(avg_senal)
        + 0.10 * _recencia(creado_en)
        + 0.05 * (1.0 if destacado else 0.0)
    )


def discover_score(
    *,
    uso_count: int,
    avg_senal: float | None,
    creado_en: datetime,
    destacado: bool,
) -> float:
    """Discover ranking: no relevance signal; rating + featured guard against popularity loop."""
    capped_uso = min(uso_count, USO_CAP) / USO_CAP
    return (
        0.25 * capped_uso
        + 0.35 * _norm_val(avg_senal)
        + 0.20 * _recencia(creado_en)
        + 0.20 * (1.0 if destacado else 0.0)
    )
