from fastapi import APIRouter, HTTPException

from ..schemas import (
    CaptureRequest,
    CaptureResponse,
    PromptCreateRequest,
    PromptCreated,
)
from ..services.capture import analyze_capture, persist_prompt

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.post("/capture", response_model=CaptureResponse)
async def capture(req: CaptureRequest):
    """
    Phase 1 — Step 1: analyse raw text.
    Returns proposed metadata + near-duplicate candidates.
    The author reviews and confirms before calling POST /prompts.
    """
    try:
        result = await analyze_capture(req.texto, req.owner)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


@router.post("", response_model=PromptCreated, status_code=201)
async def create_prompt(req: PromptCreateRequest):
    """
    Phase 1 — Step 2: persist after author confirmation.
    Creates prompt_canonico (en_uso, personal) + variante_plataforma (cowork).
    """
    try:
        created = await persist_prompt(
            texto=req.texto,
            titulo=req.titulo,
            metadata=req.metadata,
            owner=req.owner,
            visibilidad=req.visibilidad,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return created
