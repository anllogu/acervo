# Acervo — Referencia completa de la API

> Base URL: `http://localhost:8000`
> OpenAPI interactivo: `http://localhost:8000/docs`
> Todos los endpoints devuelven y aceptan `application/json`.
> Destinatario: agente de desarrollo. Para arquitectura ver `acervo-03-arquitectura-implementada.md`.

---

## Resumen de endpoints

| Método | Ruta | Fase | Función |
|--------|------|------|---------|
| GET | `/health` | 0 | Liveness check |
| POST | `/prompts/capture` | 1 | Analiza texto → propone metadatos + duplicados |
| POST | `/prompts` | 1 | Persiste prompt confirmado por el autor |
| GET | `/prompts` | 6 | Lista prompts del usuario (`?owner=`) |
| POST | `/search` | 2 | Búsqueda híbrida directa |
| GET | `/discover` | 5 | Explorar sin query (featured + multi-señal) |
| GET | `/facets` | 2 | Valores de taxonomía disponibles |
| POST | `/recommend` | 3 | Intención → candidatos explicados (1 shot) |
| GET | `/prompts/{id}` | 3 | Detalle de un prompt + variante Cowork |
| POST | `/prompts/{id}/use` | 5 | Registra uso implícito |
| GET | `/prompts/{id}/fill` | 4 | Genera preguntas de rellenado por variable |
| POST | `/prompts/{id}/fill` | 4 | Acepta respuestas → devuelve prompt relleno |
| POST | `/prompts/{id}/rate` | 5 | Valoración explícita (+1 / -1) |
| GET | `/stats` | 6 | Métricas de adopción |
| POST | `/agent/search` | 7 | Búsqueda agéntica conversacional (ReAct) |

---

## GET /health

Liveness check. Sin parámetros.

**Response 200:**
```json
{ "status": "ok", "db": "ok" }
```

---

## POST /prompts/capture

Paso 1 del flujo de captura. Analiza el texto crudo: genera embeddings, detecta duplicados y propone metadatos via LLM. No persiste nada.

**Request:**
```json
{
  "texto": "Analiza el siguiente contrato e identifica...",
  "owner": "angel.llosa"
}
```
- `texto`: mínimo 10 caracteres.
- `owner`: identificador del usuario (string libre en PoC).

**Response 200:**
```json
{
  "metadata_propuesta": {
    "proposito": "...",
    "tipo": "user",
    "idioma": "es",
    "variables": [
      { "nombre": "contrato", "tipo": "text", "obligatorio": true, "descripcion": "..." }
    ],
    "formato_salida": null,
    "dominio_negocio": ["legal"],
    "tipo_tarea": ["extraccion"],
    "tags": [],
    "criticidad": "alta",
    "datos_sensibles": true
  },
  "duplicados_candidatos": [
    { "id": "uuid", "slug": "analizar-contrato", "titulo": "Analizar cláusulas...", "similitud": 0.92 }
  ]
}
```
- `duplicados_candidatos`: vacío cuando `EMBEDDING_PROVIDER=stub`.
- `datos_sensibles` y `variables` deben ser confirmados por el autor antes de persistir.

---

## POST /prompts

Paso 2 del flujo de captura. Persiste el prompt canónico + variante Cowork tras la confirmación del autor.

**Request:**
```json
{
  "texto": "Analiza el siguiente contrato...",
  "titulo": "Analizar cláusulas de contrato",
  "metadata": {
    "proposito": "...",
    "tipo": "user",
    "idioma": "es",
    "variables": [...],
    "formato_salida": null,
    "dominio_negocio": ["legal"],
    "tipo_tarea": ["extraccion"],
    "tags": ["contrato", "legal"],
    "criticidad": "alta",
    "datos_sensibles": true
  },
  "owner": "angel.llosa",
  "visibilidad": "personal"
}
```
- `visibilidad`: `"personal"` | `"equipo"` | `"compartido"`.

**Response 201:**
```json
{
  "id": "uuid",
  "slug": "analizar-clausulas-de-contrato",
  "titulo": "Analizar cláusulas de contrato",
  "estado": "en_uso",
  "variante_cowork_id": "uuid"
}
```

---

## GET /prompts?owner={owner}

Lista los prompts del usuario. Devuelve todos los estados excepto `deprecada`.

**Query params:**
- `owner` (string, default `"anonymous"`)

**Response 200:**
```json
{
  "owner": "angel.llosa",
  "total": 3,
  "prompts": [
    {
      "id": "uuid",
      "slug": "...",
      "titulo": "...",
      "proposito": "...",
      "estado": "en_uso",
      "criticidad": "baja",
      "datos_sensibles": false,
      "destacado": false,
      "variables_count": 2,
      "creado_en": "2026-06-15T10:30:00Z"
    }
  ]
}
```

---

## POST /search

Búsqueda híbrida directa (vectorial + léxica con RRF). Sin comprensión de intención LLM. Útil para búsquedas exactas o con filtros de faceta.

**Request:**
```json
{
  "query": "extraer acciones reunión",
  "dominio_negocio": ["operaciones"],
  "tipo_tarea": ["extraccion"],
  "limit": 10
}
```
- `query`: mínimo 1 carácter.
- `dominio_negocio`, `tipo_tarea`: arrays vacíos = sin filtro.
- `limit`: 1–50, default 10.

**Response 200:**
```json
{
  "query": "extraer acciones reunión",
  "total": 2,
  "candidates": [
    {
      "id": "uuid",
      "slug": "resumir-acta",
      "titulo": "Resumir acta de reunión",
      "proposito": "...",
      "dominio_negocio": ["operaciones", "comunicacion"],
      "tipo_tarea": ["extraccion", "generacion"],
      "tags": ["acta", "reunion"],
      "destacado": true,
      "criticidad": "baja",
      "datos_sensibles": false,
      "variables_count": 1,
      "rrf_score": 0.847
    }
  ]
}
```
- `rrf_score`: puntuación combinada (RRF + señales multi-señal). Solo orientativo.

---

## GET /discover?dominio_negocio=&tipo_tarea=

Exploración sin query de búsqueda. Devuelve prompts destacados y con buenas señales, ordenados por `discover_score` (sin componente de relevancia).

**Query params:**
- `dominio_negocio` (string, repetible): filtro de faceta.
- `tipo_tarea` (string, repetible): filtro de faceta.
- `limit` (int, default 20): máximo de resultados.

**Response 200:**
```json
{
  "prompts": [ /* array de SearchCandidate */ ],
  "total": 4
}
```

---

## GET /facets

Valores únicos disponibles en la taxonomía. Se usa para poblar los filtros de la UI.

**Response 200:**
```json
{
  "dominio_negocio": ["comunicacion", "finanzas", "legal", "operaciones", "rrhh"],
  "tipo_tarea": ["clasificacion", "extraccion", "generacion", "razonamiento"]
}
```

---

## POST /recommend

Recomendación por intención (Fase 3). El LLM interpreta la descripción en lenguaje natural, genera una consulta expandida, ejecuta búsqueda híbrida y explica cada candidato.

**Request:**
```json
{
  "descripcion": "necesito sacar las acciones de un acta de reunión",
  "limit": 10
}
```
- `descripcion`: mínimo 5 caracteres.
- `limit`: 1–20, default 10.

**Response 200:**
```json
{
  "descripcion": "necesito sacar las acciones de un acta de reunión",
  "intent": {
    "dominio_negocio": ["operaciones"],
    "tipo_tarea": ["extraccion"],
    "restricciones": [],
    "consulta_expandida": "necesito sacar las acciones de un acta de reunión"
  },
  "total": 2,
  "candidates": [
    {
      "id": "uuid",
      "slug": "resumir-acta",
      "titulo": "Resumir acta de reunión",
      "proposito": "...",
      "dominio_negocio": ["operaciones"],
      "tipo_tarea": ["extraccion"],
      "tags": [],
      "destacado": true,
      "criticidad": "baja",
      "datos_sensibles": false,
      "variables_count": 1,
      "rrf_score": 0.85,
      "cuando_usarlo": "Usar cuando necesites extraer decisiones y acciones de una reunión documentada."
    }
  ]
}
```

---

## GET /prompts/{id}

Detalle completo de un prompt, incluyendo el cuerpo canónico y la variante Cowork.

**Path param:** `id` — UUID del prompt canónico.

**Response 200:**
```json
{
  "id": "uuid",
  "slug": "resumir-acta",
  "titulo": "Resumir acta de reunión",
  "proposito": "...",
  "cuerpo_canonico": "Eres un asistente experto en gestión de reuniones...\n{{acta}}",
  "variables": [
    { "nombre": "acta", "tipo": "text", "obligatorio": true, "descripcion": "Texto del acta" }
  ],
  "dominio_negocio": ["operaciones"],
  "tipo_tarea": ["extraccion"],
  "tags": ["acta", "reunion"],
  "destacado": true,
  "criticidad": "baja",
  "datos_sensibles": false,
  "estado": "en_uso",
  "variante_cowork": {
    "id": "uuid-variante",
    "cuerpo_adaptado": "Eres un asistente experto..."
  }
}
```
- `variante_cowork`: `null` si no existe variante para Cowork.

**Response 404:** `{ "detail": "Prompt no encontrado" }`

---

## POST /prompts/{id}/use

Registra un uso implícito (señal de recomendación). Llamar cuando el usuario copia el prompt.

**Request:**
```json
{ "usuario": "angel.llosa" }
```

**Response 200:**
```json
{ "ok": true }
```

---

## GET /prompts/{id}/fill

Genera las preguntas de rellenado para cada variable del prompt.

**Response 200:**
```json
{
  "prompt_id": "uuid",
  "titulo": "Resumir acta de reunión",
  "questions": [
    {
      "nombre": "acta",
      "pregunta": "¿Cuál es el texto del acta de la reunión?",
      "descripcion": "Texto del acta",
      "obligatorio": true
    }
  ]
}
```

---

## POST /prompts/{id}/fill

Acepta las respuestas del usuario, sustituye variables en la variante Cowork y registra el uso.

**Request:**
```json
{
  "respuestas": {
    "acta": "Reunión del 2026-06-30. Asistentes: Ana, Pedro...",
    "formato": "lista"
  },
  "usuario": "angel.llosa"
}
```

**Response 200:**
```json
{
  "prompt_id": "uuid",
  "titulo": "Resumir acta de reunión",
  "prompt_relleno": "Eres un asistente experto... Reunión del 2026-06-30..."
}
```

---

## POST /prompts/{id}/rate

Valoración explícita. Si el usuario ya valoró este prompt, actualiza el voto (upsert).

**Request:**
```json
{
  "senal": 1,
  "usuario": "angel.llosa"
}
```
- `senal`: `1` (positivo) o `-1` (negativo).

**Response 200:**
```json
{ "ok": true }
```

---

## GET /stats

Métricas globales de adopción del catálogo.

**Response 200:**
```json
{
  "total_prompts": 4,
  "total_usos": 12,
  "total_valoraciones_positivas": 8,
  "total_valoraciones_negativas": 1,
  "prompts_this_week": 1,
  "usos_this_week": 5
}
```

---

## POST /agent/search

Búsqueda agéntica conversacional (Fase 7). Stateful via `session_id`. El agente ejecuta un bucle ReAct: busca, evalúa resultados, y puede pedir clarificación al usuario antes de devolver candidatos.

### Turno 1 — nueva sesión

**Request:**
```json
{
  "query": "me puedes buscar un validador de contratos",
  "session_id": null,
  "user_response": null
}
```

**Response 200 — resultados directos (`status: "done"`):**
```json
{
  "session_id": "uuid-de-sesion",
  "status": "done",
  "question": null,
  "intent": {
    "dominio_negocio": ["legal"],
    "tipo_tarea": [],
    "restricciones": [],
    "consulta_expandida": "me puedes buscar un validador de contratos"
  },
  "candidates": [
    {
      "id": "uuid",
      "slug": "analizar-contrato",
      "titulo": "Analizar cláusulas de un contrato",
      "cuando_usarlo": "...",
      /* + resto de campos de SearchCandidate */
    }
  ],
  "reasoning": [
    { "step": 1, "action": "buscar", "detail": "Buscando prompts para: \"...\"" },
    { "step": 2, "action": "buscar", "detail": "Búsqueda ampliada (términos OR): 2 resultado(s)" },
    { "step": 3, "action": "finalizar", "detail": "Devolviendo 2 resultado(s) finales." }
  ]
}
```

**Response 200 — clarificación necesaria (`status: "waiting"`):**
```json
{
  "session_id": "uuid-de-sesion",
  "status": "waiting",
  "question": {
    "text": "No encontré suficientes resultados para «xyz». ¿Puedes darme más contexto?",
    "context": "Encontré 0 resultado(s) en la búsqueda inicial."
  },
  "intent": null,
  "candidates": null,
  "reasoning": [
    { "step": 1, "action": "buscar", "detail": "Buscando prompts para: \"xyz\"" },
    { "step": 2, "action": "preguntar", "detail": "No encontré suficientes resultados..." }
  ]
}
```

### Turno 2 — continuar sesión con respuesta del usuario

**Request:**
```json
{
  "query": "xyz",
  "session_id": "uuid-de-sesion",
  "user_response": "necesito analizar cláusulas de un contrato legal"
}
```

**Response 200:** igual que el caso `"done"` del turno 1.

### Notas del agente

- `session_id` expirado (>15 min) → la sesión se recrea silenciosamente.
- El campo `reasoning` siempre está presente (array vacío en caso de error interno).
- El fallback OR en FTS se activa automáticamente cuando el modo AND estricto devuelve 0 resultados. Visible en `reasoning` como paso `"buscar"` adicional.
- Máximo `MAX_ITERATIONS=3` búsquedas por sesión.

---

## Modelos de datos compartidos

### SearchCandidate

```typescript
interface SearchCandidate {
  id: string
  slug: string
  titulo: string
  proposito: string
  dominio_negocio: string[]
  tipo_tarea: string[]
  tags: string[]
  destacado: boolean
  criticidad: "baja" | "media" | "alta"
  datos_sensibles: boolean
  variables_count: number
  rrf_score: number
}
```

### RecommendCandidate

```typescript
interface RecommendCandidate extends SearchCandidate {
  cuando_usarlo: string    // explicación LLM de cuándo usar este prompt
}
```

### IntentParsed

```typescript
interface IntentParsed {
  dominio_negocio: string[]
  tipo_tarea: string[]
  restricciones: string[]
  consulta_expandida: string
}
```

### Variable

```typescript
interface Variable {
  nombre: string
  tipo: string        // "text" en PoC
  obligatorio: boolean
  descripcion: string
}
```
