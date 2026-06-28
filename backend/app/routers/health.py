from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..db import get_db
from ..config import settings

router = APIRouter()


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "db": "connected",
        "embedding_provider": settings.embedding_provider,
        "embedding_dim": settings.embedding_dim,
        "llm_provider": settings.llm_provider,
    }
