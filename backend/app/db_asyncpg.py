"""
Native asyncpg pool — used for all vector operations (similarity search, inserts).
SQLAlchemy (db.py) is kept only for the health check.
"""
import asyncpg
from pgvector.asyncpg import register_vector
from .config import settings

_pool: asyncpg.Pool | None = None


def _asyncpg_url() -> str:
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://")


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(_asyncpg_url(), init=register_vector)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
