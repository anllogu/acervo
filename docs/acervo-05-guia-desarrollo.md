# Acervo — Guía de desarrollo para evolutivos

> Destinatario: agente de desarrollo trabajando en una nueva feature o evolutivo.
> Leer primero `acervo-03-arquitectura-implementada.md` para el mapa completo.
> Esta guía cubre: patrones, convenciones, cómo añadir una nueva fase, cómo conectar proveedores reales de LLM/embeddings.

---

## 1. Antes de empezar cualquier evolutivo

Checklist de lectura obligatoria:

1. **`CLAUDE.md`** (raíz del repo) — reglas de desarrollo, cómo arrancar el stack, comandos útiles.
2. **`acervo-03-arquitectura-implementada.md`** — árbol de ficheros, tablas, flujos, decisiones críticas.
3. **`acervo-04-referencia-api.md`** — todos los endpoints actuales con sus contratos.
4. **`backend/app/schemas.py`** — todos los modelos Pydantic. Buscar aquí antes de definir modelos nuevos.
5. **`frontend/src/lib/api.ts`** — todos los tipos TypeScript y fetch wrappers. Fuente de verdad del contrato frontend↔backend.

Regla general: **antes de crear ficheros nuevos, buscar si ya existe algo reutilizable**. El proyecto tiene convenciones fuertes que deben mantenerse.

---

## 2. Añadir una nueva fase o feature completa

El patrón establecido tiene 8 pasos. Seguirlos en orden evita importaciones circulares y errores de TypeScript.

### Paso 1: Modelos Pydantic (`backend/app/schemas.py`)

Añadir al final del fichero. Todos los modelos van aquí, sin excepciones.

```python
# POST /nueva-feature
class NuevaFeatureRequest(BaseModel):
    campo: str = Field(..., min_length=1)
    opciones: list[str] = []

class NuevaFeatureResponse(BaseModel):
    resultado: str
    items: list[str]
```

No crear ficheros `schemas_*.py` separados. No duplicar modelos que ya existen (`SearchCandidate`, `IntentParsed`, `RecommendCandidate`, etc.).

### Paso 2: Lógica de negocio (`backend/app/services/nueva_feature.py`)

```python
from ..clients.llm import get_llm_client
from ..db_asyncpg import get_pool
from ..schemas import NuevaFeatureRequest, NuevaFeatureResponse

async def nueva_feature(req: NuevaFeatureRequest) -> NuevaFeatureResponse:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Usar asyncpg nativo. NO usar SQLAlchemy ORM.
        rows = await conn.fetch("SELECT ... FROM prompt_canonico WHERE ...")
    
    llm = get_llm_client()
    resultado = llm.metodo_nuevo(...)  # ver Paso 3
    
    return NuevaFeatureResponse(resultado=resultado, items=[...])
```

**Reglas de servicio:**
- Todo acceso a DB via `asyncpg`. Ver `db_asyncpg.py` para el patrón del pool.
- Los servicios no deben importar de `routers/`. Importar solo de `schemas`, `clients`, `db_asyncpg`, otros `services`.
- No mezclar lógica de negocio con validación HTTP (eso va en el router).

### Paso 3: Extender clientes LLM/embedding (si la feature necesita LLM)

En `backend/app/clients/llm.py`:

```python
# 1. Añadir al Protocol (después del último método):
class LLMClient(Protocol):
    ...
    def metodo_nuevo(self, input: str) -> dict[str, Any]: ...

# 2. Implementar en StubLLMClient:
class StubLLMClient:
    ...
    def metodo_nuevo(self, input: str) -> dict[str, Any]:
        # Heurística determinista. Sin llamadas de red. Sin excepciones.
        return {"campo": "valor_stub", "lista": []}
```

El stub debe:
- Ser determinista (misma entrada → misma salida).
- No hacer llamadas de red.
- Devolver la misma estructura que devolverá el proveedor real.
- No lanzar excepciones en casos normales.

### Paso 4: Router HTTP (`backend/app/routers/nueva_feature.py`)

```python
from fastapi import APIRouter, HTTPException
from ..schemas import NuevaFeatureRequest, NuevaFeatureResponse
from ..services.nueva_feature import nueva_feature

router = APIRouter(prefix="/nueva-feature", tags=["nueva-feature"])

@router.post("/", response_model=NuevaFeatureResponse)
async def nueva_feature_endpoint(req: NuevaFeatureRequest):
    try:
        return await nueva_feature(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

Los routers son thin wrappers: reciben HTTP, delegan a servicios, devuelven respuesta. Sin lógica de negocio.

### Paso 5: Registrar router (`backend/app/main.py`)

```python
# Añadir al import:
from .routers import agent, fill, health, nueva_feature, prompts, recommend, search, signals, stats

# Añadir al bloque de include_router:
app.include_router(nueva_feature.router)
```

### Paso 6: Tipos y fetch wrapper (`frontend/src/lib/api.ts`)

Añadir al final del fichero:

```typescript
// ── Nueva Feature ────────────────────────────────────────────────────────────

export interface NuevaFeatureResponse {
  resultado: string
  items: string[]
}

export async function nuevaFeature(payload: {
  campo: string
  opciones?: string[]
}): Promise<NuevaFeatureResponse> {
  const res = await fetch(`${API_URL}/nueva-feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Nueva feature error ${res.status}: ${detail}`)
  }
  return res.json()
}
```

No duplicar tipos que ya existen (`SearchCandidate`, `RecommendCandidate`, `IntentParsed`, etc.).

### Paso 7: Página frontend (`frontend/src/app/nueva-feature/page.tsx`)

```typescript
'use client'  // obligatorio si usa useState, useEffect, form handlers

import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { nuevaFeature, type NuevaFeatureResponse } from '@/lib/api'

export default function NuevaFeaturePage() {
  const [resultado, setResultado] = useState<NuevaFeatureResponse | null>(null)
  // ...
  return (
    <>
      <PageHeader title="Nueva Feature" subtitle="..." />
      {/* contenido */}
    </>
  )
}
```

**Convenciones de UI:**
- Usar `PageHeader` de `@/components/PageHeader`.
- Cards: `bg-white rounded-xl border border-gray-100 shadow-sm p-5`.
- Acento: `indigo-600` / `indigo-500`.
- Spinner: `ArrowPathIcon` con `animate-spin`.
- Errores: `bg-red-50 border border-red-100 rounded-xl` + `text-red-700`.
- Estados vacíos: borde punteado `border-dashed border-gray-200`, icono grande gris, texto gris.

### Paso 8: Añadir al sidebar (`frontend/src/components/Sidebar.tsx`)

```typescript
// Importar icono de @heroicons/react/24/outline
import { ..., NuevoIconoIcon } from '@heroicons/react/24/outline'

// Añadir al grupo NAV_GROUPS apropiado:
{ label: 'Nueva Feature', href: '/nueva-feature', icon: NuevoIconoIcon },
```

Grupos disponibles: `CATÁLOGO` (Descubrir, Buscar, Agente), `MIS PROMPTS` (Mis prompts, Nuevo prompt), `SISTEMA` (Administración).

---

## 3. Añadir una migración de base de datos

Las migraciones van en `backend/alembic/versions/`. Actualmente existe solo `0001_initial_schema.py`.

```python
# backend/alembic/versions/0002_nueva_tabla.py
"""nueva tabla para X"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'

def upgrade():
    op.create_table(
        'nueva_tabla',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('canonico_id', sa.UUID, sa.ForeignKey('prompt_canonico.id', ondelete='CASCADE')),
        sa.Column('dato', sa.Text, nullable=False),
        sa.Column('creado_en', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table('nueva_tabla')
```

Aplicar con:
```bash
docker compose exec api alembic upgrade head
```

**Importante:** La columna `fts` se mantiene via trigger definido en `0001`. No añadir lógica FTS en migraciones posteriores salvo que se extienda el trigger.

---

## 4. Conectar proveedores reales de LLM y embeddings

Estado actual: `EMBEDDING_PROVIDER=stub`, `LLM_PROVIDER=stub`. Pendiente `⚠ CONFIRMAR con Ángel` (restricción on-prem ISO 42001 / EU AI Act).

### 4.1 Proveedor de embeddings

En `backend/app/clients/embeddings.py`, añadir una clase que implemente `EmbeddingClient`:

```python
class OpenAIEmbeddingClient:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        import openai
        self._client = openai.OpenAI(api_key=api_key)
        self._model = model

    def embed(self, text: str) -> list[float]:
        response = self._client.embeddings.create(input=text, model=self._model)
        return response.data[0].embedding

def get_embedding_client() -> EmbeddingClient:
    if settings.embedding_provider == "stub":
        return StubEmbeddingClient(settings.embedding_dim)
    if settings.embedding_provider == "openai":
        return OpenAIEmbeddingClient(api_key=settings.llm_api_key)
    raise NotImplementedError(...)
```

**Al activar embeddings reales:**
1. Actualizar `EMBEDDING_DIM` en `.env` para que coincida con el modelo (ej. 1536 para `text-embedding-3-small`).
2. Si `EMBEDDING_DIM` cambia, recrear la columna `embedding` en la DB (migración + reindexado).
3. Re-embedizar todos los prompts existentes con el nuevo modelo.
4. La deduplicación en captura (`find_duplicates`) solo funciona con embeddings reales; con stub siempre devuelve `[]`.

### 4.2 Proveedor de LLM

En `backend/app/clients/llm.py`, añadir una clase que implemente `LLMClient`. Cada método debe:
1. Construir un prompt del sistema apropiado.
2. Llamar al LLM.
3. Parsear el JSON devuelto de forma defensiva.
4. Devolver la estructura exacta que documenta `acervo-01-especificacion-tecnica-poc.md §5`.

```python
class AnthropicLLMClient:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6") -> None:
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def _call(self, system: str, user: str) -> dict:
        """Llamada genérica. Espera JSON puro en la respuesta."""
        import json
        msg = self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = msg.content[0].text.strip()
        # Parseo defensivo: eliminar bloques ```json si el modelo los incluye
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)

    def generate_metadata(self, texto: str) -> dict:
        return self._call(
            system="""Eres un asistente que analiza prompts de IA y genera metadatos estructurados.
Devuelve SOLO JSON con estos campos:
{
  "proposito": "string",
  "tipo": "user|system|few_shot|cadena|plantilla_agente",
  "idioma": "es",
  "variables": [{"nombre":"string","tipo":"text","obligatorio":true,"descripcion":"string"}],
  "formato_salida": "string|null",
  "dominio_negocio": ["legal|operaciones|comunicacion|rrhh|finanzas"],
  "tipo_tarea": ["extraccion|clasificacion|generacion|razonamiento"],
  "tags": ["string"],
  "criticidad": "baja|media|alta",
  "datos_sensibles": boolean
}""",
            user=f"Analiza este prompt:\n\n{texto}",
        )

    def understand_intent(self, descripcion: str) -> dict:
        return self._call(
            system="""Interpreta la intención del usuario y genera una consulta expandida para búsqueda.
Devuelve SOLO JSON:
{
  "dominio_negocio": ["legal|operaciones|comunicacion|rrhh|finanzas"],
  "tipo_tarea": ["extraccion|clasificacion|generacion|razonamiento"],
  "restricciones": ["string"],
  "consulta_expandida": "string con términos de búsqueda relevantes"
}""",
            user=descripcion,
        )

    def generate_fill_questions(self, variables: list[dict]) -> list[dict]:
        import json
        return self._call(
            system="""Genera preguntas claras en lenguaje natural para rellenar variables de un prompt.
Devuelve SOLO JSON: [{"nombre":"string","pregunta":"string"}]""",
            user=f"Variables: {json.dumps(variables, ensure_ascii=False)}",
        )

    def explain_candidates(self, intencion: str, candidatos: list[dict]) -> list[dict]:
        import json
        return self._call(
            system="""Para cada candidato, explica en una frase cuándo usarlo según la intención del usuario.
Devuelve SOLO JSON: [{"id":"string","cuando_usarlo":"string"}]""",
            user=f"Intención: {intencion}\n\nCandidatos: {json.dumps(candidatos, ensure_ascii=False)}",
        )

    def run_agent_turn(self, session: dict) -> dict:
        import json
        return self._call(
            system="""Eres un agente de búsqueda de prompts. Debes decidir tu siguiente acción.
Devuelve SOLO JSON con una de estas formas:
- {"type":"search","query":"string","dominio":["string"],"tarea":["string"]}
- {"type":"ask_user","question":"string"}
- {"type":"done"}
Busca cuando puedas. Pregunta solo si los resultados son 0 tras buscar. Finaliza cuando tengas resultados.""",
            user=json.dumps(session, ensure_ascii=False),
        )

def get_llm_client() -> LLMClient:
    if settings.llm_provider == "stub":
        return StubLLMClient()
    if settings.llm_provider == "anthropic":
        return AnthropicLLMClient(api_key=settings.llm_api_key)
    raise NotImplementedError(...)
```

**En `.env`:**
```
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
EMBEDDING_PROVIDER=openai   # o el proveedor elegido
LLM_API_KEY=sk-ant-...      # reutilizar o añadir EMBEDDING_API_KEY separada
```

---

## 5. Añadir una nueva plataforma (más allá de Cowork)

Actualmente solo existe la variante `cowork`. Para añadir `copilot` u otra:

1. **DB:** `variante_plataforma` ya soporta cualquier string en `plataforma`. No hay migración.

2. **Captura:** en `capture.py`, `INSERT_VARIANTE` tiene `plataforma='cowork'` hardcodeado. Parametrizar:
   ```python
   INSERT_VARIANTE = """
       INSERT INTO variante_plataforma (canonico_id, plataforma, cuerpo_adaptado, tipo_adaptacion, creado_por)
       VALUES ($1::uuid, $2, $3, 'formato'::tipo_adaptacion, $4)
       RETURNING id::text
   """
   # Pasar plataforma como parámetro desde persist_prompt()
   ```

3. **Detalle de prompt:** en `recommend.py`, `get_prompt_detail` filtra `AND vp.plataforma = 'cowork'`. Hacerlo parametrizable.

4. **Fill:** en `fill.py`, el fetch de `cuerpo_adaptado` asume Cowork. Añadir parámetro de plataforma.

5. **Frontend:** en `api.ts`, añadir parámetro `plataforma` a las llamadas relevantes.

---

## 6. Convenciones y restricciones

### Backend

- **asyncpg siempre, SQLAlchemy ORM nunca** en features nuevas. `db.py` existe solo para el health check por razones históricas.
- **`schemas.py` es el único fichero de modelos Pydantic.** No dispersar modelos.
- **Todo código debe funcionar con `LLM_PROVIDER=stub` y `EMBEDDING_PROVIDER=stub`.** Los stubs son el modo de desarrollo por defecto.
- **Los routers son thin wrappers.** La lógica de negocio va en `services/`.
- **No añadir campos `Optional` sin razón.** Pydantic v2 diferencia `None` de campo ausente; ser explícito.
- Usar `model_dump()` (Pydantic v2), no `dict()` (v1).

### Frontend

- **`api.ts` es el único fichero de fetch.** No hacer `fetch()` directamente en páginas o componentes.
- **`'use client'`** solo en páginas/componentes con hooks React (`useState`, `useEffect`, form handlers). Las páginas de solo lectura pueden ser Server Components.
- **No usar `useSearchParams()` en la raíz de un Server Component** sin envolverlo en `<Suspense>`. Ver `buscar/page.tsx` como ejemplo.
- **Tailwind puro, sin CSS modules ni styled-components.**
- Los iconos vienen de `@heroicons/react/24/outline` (outline) o `@heroicons/react/24/solid` (solid). No añadir otras librerías de iconos.

### Git

- Un commit por evolutivo completo (backend + frontend juntos).
- Mensajes en español, descriptivos del "qué" y el "por qué".
- Actualizar `README.md` (tabla de fases) y el doc relevante en `docs/` tras cualquier cambio que afecte a arquitectura, APIs o modelo de datos.

---

## 7. Verificación estándar tras un cambio

```bash
# 1. Reiniciar si se cambiaron dependencias o routers
docker compose restart api

# 2. Verificar que el endpoint nuevo aparece en OpenAPI
curl -s http://localhost:8000/openapi.json | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(list(d['paths'].keys()))"

# 3. Probar el endpoint directamente
curl -s -X POST http://localhost:8000/RUTA \
  -H "Content-Type: application/json" \
  -d '{"campo": "valor"}' | python3 -m json.tool

# 4. TypeScript sin errores
docker compose exec frontend npx tsc --noEmit

# 5. Lint
docker compose exec frontend npm run lint

# 6. Verificar UI en http://localhost:3000/nueva-ruta
```

---

## 8. Qué NO hacer

- **No ejecutar prompts.** Acervo es un recomendador; la ejecución vive en las plataformas destino.
- **No persistir prompts sin confirmación del autor.** `POST /prompts/capture` propone; `POST /prompts` persiste. El paso de confirmación no es opcional.
- **No usar `plainto_tsquery` con OR manual.** Para OR usar `hybrid_search(lenient=True)`, que lo hace vía `to_tsvector → to_tsquery` con `|` correctamente stemizado.
- **No añadir lógica en routers.** Los routers solo validan HTTP y delegan.
- **No crear un segundo fichero de schemas.** Todo en `schemas.py`.
- **No introducir SQLAlchemy ORM** para acceso a datos en features nuevas.
- **No construir el servidor MCP** hasta que los proveedores reales de LLM/embeddings estén confirmados y el catálogo tenga volumen suficiente.
- **No activar el workflow de aprobación** (en_uso → propuesta → aprobada) sin un diseño de notificaciones y roles. Los estados existen en el modelo pero el tránsito automático no está gobernado.
