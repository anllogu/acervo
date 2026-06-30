from fastapi import APIRouter, HTTPException

from ..schemas import AgentSearchRequest, AgentSearchResponse
from ..services.agent_search import agent_search

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/search", response_model=AgentSearchResponse)
async def agent_search_endpoint(req: AgentSearchRequest):
    try:
        return await agent_search(req.query, req.session_id, req.user_response)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
