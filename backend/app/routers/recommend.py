from fastapi import APIRouter, Body, HTTPException

from ..schemas import PromptDetail, RecommendRequest, RecommendResponse
from ..services.rating import log_uso
from ..services.recommend import get_prompt_detail, recommend

router = APIRouter(tags=["recommend"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_endpoint(req: RecommendRequest):
    try:
        return await recommend(req.descripcion, req.limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/prompts/{prompt_id}", response_model=PromptDetail)
async def get_prompt(prompt_id: str):
    try:
        detail = await get_prompt_detail(prompt_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    return detail


@router.post("/prompts/{prompt_id}/use", status_code=204)
async def use_prompt(prompt_id: str, usuario: str = Body(default="anonymous", embed=True)):
    try:
        await log_uso(prompt_id, usuario)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
