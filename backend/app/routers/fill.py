from fastapi import APIRouter, HTTPException

from ..schemas import FillQuestionsResponse, FillRequest, FillResponse
from ..services.fill import fill_prompt, get_fill_questions

router = APIRouter(tags=["fill"])


@router.get("/prompts/{prompt_id}/fill", response_model=FillQuestionsResponse)
async def fill_questions(prompt_id: str):
    try:
        result = await get_fill_questions(prompt_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Prompt no encontrado")
    return result


@router.post("/prompts/{prompt_id}/fill", response_model=FillResponse)
async def fill_submit(prompt_id: str, req: FillRequest):
    try:
        result = await fill_prompt(prompt_id, req.respuestas, req.usuario)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Prompt o variante Cowork no encontrado")
    return result
