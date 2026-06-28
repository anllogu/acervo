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
