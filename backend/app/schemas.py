from typing import Literal

from pydantic import BaseModel, Field


class VariableSchema(BaseModel):
    nombre: str
    tipo: str = "text"
    obligatorio: bool = True
    descripcion: str = ""


class MetadataPropuesta(BaseModel):
    proposito: str
    tipo: str = "user"
    idioma: str = "es"
    variables: list[VariableSchema] = []
    formato_salida: str | None = None
    dominio_negocio: list[str] = []
    tipo_tarea: list[str] = []
    tags: list[str] = []
    criticidad: str = "baja"
    datos_sensibles: bool = False


class DuplicadoCandidato(BaseModel):
    id: str
    slug: str
    titulo: str
    similitud: float


# POST /prompts/capture
class CaptureRequest(BaseModel):
    texto: str = Field(..., min_length=10)
    owner: str = "anonymous"


class CaptureResponse(BaseModel):
    metadata_propuesta: MetadataPropuesta
    duplicados_candidatos: list[DuplicadoCandidato]


# POST /prompts  (after user confirms metadata)
class PromptCreateRequest(BaseModel):
    texto: str
    titulo: str
    metadata: MetadataPropuesta
    owner: str = "anonymous"
    visibilidad: str = "personal"


class PromptCreated(BaseModel):
    id: str
    slug: str
    titulo: str
    estado: str
    variante_cowork_id: str


# POST /search
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    dominio_negocio: list[str] = []
    tipo_tarea: list[str] = []
    limit: int = Field(default=10, ge=1, le=50)


class SearchCandidate(BaseModel):
    id: str
    slug: str
    titulo: str
    proposito: str
    dominio_negocio: list[str]
    tipo_tarea: list[str]
    tags: list[str]
    destacado: bool
    criticidad: str
    datos_sensibles: bool
    variables_count: int
    rrf_score: float


class SearchResponse(BaseModel):
    query: str
    total: int
    candidates: list[SearchCandidate]


# GET /facets
class FacetsResponse(BaseModel):
    dominio_negocio: list[str]
    tipo_tarea: list[str]


# GET /discover
class DiscoverResponse(BaseModel):
    prompts: list[SearchCandidate]
    total: int


# POST /recommend
class RecommendRequest(BaseModel):
    descripcion: str = Field(..., min_length=5)
    limit: int = Field(default=10, ge=1, le=20)


class IntentParsed(BaseModel):
    dominio_negocio: list[str]
    tipo_tarea: list[str]
    restricciones: list[str]
    consulta_expandida: str


class RecommendCandidate(BaseModel):
    id: str
    slug: str
    titulo: str
    proposito: str
    dominio_negocio: list[str]
    tipo_tarea: list[str]
    tags: list[str]
    destacado: bool
    criticidad: str
    datos_sensibles: bool
    variables_count: int
    rrf_score: float
    cuando_usarlo: str


class RecommendResponse(BaseModel):
    descripcion: str
    intent: IntentParsed
    total: int
    candidates: list[RecommendCandidate]


# GET /prompts/{id}/fill
class FillQuestion(BaseModel):
    nombre: str
    pregunta: str
    descripcion: str
    obligatorio: bool


class FillQuestionsResponse(BaseModel):
    prompt_id: str
    titulo: str
    questions: list[FillQuestion]


# POST /prompts/{id}/fill
class FillRequest(BaseModel):
    respuestas: dict[str, str]
    usuario: str = "anonymous"


class FillResponse(BaseModel):
    prompt_id: str
    titulo: str
    prompt_relleno: str


# POST /prompts/{id}/rate
class RateRequest(BaseModel):
    senal: Literal[-1, 1]
    usuario: str = "anonymous"


# POST /prompts/{id}/use
class UseRequest(BaseModel):
    usuario: str = "anonymous"


# GET /prompts/{id}
class VarianteCowork(BaseModel):
    id: str
    cuerpo_adaptado: str


class PromptDetail(BaseModel):
    id: str
    slug: str
    titulo: str
    proposito: str
    cuerpo_canonico: str
    variables: list[VariableSchema]
    dominio_negocio: list[str]
    tipo_tarea: list[str]
    tags: list[str]
    destacado: bool
    criticidad: str
    datos_sensibles: bool
    estado: str
    variante_cowork: VarianteCowork | None


# GET /prompts?owner= (Phase 6 — mis prompts)
class MyPromptSummary(BaseModel):
    id: str
    slug: str
    titulo: str
    proposito: str
    estado: str
    criticidad: str
    datos_sensibles: bool
    destacado: bool
    variables_count: int
    creado_en: str


class MyPromptsResponse(BaseModel):
    owner: str
    total: int
    prompts: list[MyPromptSummary]


# GET /stats (Phase 6 — adoption metrics)
class StatsResponse(BaseModel):
    total_prompts: int
    total_usos: int
    total_valoraciones_positivas: int
    total_valoraciones_negativas: int
    prompts_this_week: int
    usos_this_week: int
