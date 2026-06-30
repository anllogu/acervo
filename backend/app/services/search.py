"""
Phase 2 — Hybrid search: vector cosine + lexical tsvector (Spanish), fused by RRF (k=60).
Phase 5 — Multi-signal re-ranking applied after RRF fusion.
When stub embeddings are active, falls back to lexical-only.
"""
import json

from ..clients.embeddings import get_embedding_client
from ..config import settings
from ..db_asyncpg import get_pool
from ..schemas import FacetsResponse, SearchCandidate
from .ranking import discover_score, multi_signal_score

K_RRF = 60
SOURCE_LIMIT = 50  # candidates per source before fusion

_SIGNALS_SQL = """
    SELECT
        pc.id::text,
        pc.slug, pc.titulo, pc.proposito,
        pc.dominio_negocio, pc.tipo_tarea, pc.tags,
        pc.destacado, pc.criticidad, pc.datos_sensibles,
        pc.variables, pc.creado_en,
        COALESCE(COUNT(ru.id), 0)::int AS uso_count,
        AVG(v.senal::float) AS avg_senal
    FROM prompt_canonico pc
    LEFT JOIN registro_uso ru ON ru.canonico_id = pc.id
    LEFT JOIN valoracion v ON v.canonico_id = pc.id
    WHERE pc.id::text = ANY($1)
    GROUP BY pc.id
"""


def _facet_sql(dominio_negocio: list[str], tipo_tarea: list[str], start_idx: int) -> tuple[str, list]:
    """Return (AND-prefixed SQL snippet, params) for facet filters."""
    parts: list[str] = []
    params: list = []
    idx = start_idx

    if dominio_negocio:
        parts.append(f"dominio_negocio && ${idx}::text[]")
        params.append(dominio_negocio)
        idx += 1

    if tipo_tarea:
        parts.append(f"tipo_tarea && ${idx}::text[]")
        params.append(tipo_tarea)
        idx += 1

    sql = (" AND " + " AND ".join(parts)) if parts else ""
    return sql, params


def _row_to_candidate(r: dict, score: float) -> SearchCandidate:
    variables = r["variables"]
    if isinstance(variables, str):
        variables = json.loads(variables)
    return SearchCandidate(
        id=r["id"],
        slug=r["slug"],
        titulo=r["titulo"],
        proposito=r["proposito"],
        dominio_negocio=list(r["dominio_negocio"]),
        tipo_tarea=list(r["tipo_tarea"]),
        tags=list(r["tags"]),
        destacado=r["destacado"],
        criticidad=r["criticidad"],
        datos_sensibles=r["datos_sensibles"],
        variables_count=len(variables),
        rrf_score=score,
    )


async def hybrid_search(
    query: str,
    dominio_negocio: list[str],
    tipo_tarea: list[str],
    limit: int,
    lenient: bool = False,
) -> list[SearchCandidate]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        vec_ranks: dict[str, int] = {}
        fts_ranks: dict[str, int] = {}

        # ── Vector search (skip when stub embeddings) ──────────────────────
        if settings.embedding_provider != "stub":
            emb_client = get_embedding_client()
            embedding = emb_client.embed(query)
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"

            facet_clause, facet_params = _facet_sql(dominio_negocio, tipo_tarea, start_idx=1)
            limit_idx = 1 + len(facet_params)
            vec_sql = f"""
                SELECT id::text
                FROM prompt_canonico
                WHERE estado != 'deprecada'
                  AND embedding IS NOT NULL
                  {facet_clause}
                ORDER BY embedding <=> '{vec_str}'::vector
                LIMIT ${limit_idx}
            """
            rows = await conn.fetch(vec_sql, *facet_params, SOURCE_LIMIT)
            vec_ranks = {row["id"]: i + 1 for i, row in enumerate(rows)}

        # ── Lexical search ─────────────────────────────────────────────────
        facet_clause, facet_params = _facet_sql(dominio_negocio, tipo_tarea, start_idx=2)
        limit_idx = 2 + len(facet_params)

        if lenient:
            # OR semantics: stem query terms, join with | so any term is enough
            tsquery_expr = (
                "to_tsquery('spanish', "
                "array_to_string("
                "  ARRAY(SELECT lexeme FROM unnest(to_tsvector('spanish', $1)) ORDER BY 1),"
                "  ' | '"
                "))"
            )
        else:
            tsquery_expr = "plainto_tsquery('spanish', $1)"

        fts_sql = f"""
            SELECT id::text
            FROM prompt_canonico
            WHERE estado != 'deprecada'
              AND fts @@ {tsquery_expr}
              {facet_clause}
            ORDER BY ts_rank(fts, {tsquery_expr}) DESC
            LIMIT ${limit_idx}
        """
        try:
            rows = await conn.fetch(fts_sql, query, *facet_params, SOURCE_LIMIT)
            fts_ranks = {row["id"]: i + 1 for i, row in enumerate(rows)}
        except Exception:
            fts_ranks = {}

        # ── RRF fusion ─────────────────────────────────────────────────────
        all_ids = set(vec_ranks) | set(fts_ranks)
        if not all_ids:
            return []

        rrf_scores = {
            id_: (
                (1.0 / (K_RRF + vec_ranks[id_]) if id_ in vec_ranks else 0.0)
                + (1.0 / (K_RRF + fts_ranks[id_]) if id_ in fts_ranks else 0.0)
            )
            for id_ in all_ids
        }

        # Take a wider candidate pool for re-ranking, then trim to limit
        top_ids = sorted(rrf_scores, key=lambda x: rrf_scores[x], reverse=True)[: limit * 3]

        # ── Fetch full rows + ranking signals ──────────────────────────────
        rows = await conn.fetch(_SIGNALS_SQL, top_ids)
        max_rrf = max(rrf_scores[id_] for id_ in top_ids) if top_ids else 1.0

        scored: list[tuple[float, dict]] = []
        for r in rows:
            id_ = r["id"]
            score = multi_signal_score(
                rrf_score=rrf_scores.get(id_, 0.0),
                max_rrf=max_rrf,
                uso_count=r["uso_count"],
                avg_senal=r["avg_senal"],
                creado_en=r["creado_en"],
                destacado=r["destacado"],
            )
            scored.append((score, dict(r)))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [_row_to_candidate(r, s) for s, r in scored[:limit]]


async def get_featured(
    dominio_negocio: list[str],
    tipo_tarea: list[str],
    limit: int,
) -> list[SearchCandidate]:
    pool = await get_pool()

    # Build WHERE clause with facet filters
    parts: list[str] = ["estado != 'deprecada'"]
    params: list = []
    idx = 1

    if dominio_negocio:
        parts.append(f"dominio_negocio && ${idx}::text[]")
        params.append(dominio_negocio)
        idx += 1
    if tipo_tarea:
        parts.append(f"tipo_tarea && ${idx}::text[]")
        params.append(tipo_tarea)
        idx += 1

    where = " AND ".join(parts)
    params.append(limit * 3)  # fetch wider pool for re-ranking
    limit_idx = idx

    async with pool.acquire() as conn:
        id_rows = await conn.fetch(
            f"SELECT id::text FROM prompt_canonico WHERE {where} ORDER BY creado_en DESC LIMIT ${limit_idx}",
            *params,
        )
        if not id_rows:
            return []

        top_ids = [r["id"] for r in id_rows]
        rows = await conn.fetch(_SIGNALS_SQL, top_ids)

    scored: list[tuple[float, dict]] = []
    for r in rows:
        score = discover_score(
            uso_count=r["uso_count"],
            avg_senal=r["avg_senal"],
            creado_en=r["creado_en"],
            destacado=r["destacado"],
        )
        scored.append((score, dict(r)))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [_row_to_candidate(r, s) for s, r in scored[:limit]]


async def get_facets() -> FacetsResponse:
    pool = await get_pool()
    async with pool.acquire() as conn:
        dom_rows = await conn.fetch(
            """
            SELECT DISTINCT unnest(dominio_negocio) AS val
            FROM prompt_canonico
            WHERE estado != 'deprecada'
            ORDER BY val
            """
        )
        tarea_rows = await conn.fetch(
            """
            SELECT DISTINCT unnest(tipo_tarea) AS val
            FROM prompt_canonico
            WHERE estado != 'deprecada'
            ORDER BY val
            """
        )
    return FacetsResponse(
        dominio_negocio=[r["val"] for r in dom_rows],
        tipo_tarea=[r["val"] for r in tarea_rows],
    )
