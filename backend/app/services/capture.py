"""
Phase 1 business logic: embed, deduplicate, generate metadata, persist.
All DB operations via native asyncpg to avoid ::cast + named-param conflicts.
"""
import json
import re
import unicodedata
import uuid

import asyncpg

from ..clients.embeddings import get_embedding_client
from ..clients.llm import get_llm_client
from ..config import settings
from ..schemas import DuplicadoCandidato, MetadataPropuesta

DUPLICATE_THRESHOLD = 0.85  # (calibrar en PoC)
DUPLICATE_LIMIT = 5

INSERT_CANONICO = """
    INSERT INTO prompt_canonico (
        slug, titulo, proposito, cuerpo_canonico, tipo,
        variables, formato_salida, ejemplos,
        dominio_negocio, tipo_tarea, tags,
        criticidad, datos_sensibles,
        owner, visibilidad, estado, embedding
    ) VALUES (
        $1, $2, $3, $4, $5::tipo_prompt,
        $6::jsonb, $7, $8::jsonb,
        $9::text[], $10::text[], $11::text[],
        $12::criticidad_tipo, $13,
        $14, $15::visibilidad_tipo, 'en_uso'::estado_ciclo, $16::vector
    )
    RETURNING id::text
"""

INSERT_VARIANTE = """
    INSERT INTO variante_plataforma (
        canonico_id, plataforma, cuerpo_adaptado, tipo_adaptacion, creado_por
    ) VALUES (
        $1::uuid, 'cowork', $2, 'formato'::tipo_adaptacion, $3
    )
    RETURNING id::text
"""


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:50] or "prompt"


async def _unique_slug(conn: asyncpg.Connection, titulo: str) -> str:
    base = _slugify(titulo)
    slug = base
    n = 1
    while await conn.fetchval("SELECT 1 FROM prompt_canonico WHERE slug = $1", slug):
        slug = f"{base}-{n}"
        n += 1
    return slug


async def find_duplicates(
    conn: asyncpg.Connection,
    embedding: list[float],
) -> list[DuplicadoCandidato]:
    # Stub embeddings are all zeros: cosine distance is undefined (NaN).
    # Skip similarity search when using stub to avoid misleading results.
    if settings.embedding_provider == "stub":
        return []

    vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
    rows = await conn.fetch(f"""
        SELECT id::text, slug, titulo,
               round((1 - (embedding <=> '{vec_str}'::vector))::numeric, 4) AS similitud
        FROM prompt_canonico
        WHERE embedding IS NOT NULL
          AND estado != 'deprecada'
          AND (1 - (embedding <=> '{vec_str}'::vector)) > {DUPLICATE_THRESHOLD}
        ORDER BY similitud DESC
        LIMIT {DUPLICATE_LIMIT}
    """)
    return [DuplicadoCandidato(**dict(r)) for r in rows]


async def analyze_capture(texto: str, owner: str) -> dict:
    """Step 1 of capture flow: embed + deduplicate + generate metadata."""
    emb_client = get_embedding_client()
    llm_client = get_llm_client()

    embedding = emb_client.embed(texto)
    metadata_raw = llm_client.generate_metadata(texto)
    metadata = MetadataPropuesta(**metadata_raw)

    from ..db_asyncpg import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        duplicados = await find_duplicates(conn, embedding)

    return {
        "metadata_propuesta": metadata,
        "duplicados_candidatos": duplicados,
    }


async def persist_prompt(
    *,
    texto: str,
    titulo: str,
    metadata: MetadataPropuesta,
    owner: str,
    visibilidad: str,
) -> dict:
    """Step 2 of capture flow: persist canonico + variante cowork."""
    emb_client = get_embedding_client()
    embedding = emb_client.embed(texto)

    from ..db_asyncpg import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            slug = await _unique_slug(conn, titulo)

            canonico_id = await conn.fetchval(
                INSERT_CANONICO,
                slug,
                titulo,
                metadata.proposito,
                texto,
                metadata.tipo,
                json.dumps([v.model_dump() for v in metadata.variables]),
                metadata.formato_salida,
                json.dumps([]),
                metadata.dominio_negocio,
                metadata.tipo_tarea,
                metadata.tags,
                metadata.criticidad,
                metadata.datos_sensibles,
                owner,
                visibilidad,
                embedding,
            )

            variante_id = await conn.fetchval(
                INSERT_VARIANTE,
                canonico_id,
                texto,
                owner,
            )

    return {
        "id": canonico_id,
        "slug": slug,
        "titulo": titulo,
        "estado": "en_uso",
        "variante_cowork_id": variante_id,
    }
