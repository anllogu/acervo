# Acervo — Arquitectura implementada (referencia definitiva)

> Estado: PoC completada, Fases 0–7, junio 2026.
> Destinatario: agente de desarrollo trabajando en evolutivos. Leer este documento antes de tocar cualquier fichero.
> Para endpoints ver `acervo-04-referencia-api.md`. Para añadir features ver `acervo-05-guia-desarrollo.md`.

---

## 1. Visión general

Acervo es un **recomendador de prompts**, no un ejecutor. Entrega el prompt correcto (ya relleno, adaptado a Cowork) para que el usuario lo lleve a su plataforma. La ejecución vive en las plataformas destino.

```
Frontend (Next.js 14 App Router)  :3000
        ↕ fetch JSON
Backend (FastAPI + asyncpg)        :8000
        ↕ asyncpg pool
PostgreSQL + pgvector               :5432
```

Todo corre en Docker. El override file monta fuentes para hot-reload.

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Base de datos | PostgreSQL 16 + pgvector | Almacén único: relacional + vector + FTS |
| Backend | FastAPI, Python 3.12 | Async via asyncpg |
| ORM/DB client | asyncpg (nativo) | SQLAlchemy solo en health check (`db.py`) |
| Validación | Pydantic v2 | Todos los modelos en `schemas.py` |
| Frontend | Next.js 14 App Router | TypeScript, Tailwind CSS, Inter font |
| Migraciones | Alembic | Una sola migración `0001_initial_schema.py` |
| Clientes LLM/Emb | Stub (en uso) | Reales pendientes de `⚠ CONFIRMAR` |
| Contenedores | Docker Compose | `docker-compose.yml` + `override.yml` |

---

## 3. Árbol de ficheros

```
acervo/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← registro de todos los routers
│   │   ├── config.py                ← Settings (pydantic-settings, .env)
│   │   ├── schemas.py               ← TODOS los modelos Pydantic request/response
│   │   ├── db.py                    ← SQLAlchemy engine (solo health check)
│   │   ├── db_asyncpg.py            ← pool asyncpg (único punto de acceso a DB)
│   │   ├── models.py                ← modelos SQLAlchemy (no se usan en queries)
│   │   ├── clients/
│   │   │   ├── embeddings.py        ← EmbeddingClient Protocol + StubEmbeddingClient
│   │   │   └── llm.py               ← LLMClient Protocol + StubLLMClient
│   │   ├── routers/
│   │   │   ├── health.py            ← GET /health
│   │   │   ├── prompts.py           ← POST /prompts/capture, POST /prompts, GET /prompts
│   │   │   ├── search.py            ← POST /search, GET /discover, GET /facets
│   │   │   ├── recommend.py         ← POST /recommend, GET /prompts/{id}, POST /prompts/{id}/use
│   │   │   ├── fill.py              ← GET /prompts/{id}/fill, POST /prompts/{id}/fill
│   │   │   ├── signals.py           ← POST /prompts/{id}/rate
│   │   │   ├── stats.py             ← GET /stats
│   │   │   └── agent.py             ← POST /agent/search  [Fase 7]
│   │   └── services/
│   │       ├── capture.py           ← Fase 1: embed + dedup + metadatos + persist
│   │       ├── search.py            ← Fase 2: hybrid_search() con RRF y lenient mode
│   │       ├── recommend.py         ← Fase 3: intent → search → explain
│   │       ├── fill.py              ← Fase 4: preguntas + sustitución placeholders
│   │       ├── ranking.py           ← Fase 5: multi_signal_score(), discover_score()
│   │       ├── prompts.py           ← Fase 6: list_my_prompts()
│   │       ├── rating.py            ← Fase 5: upsert valoracion
│   │       └── agent_search.py      ← Fase 7: bucle ReAct, sesiones en memoria
│   ├── alembic/
│   │   └── versions/0001_initial_schema.py  ← DDL completo, triggers, índices
│   └── app/seed/seed.py             ← 4 prompts de seed (idempotente)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx             ← redirect → /descubrir
│       │   ├── descubrir/page.tsx   ← Fase 5: browse + featured
│       │   ├── buscar/page.tsx      ← Fase 3: recommend con intent chips
│       │   ├── agente/page.tsx      ← Fase 7: UI conversacional ReAct
│       │   ├── nuevo/page.tsx       ← Fase 1: captura con metadatos
│       │   ├── mis-prompts/page.tsx ← Fase 6: lista del usuario
│       │   ├── admin/page.tsx       ← Fase 6: stats de adopción
│       │   └── prompts/[id]/page.tsx← Fase 3+4: detalle + fill modal
│       ├── components/
│       │   ├── Sidebar.tsx          ← navegación lateral colapsable
│       │   ├── TopBar.tsx           ← barra superior
│       │   └── PageHeader.tsx       ← cabecera de página estándar
│       └── lib/
│           └── api.ts               ← TODOS los fetch wrappers + tipos TypeScript
└── docs/
    ├── acervo-00-diseno-poc.md      ← diseño de producto (intención original)
    ├── acervo-01-especificacion-tecnica-poc.md  ← spec técnica (DDL, contratos LLM)
    ├── acervo-02-plan-implementacion-fases-poc.md ← plan por fases
    ├── acervo-03-arquitectura-implementada.md   ← ESTE FICHERO (as-built)
    ├── acervo-04-referencia-api.md              ← referencia completa de endpoints
    └── acervo-05-guia-desarrollo.md             ← patrones y convenciones
```

---

## 4. Base de datos

### 4.1 Tablas

**`prompt_canonico`** — pieza central
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `slug` | TEXT UNIQUE | slugificado del título, único en la tabla |
| `titulo` | TEXT | |
| `proposito` | TEXT | autogenerado LLM, confirmado por autor |
| `cuerpo_canonico` | TEXT | texto original con `{{variables}}` |
| `tipo` | enum tipo_prompt | system/user/few_shot/cadena/plantilla_agente |
| `idioma` | TEXT | default 'es' |
| `variables` | JSONB | `[{nombre,tipo,obligatorio,descripcion}]` |
| `formato_salida` | TEXT | nullable |
| `ejemplos` | JSONB | `[]` por defecto |
| `dominio_negocio` | TEXT[] | faceta multi-valor |
| `tipo_tarea` | TEXT[] | faceta multi-valor |
| `tags` | TEXT[] | libres |
| `criticidad` | enum criticidad_tipo | baja/media/alta |
| `datos_sensibles` | BOOLEAN | confirmado por autor |
| `estado` | enum estado_ciclo | generada/en_uso/propuesta/aprobada/deprecada |
| `version` | TEXT | default '0.1.0' |
| `owner` | TEXT | |
| `equipo` | TEXT | nullable |
| `visibilidad` | enum visibilidad_tipo | personal/equipo/compartido |
| `destacado` | BOOLEAN | semilla curada para cold start |
| `embedding` | vector(1536) | zeros con stub; HNSW index |
| `fts` | tsvector | mantenida por trigger (ver abajo) |
| `creado_en` | TIMESTAMPTZ | |
| `actualizado_en` | TIMESTAMPTZ | |

**`variante_plataforma`** — render por plataforma
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `canonico_id` | UUID FK | → prompt_canonico (CASCADE DELETE) |
| `plataforma` | TEXT | PoC: siempre 'cowork' |
| `cuerpo_adaptado` | TEXT | en PoC = cuerpo_canonico (sin transformación) |
| `tipo_adaptacion` | enum tipo_adaptacion | formato/semantica |
| `version` | TEXT | |
| `estado` | enum estado_ciclo | |
| `creado_por` | TEXT | |
| `creado_en` | TIMESTAMPTZ | |
| UNIQUE | (canonico_id, plataforma) | un solo render por plataforma |

**`registro_uso`** — señal implícita
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | BIGSERIAL PK | |
| `variante_id` | UUID FK | → variante_plataforma (CASCADE) |
| `canonico_id` | UUID FK | → prompt_canonico (CASCADE) |
| `usuario` | TEXT | |
| `ts` | TIMESTAMPTZ | |

**`valoracion`** — señal explícita (+1/-1)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | BIGSERIAL PK | |
| `canonico_id` | UUID FK | → prompt_canonico (CASCADE) |
| `usuario` | TEXT | |
| `senal` | SMALLINT | +1 o -1 |
| `ts` | TIMESTAMPTZ | |
| UNIQUE | (canonico_id, usuario) | un voto por usuario por prompt |

### 4.2 Índices

```sql
HNSW  idx_canonico_embedding  ON prompt_canonico (embedding vector_cosine_ops)
GIN   idx_canonico_fts        ON prompt_canonico (fts)
GIN   idx_canonico_dominio    ON prompt_canonico (dominio_negocio)
GIN   idx_canonico_tarea      ON prompt_canonico (tipo_tarea)
BTREE idx_uso_canonico        ON registro_uso (canonico_id)
```

### 4.3 Trigger FTS

`trg_prompt_fts` (BEFORE INSERT OR UPDATE) sobre `prompt_canonico`:
```sql
fts = setweight(to_tsvector('spanish', titulo), 'A')
    || setweight(to_tsvector('spanish', proposito || ' ' || array_to_string(tags,' ')), 'B')
    || setweight(to_tsvector('spanish', cuerpo_canonico), 'C')
```
Stemming español. Pesos: título=A, propósito+tags=B, cuerpo=C.

---

## 5. Clientes LLM y embeddings

### 5.1 Protocolo

```python
# embeddings.py
class EmbeddingClient(Protocol):
    def embed(self, text: str) -> list[float]: ...

# llm.py
class LLMClient(Protocol):
    def generate_metadata(self, texto: str) -> dict[str, Any]: ...        # Fase 1
    def understand_intent(self, descripcion: str) -> dict[str, Any]: ...   # Fase 3
    def generate_fill_questions(self, variables: list[dict]) -> list[dict]: ... # Fase 4
    def explain_candidates(self, intencion: str, candidatos: list[dict]) -> list[dict]: ... # Fase 3
    def run_agent_turn(self, session: dict[str, Any]) -> dict[str, Any]: ... # Fase 7
```

### 5.2 Stub activo

- `StubEmbeddingClient`: devuelve vector de ceros de dim=1536. La búsqueda vectorial se salta cuando `EMBEDDING_PROVIDER=stub`.
- `StubLLMClient`: heurísticas por palabras clave (sin LLM real). Comportamiento determinista.
  - `generate_metadata`: regex `{{vars}}`, keywords para dominio/tarea/PII.
  - `understand_intent`: mismas heurísticas → `consulta_expandida` = input original.
  - `generate_fill_questions`: plantilla genérica por variable.
  - `explain_candidates`: devuelve `proposito` del candidato.
  - `run_agent_turn`: iter=0 → search; iter=1 y ≥1 resultado → done; iter=1 y 0 resultados → ask_user; iter≥2 → done.

### 5.3 Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | `stub` | `stub` o nombre del proveedor real |
| `EMBEDDING_DIM` | `1536` | dimensión del vector (debe coincidir con el modelo) |
| `LLM_PROVIDER` | `stub` | `stub` o nombre del proveedor real |
| `LLM_API_KEY` | `` | clave del proveedor real |
| `DATABASE_URL` | `postgresql+asyncpg://acervo:changeme@db:5432/acervo` | |
| `POSTGRES_PASSWORD` | (requerida en .env) | |

---

## 6. Flujos de datos principales

### 6.1 Captura (Fase 1)

```
POST /prompts/capture { texto, owner }
  ↓ capture.analyze_capture()
  ├─ emb_client.embed(texto) → vector
  ├─ llm.generate_metadata(texto) → MetadataPropuesta
  └─ find_duplicates(conn, vector) → [] cuando stub
  ↓ CaptureResponse { metadata_propuesta, duplicados_candidatos }

[usuario confirma]

POST /prompts { texto, titulo, metadata, owner, visibilidad }
  ↓ capture.persist_prompt()
  ├─ embed(texto) de nuevo
  ├─ INSERT prompt_canonico (estado='en_uso')
  └─ INSERT variante_plataforma (plataforma='cowork', cuerpo_adaptado=texto)
  ↓ PromptCreated { id, slug, titulo, estado, variante_cowork_id }
```

### 6.2 Búsqueda híbrida (Fase 2)

```
POST /search { query, dominio_negocio[], tipo_tarea[], limit }
  ↓ search.hybrid_search(query, dominio, tarea, limit, lenient=False)
  ├─ [skip si stub] Vector: ORDER BY embedding <=> vec LIMIT 50
  ├─ FTS: fts @@ plainto_tsquery('spanish', query) ORDER BY ts_rank LIMIT 50
  │    si lenient=True: usa to_tsquery con OR entre lexemas stemizados
  ├─ RRF k=60: score = Σ 1/(60+rank_i) para cada doc en ambas listas
  ├─ top N*3 candidatos → _SIGNALS_SQL (uso_count, avg_senal, creado_en, destacado)
  └─ multi_signal_score() re-ranking → top N
  ↓ SearchResponse { query, total, candidates: SearchCandidate[] }
```

### 6.3 Recomendación por intención (Fase 3)

```
POST /recommend { descripcion, limit }
  ↓ recommend.recommend()
  ├─ llm.understand_intent(descripcion) → IntentParsed
  ├─ hybrid_search(consulta_expandida, dominio, tarea, limit)
  └─ llm.explain_candidates(descripcion, candidates) → [{id, cuando_usarlo}]
  ↓ RecommendResponse { descripcion, intent, total, candidates: RecommendCandidate[] }
```

### 6.4 Rellenado guiado (Fase 4)

```
GET /prompts/{id}/fill
  ↓ fill.get_fill_questions()
  ├─ get_prompt_detail(id) → variables[]
  └─ llm.generate_fill_questions(variables) → [{nombre, pregunta}]
  ↓ FillQuestionsResponse { prompt_id, titulo, questions[] }

POST /prompts/{id}/fill { respuestas: {var: valor}, usuario }
  ↓ fill.fill_prompt()
  ├─ fetch variante_plataforma.cuerpo_adaptado
  ├─ regex: sustituye {{var}} → respuestas[var]
  └─ log_uso(prompt_id, usuario) → INSERT registro_uso
  ↓ FillResponse { prompt_id, titulo, prompt_relleno }
```

### 6.5 Búsqueda agéntica (Fase 7)

```
POST /agent/search { query, session_id?, user_response? }
  ↓ agent_search.agent_search()
  ├─ _get_or_create_session() → AgentSession (in-memory, TTL 15min)
  └─ bucle hasta MAX_ITERATIONS+2:
       ├─ llm.run_agent_turn(session.to_dict()) → {"type": "search"|"ask_user"|"done"}
       │
       ├─ type="search":
       │    hybrid_search(query, dominio, tarea, limit=10)
       │    si 0 resultados: retry con lenient=True
       │    session.iteration += 1
       │
       ├─ type="ask_user":
       │    return AgentSearchResponse(status="waiting", question=...)
       │    [frontend muestra pregunta → usuario responde → relanza con session_id]
       │
       └─ type="done":
            llm.explain_candidates() → cuando_usarlo por candidato
            return AgentSearchResponse(status="done", candidates=[], reasoning=[])
```

---

## 7. Ranking multi-señal (Fase 5)

### Búsqueda (`multi_signal_score`)

```
score = 0.50 * (rrf / max_rrf)           ← relevancia primaria
      + 0.15 * min(uso_count, 20) / 20   ← uso capeado en 20
      + 0.20 * (avg_senal + 1) / 2       ← rating [-1,1] → [0,1]; 0.5 si sin datos
      + 0.10 * exp(-age_days / 90)       ← recencia, half-life 90 días
      + 0.05 * destacado                 ← flag booleano
```

### Descubrimiento (`discover_score`) — sin relevancia

```
score = 0.25 * capped_uso
      + 0.35 * norm_rating               ← rating tiene más peso para evitar bucle popularidad
      + 0.20 * recencia
      + 0.20 * destacado
```

---

## 8. Sistema de sesiones del agente (Fase 7)

```python
@dataclass
class AgentSession:
    id: str                         # UUID
    original_query: str
    turns: list[AgentTurn]          # historial
    last_results: list[SearchCandidate]
    created_at: datetime            # para TTL
    iteration: int                  # número de búsquedas ejecutadas
    user_response: str | None       # respuesta del usuario a una pregunta

_sessions: dict[str, AgentSession]  # in-memory, limpieza lazy en cada request
SESSION_TTL = timedelta(minutes=15)
MAX_ITERATIONS = 3
```

Las sesiones NO se persisten en base de datos. Si el servidor se reinicia, las sesiones se pierden y la siguiente llamada con un `session_id` expirado crea una sesión nueva (degradación elegante).

---

## 9. Design system (frontend)

| Elemento | Clase Tailwind |
|---------|---------------|
| Sidebar | `bg-gray-900` |
| Nav activo | `bg-indigo-950 border-l-2 border-indigo-500` |
| Área de contenido | `bg-gray-50` |
| Cards | `bg-white rounded-xl shadow-sm border border-gray-100` |
| Acento primario | `indigo-600` / `indigo-500` |
| Texto secundario | `text-gray-500`, `text-gray-400` |
| Error | `bg-red-50 border-red-100 text-red-700` |
| Font | Inter (Google Fonts) |

---

## 10. Operaciones habituales

```bash
# Iniciar stack completo
docker compose up

# Migraciones (primera vez)
docker compose exec api alembic upgrade head

# Cargar seed (idempotente)
docker compose exec api python -m app.seed.seed

# Reiniciar un servicio tras cambiar dependencias o routers
docker compose restart api
docker compose restart frontend

# Type-check TypeScript
docker compose exec frontend npx tsc --noEmit

# Lint frontend
docker compose exec frontend npm run lint

# Logs en tiempo real
docker compose logs -f api

# Probar endpoints
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/facets | jq
curl -s -X POST http://localhost:8000/agent/search \
  -H "Content-Type: application/json" \
  -d '{"query": "analizar clausulas de un contrato"}' | jq
```

---

## 11. Decisiones de implementación críticas

1. **asyncpg, no SQLAlchemy ORM.** SQLAlchemy tiene conflictos con sintaxis `::cast` y parámetros nombrados en SQL vectorial. `db_asyncpg.py` mantiene el pool; `db.py` (SQLAlchemy) solo existe para el health check. No introducir queries ORM en features nuevas.

2. **Un único `schemas.py`.** Todos los modelos Pydantic (request y response) viven en `backend/app/schemas.py`. No dispersar en módulos separados.

3. **Stub siempre funcional.** Todo código path debe funcionar con `EMBEDDING_PROVIDER=stub` y `LLM_PROVIDER=stub`. Los stubs son deterministas y no hacen llamadas de red.

4. **Dos pasos de captura.** `POST /prompts/capture` propone metadatos; `POST /prompts` persiste. Nunca persistir sin confirmación del autor (evita basura en el catálogo).

5. **FTS lenient fallback solo en el agente.** `hybrid_search(lenient=True)` usa OR semántico. Solo lo activa `agent_search.py` como fallback. El endpoint `/search` estándar usa AND estricto para mayor precisión.

6. **Sesiones agente en memoria.** Intencionado para PoC. No requiere migración de DB. TTL 15 min, limpieza lazy. Aceptable perder sesiones en reinicio del servicio.

7. **`RecommendCandidate` no extiende `SearchCandidate` en Python.** Los campos están duplicados en el modelo Pydantic (schemas.py línea 115). En TypeScript sí hay `extends`. Construir vía `RecommendCandidate(**c.model_dump(), cuando_usarlo=...)`.
