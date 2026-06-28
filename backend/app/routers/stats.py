from fastapi import APIRouter, HTTPException

from ..schemas import StatsResponse
from ..services.prompts import get_stats

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
async def adoption_stats():
    """Phase 6 — Global adoption metrics."""
    try:
        return await get_stats()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
