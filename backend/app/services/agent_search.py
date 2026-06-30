from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from ..clients.llm import get_llm_client
from ..schemas import (
    AgentQuestion,
    AgentReasoningStep,
    AgentSearchResponse,
    IntentParsed,
    RecommendCandidate,
)
from .search import hybrid_search

SESSION_TTL = timedelta(minutes=15)
MAX_ITERATIONS = 3


@dataclass
class AgentTurn:
    role: str
    action: dict[str, Any]
    results_count: int = 0


@dataclass
class AgentSession:
    id: str
    original_query: str
    turns: list[AgentTurn] = field(default_factory=list)
    last_results: list = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    iteration: int = 0
    user_response: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "original_query": self.original_query,
            "iteration": self.iteration,
            "last_result_count": len(self.last_results),
            "user_response": self.user_response,
        }


_sessions: dict[str, AgentSession] = {}


def _cleanup_sessions() -> None:
    now = datetime.now(timezone.utc)
    expired = [sid for sid, s in _sessions.items() if now - s.created_at > SESSION_TTL]
    for sid in expired:
        del _sessions[sid]


def _get_or_create_session(
    query: str,
    session_id: str | None,
    user_response: str | None,
) -> AgentSession:
    _cleanup_sessions()
    if session_id:
        session = _sessions.get(session_id)
        if session is None:
            session = AgentSession(id=str(uuid4()), original_query=query)
            _sessions[session.id] = session
            return session
        session.user_response = user_response
        return session
    session = AgentSession(id=str(uuid4()), original_query=query)
    _sessions[session.id] = session
    return session


async def agent_search(
    query: str,
    session_id: str | None,
    user_response: str | None,
) -> AgentSearchResponse:
    session = _get_or_create_session(query, session_id, user_response)
    llm = get_llm_client()
    reasoning: list[AgentReasoningStep] = []
    last_search_action: dict[str, Any] = {}

    for _ in range(MAX_ITERATIONS + 2):
        action = llm.run_agent_turn(session.to_dict())
        step_num = len(reasoning) + 1

        if action["type"] == "search":
            q = action.get("query", session.original_query)
            dominio = action.get("dominio", [])
            tarea = action.get("tarea", [])
            last_search_action = action

            reasoning.append(AgentReasoningStep(
                step=step_num,
                action="buscar",
                detail=f'Buscando prompts para: "{q}"',
            ))

            results = await hybrid_search(
                query=q,
                dominio_negocio=dominio,
                tipo_tarea=tarea,
                limit=10,
            )

            # Fallback: retry with OR semantics when strict AND returns nothing
            if not results:
                results = await hybrid_search(
                    query=q,
                    dominio_negocio=dominio,
                    tipo_tarea=tarea,
                    limit=10,
                    lenient=True,
                )
                if results:
                    reasoning.append(AgentReasoningStep(
                        step=step_num,
                        action="buscar",
                        detail=f"Búsqueda ampliada (términos OR): {len(results)} resultado(s)",
                    ))

            session.last_results = results
            session.turns.append(AgentTurn(role="search", action=action, results_count=len(results)))
            session.iteration += 1

        elif action["type"] == "ask_user":
            q_text = action.get("question", "¿Puedes darme más detalles sobre lo que necesitas?")
            reasoning.append(AgentReasoningStep(
                step=step_num,
                action="preguntar",
                detail=q_text,
            ))
            return AgentSearchResponse(
                session_id=session.id,
                status="waiting",
                question=AgentQuestion(
                    text=q_text,
                    context=f"Encontré {len(session.last_results)} resultado(s) en la búsqueda inicial.",
                ),
                reasoning=reasoning,
            )

        elif action["type"] == "done":
            reasoning.append(AgentReasoningStep(
                step=step_num,
                action="finalizar",
                detail=f"Devolviendo {len(session.last_results)} resultado(s) finales.",
            ))
            break

        else:
            break

    intent: IntentParsed | None = None
    if last_search_action:
        intent = IntentParsed(
            dominio_negocio=last_search_action.get("dominio", []),
            tipo_tarea=last_search_action.get("tarea", []),
            restricciones=[],
            consulta_expandida=last_search_action.get("query", session.original_query),
        )

    explanations = llm.explain_candidates(
        session.original_query,
        [c.model_dump() for c in session.last_results],
    )
    expl_map = {e["id"]: e["cuando_usarlo"] for e in explanations}
    candidates = [
        RecommendCandidate(**c.model_dump(), cuando_usarlo=expl_map.get(c.id, ""))
        for c in session.last_results
    ]

    return AgentSearchResponse(
        session_id=session.id,
        status="done",
        intent=intent,
        candidates=candidates,
        reasoning=reasoning,
    )
