from ..db_asyncpg import get_pool


async def rate_prompt(prompt_id: str, usuario: str, senal: int) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO valoracion (canonico_id, usuario, senal)
            VALUES ($1::uuid, $2, $3)
            ON CONFLICT (canonico_id, usuario)
            DO UPDATE SET senal = EXCLUDED.senal, ts = now()
            """,
            prompt_id,
            usuario,
            senal,
        )


async def log_uso(prompt_id: str, usuario: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        variante_row = await conn.fetchrow(
            "SELECT id FROM variante_plataforma WHERE canonico_id = $1::uuid AND plataforma = 'cowork'",
            prompt_id,
        )
        if variante_row is None:
            return
        await conn.execute(
            """
            INSERT INTO registro_uso (variante_id, canonico_id, usuario)
            VALUES ($1, $2::uuid, $3)
            """,
            variante_row["id"],
            prompt_id,
            usuario,
        )
