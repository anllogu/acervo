import re

from ..clients.llm import get_llm_client
from ..db_asyncpg import get_pool
from ..schemas import FillQuestion, FillQuestionsResponse, FillResponse
from .rating import log_uso
from .recommend import get_prompt_detail


async def get_fill_questions(prompt_id: str) -> FillQuestionsResponse | None:
    detail = await get_prompt_detail(prompt_id)
    if detail is None:
        return None

    llm = get_llm_client()
    raw_questions = llm.generate_fill_questions([v.model_dump() for v in detail.variables])
    q_map = {q["nombre"]: q["pregunta"] for q in raw_questions}

    questions = [
        FillQuestion(
            nombre=v.nombre,
            pregunta=q_map.get(v.nombre, f"¿Cuál es el valor para '{v.nombre}'?"),
            descripcion=v.descripcion,
            obligatorio=v.obligatorio,
        )
        for v in detail.variables
    ]

    return FillQuestionsResponse(
        prompt_id=prompt_id,
        titulo=detail.titulo,
        questions=questions,
    )


async def fill_prompt(prompt_id: str, respuestas: dict[str, str], usuario: str) -> FillResponse | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT pc.titulo, vp.cuerpo_adaptado
            FROM prompt_canonico pc
            JOIN variante_plataforma vp
                ON vp.canonico_id = pc.id AND vp.plataforma = 'cowork'
            WHERE pc.id::text = $1
            """,
            prompt_id,
        )
    if row is None:
        return None

    texto = row["cuerpo_adaptado"]
    for nombre, valor in respuestas.items():
        texto = re.sub(r"\{\{" + re.escape(nombre) + r"\}\}", valor, texto)

    await log_uso(prompt_id, usuario)

    return FillResponse(
        prompt_id=prompt_id,
        titulo=row["titulo"],
        prompt_relleno=texto,
    )
