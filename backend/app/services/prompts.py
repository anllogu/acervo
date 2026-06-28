from ..db_asyncpg import get_pool
from ..schemas import MyPromptSummary, MyPromptsResponse, StatsResponse


async def get_my_prompts(owner: str) -> MyPromptsResponse:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                pc.id::text,
                pc.slug,
                pc.titulo,
                pc.proposito,
                pc.estado,
                pc.criticidad,
                pc.datos_sensibles,
                pc.destacado,
                pc.creado_en,
                jsonb_array_length(pc.variables) AS variables_count
            FROM prompt_canonico pc
            WHERE pc.owner = $1
            ORDER BY pc.creado_en DESC
            """,
            owner,
        )
    prompts = [
        MyPromptSummary(
            id=row["id"],
            slug=row["slug"],
            titulo=row["titulo"],
            proposito=row["proposito"],
            estado=row["estado"],
            criticidad=row["criticidad"],
            datos_sensibles=row["datos_sensibles"],
            destacado=row["destacado"],
            variables_count=row["variables_count"],
            creado_en=row["creado_en"].isoformat(),
        )
        for row in rows
    ]
    return MyPromptsResponse(owner=owner, total=len(prompts), prompts=prompts)


async def get_stats() -> StatsResponse:
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_prompts = await conn.fetchval("SELECT COUNT(*) FROM prompt_canonico")
        total_usos = await conn.fetchval("SELECT COUNT(*) FROM registro_uso")
        total_pos = await conn.fetchval("SELECT COUNT(*) FROM valoracion WHERE senal = 1")
        total_neg = await conn.fetchval("SELECT COUNT(*) FROM valoracion WHERE senal = -1")
        prompts_week = await conn.fetchval(
            "SELECT COUNT(*) FROM prompt_canonico WHERE creado_en > now() - interval '7 days'"
        )
        usos_week = await conn.fetchval(
            "SELECT COUNT(*) FROM registro_uso WHERE ts > now() - interval '7 days'"
        )
    return StatsResponse(
        total_prompts=int(total_prompts),
        total_usos=int(total_usos),
        total_valoraciones_positivas=int(total_pos),
        total_valoraciones_negativas=int(total_neg),
        prompts_this_week=int(prompts_week),
        usos_this_week=int(usos_week),
    )
