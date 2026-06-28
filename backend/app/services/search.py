"""
Phase 2 — Hybrid search: vector cosine + lexical tsvector (Spanish), fused by RRF (k=60).
When stub embeddings are active, falls back to lexical-only.
"""
import json

from ..clients.embeddings import get_embedding_client
from ..config import settings
from ..db_asyncpg import get_pool
from ..schemas import FacetsResponse, SearchCandidate

K_RRF = 60
SOURCE_LIMIT = 50  # candidates per source before fusion


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


async def hybrid_search(
    query: str,
    dominio_negocio: list[str],
    tipo_tarea: list[str],
    limit: int,
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
        # $1 = query text; facet params follow; final param = SOURCE_LIMIT
        facet_clause, facet_params = _facet_sql(dominio_negocio, tipo_tarea, start_idx=2)
        limit_idx = 2 + len(facet_params)
        fts_sql = f"""
            SELECT id::text
            FROM prompt_canonico
            WHERE estado != 'deprecada'
              AND fts @@ plainto_tsquery('spanish', $1)
              {facet_clause}
            ORDER BY ts_rank(fts, plainto_tsquery('spanish', $1)) DESC
            LIMIT ${limit_idx}
        """
        try:
            rows = await conn.fetch(fts_sql, query, *facet_params, SOURCE_LIMIT)
            fts_ranks = {row["id"]: i + 1 for i, row in enumerate(rows)}
        except Exception:
            # plainto_tsquery may fail on trivial / empty-stem queries
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

        top_ids = sorted(rrf_scores, key=lambda x: rrf_scores[x], reverse=True)[:limit]

        # ── Fetch full rows for top candidates ─────────────────────────────
        rows = await conn.fetch(
            """
            SELECT id::text, slug, titulo, proposito,
                   dominio_negocio, tipo_tarea, tags,
                   destacado, criticidad, datos_sensibles, variables
            FROM prompt_canonico
            WHERE id::text = ANY($1)
            """,
            top_ids,
        )
        row_map = {r["id"]: r for r in rows}

        results: list[SearchCandidate] = []
        for id_ in top_ids:
            if id_ not in row_map:
                continue
            r = row_map[id_]
            variables = r["variables"]
            if isinstance(variables, str):
                variables = json.loads(variables)
            results.append(
                SearchCandidate(
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
                    rrf_score=rrf_scores[id_],
                )
            )

        return results


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
