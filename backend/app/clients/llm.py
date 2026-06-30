import re
from typing import Any, Protocol
from ..config import settings


class LLMClient(Protocol):
    def generate_metadata(self, texto: str) -> dict[str, Any]: ...
    def understand_intent(self, descripcion: str) -> dict[str, Any]: ...
    def generate_fill_questions(self, variables: list[dict]) -> list[dict]: ...
    def explain_candidates(self, intencion: str, candidatos: list[dict]) -> list[dict]: ...
    def run_agent_turn(self, session: dict[str, Any]) -> dict[str, Any]: ...


class StubLLMClient:
    """
    Stub for development. Extracts {{variables}}, infers domain from keywords,
    and returns hardcoded JSON matching spec §5 contracts.
    Replace with real provider after ⚠ CONFIRMAR with Ángel.
    """

    def generate_metadata(self, texto: str) -> dict[str, Any]:
        variables = self._extract_variables(texto)
        dominio = self._infer_domain(texto)
        tipo_tarea = self._infer_task(texto)
        datos_sensibles = self._infer_pii(texto)

        return {
            "proposito": "Descripción del propósito (generada automáticamente — confirmar)",
            "tipo": "user",
            "idioma": "es",
            "variables": variables,
            "formato_salida": None,
            "dominio_negocio": dominio,
            "tipo_tarea": tipo_tarea,
            "tags": [],
            "criticidad": "alta" if datos_sensibles else "baja",
            "datos_sensibles": datos_sensibles,
        }

    def understand_intent(self, descripcion: str) -> dict[str, Any]:
        return {
            "dominio_negocio": self._infer_domain(descripcion),
            "tipo_tarea": self._infer_task(descripcion),
            "restricciones": [],
            "consulta_expandida": descripcion,
        }

    def generate_fill_questions(self, variables: list[dict]) -> list[dict]:
        return [
            {"nombre": v["nombre"], "pregunta": f"¿Cuál es el valor para '{v['nombre']}'?"}
            for v in variables
        ]

    def explain_candidates(self, intencion: str, candidatos: list[dict]) -> list[dict]:
        return [
            {"id": c["id"], "cuando_usarlo": c.get("proposito", "Ver descripción del prompt")}
            for c in candidatos
        ]

    def run_agent_turn(self, session: dict[str, Any]) -> dict[str, Any]:
        iteration = session["iteration"]
        last_count = session.get("last_result_count", 0)
        user_response = session.get("user_response")
        query = session["original_query"]

        if iteration == 0:
            return {
                "type": "search",
                "query": query,
                "dominio": self._infer_domain(query),
                "tarea": self._infer_task(query),
            }
        if iteration == 1:
            if last_count >= 1:
                return {"type": "done"}
            if user_response is None:
                return {
                    "type": "ask_user",
                    "question": (
                        f"No encontré suficientes resultados para «{query}». "
                        "¿Puedes darme más contexto? Por ejemplo, ¿en qué área "
                        "de negocio o tipo de tarea lo necesitas?"
                    ),
                }
            refined = f"{query} {user_response}"
            return {
                "type": "search",
                "query": refined,
                "dominio": self._infer_domain(refined),
                "tarea": self._infer_task(refined),
            }
        return {"type": "done"}

    # ── helpers ──────────────────────────────────────────────────────────────

    def _extract_variables(self, texto: str) -> list[dict]:
        seen: set[str] = set()
        variables = []
        for match in re.finditer(r"\{\{(\w+)\}\}", texto):
            name = match.group(1)
            if name not in seen:
                seen.add(name)
                variables.append({
                    "nombre": name,
                    "tipo": "text",
                    "obligatorio": True,
                    "descripcion": f"Variable '{name}' — añadir descripción",
                })
        return variables

    def _infer_domain(self, texto: str) -> list[str]:
        t = texto.lower()
        domains = []
        if any(w in t for w in ["contrato", "legal", "cláusula", "ley", "jurídic"]):
            domains.append("legal")
        if any(w in t for w in ["reunión", "acta", "agenda", "proyecto"]):
            domains.append("operaciones")
        if any(w in t for w in ["email", "correo", "carta", "comunicado", "noticia"]):
            domains.append("comunicacion")
        if any(w in t for w in ["empleado", "rrhh", "candidato", "contratación", "nómina"]):
            domains.append("rrhh")
        if any(w in t for w in ["factura", "presupuesto", "coste", "financi"]):
            domains.append("finanzas")
        return domains

    def _infer_task(self, texto: str) -> list[str]:
        import re
        t = texto.lower()
        tasks = []
        if re.search(r'\b(extrae|extraer|identifica|lista|enumera)\b', t):
            tasks.append("extraccion")
        if re.search(r'\b(clasifica|clasificar|categoriza|ordena)\b', t):
            tasks.append("clasificacion")
        if re.search(r'\b(redacta|escribe|genera|crea|elabora)\b', t):
            tasks.append("generacion")
        if re.search(r'\b(razona|analiza|evalúa|decide)\b', t):
            tasks.append("razonamiento")
        return tasks

    def _infer_pii(self, texto: str) -> bool:
        t = texto.lower()
        return any(w in t for w in [
            "nombre", "dni", "nif", "email", "teléfono", "dirección",
            "sueldo", "salario", "médico", "salud", "datos personales",
        ])


def get_llm_client() -> LLMClient:
    if settings.llm_provider == "stub":
        return StubLLMClient()
    raise NotImplementedError(
        f"LLM provider '{settings.llm_provider}' not yet wired. "
        "Confirm provider with Ángel and implement here."
    )
