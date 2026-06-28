from fastapi import APIRouter, HTTPException

from ..schemas import RateRequest
from ..services.rating import rate_prompt

router = APIRouter(tags=["signals"])


@router.post("/prompts/{prompt_id}/rate", status_code=204)
async def rate(prompt_id: str, req: RateRequest):
    """Phase 5 — Record +1/-1 rating. One rating per user per prompt (upsert)."""
    try:
        await rate_prompt(prompt_id, req.usuario, req.senal)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
