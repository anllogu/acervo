from fastapi import APIRouter, HTTPException

from ..schemas import FacetsResponse, SearchRequest, SearchResponse
from ..services.search import get_facets, hybrid_search

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Phase 2 — Hybrid search: vector cosine + tsvector (Spanish), fused by RRF k=60.
    Falls back to lexical-only when stub embeddings are active.
    """
    try:
        candidates = await hybrid_search(
            query=req.query,
            dominio_negocio=req.dominio_negocio,
            tipo_tarea=req.tipo_tarea,
            limit=req.limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return SearchResponse(query=req.query, total=len(candidates), candidates=candidates)


@router.get("/facets", response_model=FacetsResponse)
async def facets():
    """Return distinct taxonomy values from non-deprecated prompts."""
    try:
        return await get_facets()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
