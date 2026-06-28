import json

from ..clients.llm import get_llm_client
from ..db_asyncpg import get_pool
from ..schemas import (
    IntentParsed,
    PromptDetail,
    RecommendCandidate,
    RecommendResponse,
    VarianteCowork,
    VariableSchema,
)
from .search import hybrid_search


async def recommend(descripcion: str, limit: int) -> RecommendResponse:
    llm = get_llm_client()
    intent_raw = llm.understand_intent(descripcion)
    intent = IntentParsed(**intent_raw)

    candidates = await hybrid_search(
        query=intent.consulta_expandida,
        dominio_negocio=intent.dominio_negocio,
        tipo_tarea=intent.tipo_tarea,
        limit=limit,
    )

    explanations = llm.explain_candidates(descripcion, [c.model_dump() for c in candidates])
    expl_map = {e["id"]: e["cuando_usarlo"] for e in explanations}

    recommend_candidates = [
        RecommendCandidate(**c.model_dump(), cuando_usarlo=expl_map.get(c.id, ""))
        for c in candidates
    ]

    return RecommendResponse(
        descripcion=descripcion,
        intent=intent,
        total=len(recommend_candidates),
        candidates=recommend_candidates,
    )


async def get_prompt_detail(prompt_id: str) -> PromptDetail | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                pc.id::text, pc.slug, pc.titulo, pc.proposito, pc.cuerpo_canonico,
                pc.variables, pc.dominio_negocio, pc.tipo_tarea, pc.tags,
                pc.destacado, pc.criticidad, pc.datos_sensibles, pc.estado,
                vp.id::text AS variante_id, vp.cuerpo_adaptado
            FROM prompt_canonico pc
            LEFT JOIN variante_plataforma vp
                ON vp.canonico_id = pc.id AND vp.plataforma = 'cowork'
            WHERE pc.id::text = $1
            """,
            prompt_id,
        )
    if row is None:
        return None

    variables_raw = row["variables"]
    if isinstance(variables_raw, str):
        variables_raw = json.loads(variables_raw)
    variables = [VariableSchema(**v) for v in (variables_raw or [])]

    variante = None
    if row["variante_id"]:
        variante = VarianteCowork(
            id=row["variante_id"],
            cuerpo_adaptado=row["cuerpo_adaptado"],
        )

    return PromptDetail(
        id=row["id"],
        slug=row["slug"],
        titulo=row["titulo"],
        proposito=row["proposito"],
        cuerpo_canonico=row["cuerpo_canonico"],
        variables=variables,
        dominio_negocio=list(row["dominio_negocio"]),
        tipo_tarea=list(row["tipo_tarea"]),
        tags=list(row["tags"]),
        destacado=row["destacado"],
        criticidad=row["criticidad"],
        datos_sensibles=row["datos_sensibles"],
        estado=row["estado"],
        variante_cowork=variante,
    )


