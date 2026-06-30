# Acervo — Especificación técnica (PoC)

> **Acervo** es el catálogo de prompts de la organización. "Acervo" es el nombre del producto; "el catálogo" se refiere a su función.
> Documento 1 de 2. Acompaña a `acervo-02-plan-implementacion-fases-poc.md`.
> Decisiones de producto y alcance: ver `acervo-00-diseno-poc.md`.
> **Estado: PoC completada. Este documento es la especificación de diseño original.** Para el inventario exacto de lo implementado (rutas de archivo, endpoints, contratos reales) usar `acervo-03-arquitectura-implementada.md` y `acervo-04-referencia-api.md`.
> Destinatario: agente de desarrollo. Audiencia técnica.

## Cómo usar este documento

Este es el **qué** y el **cómo**. El **orden de construcción** y los criterios de aceptación están en el documento de fases. Donde aparezca `⚠ CONFIRMAR`, es una decisión que el desarrollador **no debe inventar**: hay que preguntar a Ángel. Donde aparezca `(calibrar)`, es un parámetro que se ajusta empíricamente durante la PoC, no un valor canónico.

---

## 1. Alcance de la PoC

**Dentro:**
- Captura de prompts con metadatos autogenerados por LLM (confirmados por el autor) y detección de duplicados.
- Búsqueda híbrida (semántica + léxica) sobre prompts canónicos — *Nivel 0*.
- Recomendación por intención: el usuario describe su tarea en lenguaje natural y recibe candidatos explicados — *Nivel 1*.
- Rellenado guiado de variables y entrega de la variante de plataforma.
- Superficie de descubrimiento (explorar por faceta + ejemplos destacados).
- Señales de uso y valoración para ordenar recomendaciones (con semilla curada).
- Una sola plataforma real: **Cowork**.

**Fuera (no construir en PoC original — parcialmente implementado):**
- Ejecución de prompts (vive en las plataformas destino). ❌ sigue fuera
- Bucle agéntico de recuperación (*Nivel 2*): **implementado en Fase 7** (`POST /agent/search`). ✅
- Servidor MCP. ❌ sigue fuera
- Workflow de aprobación activo (los estados existen pero no hay tránsito gobernado).
- Variantes para plataformas distintas de Cowork.
- Reranker dedicado (opcional, solo si la calidad lo exige; ver §6.4).
- Base de datos vectorial dedicada (se usa Postgres + pgvector).

---

## 2. Stack

- **PostgreSQL** con extensión **pgvector** (≥ 0.5 para índice HNSW). Almacén único: relacional + vectorial + full-text (`tsvector`).
- **Backend:** Python con **FastAPI**, **Pydantic v2** para validación, **asyncpg** para todas las operaciones de datos (SQLAlchemy solo en health check). Ver `db_asyncpg.py`.
- **Frontend:** **Next.js 14 App Router** + Tailwind CSS (no Streamlit; se construyó frontend propio desde la PoC para validar UX de forma más fiel).
- **LLM:** proveedor `⚠ CONFIRMAR` (depende de si se permite API externa o se requiere on-prem por ISO 42001 / EU AI Act). Se usa para tres pasos asistidos: generación de metadatos, comprensión de intención y rellenado guiado/explicación.
- **Embeddings:** modelo `⚠ CONFIRMAR` (misma restricción on-prem). La dimensión del vector en el esquema depende del modelo elegido (p. ej. 1536 o 3072 en familias OpenAI `text-embedding-3`). *No se fijan cifras de rendimiento; se miden con el corpus real.*

> El agente debe verificar las versiones concretas de librerías y de pgvector en el entorno objetivo antes de fijar dependencias.

---

## 3. Modelo de datos

Pieza central: separación **prompt canónico** (la intención y la lógica) ↔ **variante por plataforma** (el render). Búsqueda y recomendación operan sobre el canónico; lo que se entrega es la variante.

### 3.1 DDL

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Sustituir <DIM> por la dimensión del modelo de embeddings elegido. ⚠ CONFIRMAR
CREATE TYPE estado_ciclo AS ENUM ('generada','en_uso','propuesta','aprobada','deprecada');
CREATE TYPE visibilidad AS ENUM ('personal','equipo','compartido');
CREATE TYPE tipo_prompt AS ENUM ('system','user','few_shot','cadena','plantilla_agente');
CREATE TYPE criticidad AS ENUM ('baja','media','alta');
CREATE TYPE tipo_adaptacion AS ENUM ('formato','semantica');

CREATE TABLE prompt_canonico (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    titulo          TEXT NOT NULL,
    proposito       TEXT NOT NULL,                 -- autogenerado, confirmado
    cuerpo_canonico TEXT NOT NULL,                 -- con placeholders {{variable}}
    tipo            tipo_prompt NOT NULL,
    idioma          TEXT NOT NULL DEFAULT 'es',
    variables       JSONB NOT NULL DEFAULT '[]',   -- [{nombre,tipo,obligatorio,descripcion}]
    formato_salida  TEXT,
    ejemplos        JSONB NOT NULL DEFAULT '[]',   -- [{input,output}]
    dominio_negocio TEXT[] NOT NULL DEFAULT '{}',
    tipo_tarea      TEXT[] NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    criticidad      criticidad NOT NULL DEFAULT 'baja',
    datos_sensibles BOOLEAN NOT NULL DEFAULT false, -- autogenerado, CONFIRMADO por autor
    estado          estado_ciclo NOT NULL DEFAULT 'generada',
    version         TEXT NOT NULL DEFAULT '0.1.0',
    owner           TEXT NOT NULL,
    equipo          TEXT,
    visibilidad     visibilidad NOT NULL DEFAULT 'personal',
    destacado       BOOLEAN NOT NULL DEFAULT false, -- semilla curada (cold start)
    embedding       vector(<DIM>),
    fts             tsvector,                        -- generada (ver trigger/columna abajo)
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE variante_plataforma (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonico_id     UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
    plataforma      TEXT NOT NULL,                  -- PoC: 'cowork'
    cuerpo_adaptado TEXT NOT NULL,
    tipo_adaptacion tipo_adaptacion NOT NULL DEFAULT 'formato',
    version         TEXT NOT NULL DEFAULT '0.1.0',
    estado          estado_ciclo NOT NULL DEFAULT 'en_uso',
    creado_por      TEXT NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (canonico_id, plataforma)
);

CREATE TABLE registro_uso (
    id           BIGSERIAL PRIMARY KEY,
    variante_id  UUID NOT NULL REFERENCES variante_plataforma(id) ON DELETE CASCADE,
    canonico_id  UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
    usuario      TEXT NOT NULL,
    ts           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE valoracion (
    id          BIGSERIAL PRIMARY KEY,
    canonico_id UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
    usuario     TEXT NOT NULL,
    senal       SMALLINT NOT NULL,                  -- +1 / -1
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (canonico_id, usuario)
);

-- Índices
CREATE INDEX idx_canonico_embedding ON prompt_canonico
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_canonico_fts ON prompt_canonico USING gin (fts);
CREATE INDEX idx_canonico_dominio ON prompt_canonico USING gin (dominio_negocio);
CREATE INDEX idx_canonico_tarea ON prompt_canonico USING gin (tipo_tarea);
CREATE INDEX idx_uso_canonico ON registro_uso (canonico_id);
```

`fts` se construye en español a partir de los campos textuales:
```sql
-- Ejemplo de actualización de fts (trigger o en la capa de aplicación):
UPDATE prompt_canonico SET fts =
    setweight(to_tsvector('spanish', coalesce(titulo,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(proposito,'')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(cuerpo_canonico,'')), 'C') ||
    setweight(to_tsvector('spanish', array_to_string(tags,' ')), 'B');
```

### 3.2 Tabla de evaluación (preparada, NO construir en PoC)

Dejar documentada pero sin implementar: `evaluacion(canonico_id, version, golden_set JSONB, resultado JSONB)`. Es la pieza de regresión del MVP.

---

## 4. Componentes y flujos

### 4.1 Captura / autoría (con metadatos automáticos)

1. Entrada: texto del prompt (lo que el autor ya usa en Cowork) + `owner`.
2. **Embedding** del texto.
3. **Detección de duplicados:** búsqueda vectorial contra `prompt_canonico`. Si la similitud coseno con algún canónico supera el umbral `(calibrar)`, devolver esos candidatos y ofrecer reutilizar en vez de crear. *Necesario, no opcional.*
4. Si el autor decide crear: **generación de metadatos** por LLM (§5.1) → propuesta de `proposito`, `tipo`, `variables`, `formato_salida`, `dominio_negocio`, `tipo_tarea`, `tags`, `criticidad`, `datos_sensibles`.
5. **Confirmación del autor**, con foco obligatorio en `variables` (un placeholder mal extraído rompe el rellenado) y `datos_sensibles`.
6. Persistir: `prompt_canonico` en estado `en_uso`, visibilidad `personal`, + `variante_plataforma` (plataforma `cowork`) con linaje.

### 4.2 Búsqueda híbrida — Nivel 0 (cimiento)

Es la base de todo lo demás. Aunque haya LLM encima, la calidad del sistema está acotada por la calidad de esta recuperación.

- Consulta vectorial: top-k por distancia coseno sobre `embedding`.
- Consulta léxica: top-k por `ts_rank` sobre `fts` (configuración `spanish`).
- **Fusión por Reciprocal Rank Fusion (RRF):** para cada documento, `score = Σ 1/(k_rrf + rank_i)` sobre las listas en que aparece, con `k_rrf = 60` (constante convencional de RRF). RRF no requiere ponderar pesos densa/léxica a mano y es robusto; es la opción por defecto recomendada.

### 4.3 Recomendación por intención — Nivel 1 (la PoC)

Pipeline de **un solo paso** (no agéntico):
1. El usuario describe su tarea en lenguaje natural.
2. **Comprensión de intención** por LLM (§5.2): produce consulta estructurada + consulta expandida para el embedding.
3. Búsqueda híbrida (§4.2) usando la consulta expandida (vectorial) y los términos/facetas (léxica + filtros).
4. **Ordenación** combinando relevancia de recuperación con señales de recomendación (§7).
5. (Opcional) reranking (§6.4).
6. **Explicación de candidatos** por LLM (§5.4): para los top-N, "cuándo usar cada uno".

### 4.4 Rellenado guiado de variables

El usuario no edita plantillas. Dado el `variables` del canónico elegido:
1. El LLM genera una pregunta en lenguaje natural por variable (§5.3).
2. Se recogen respuestas.
3. Se sustituyen los `{{placeholders}}` en `cuerpo_adaptado` de la variante de la plataforma elegida.
4. Se registra el uso (`registro_uso`) y se entrega el prompt final listo para copiar a la plataforma.

### 4.5 Descubrimiento / inspiración

Superficie distinta de la búsqueda, para quien no sabe qué pedir:
- Explorar por `dominio_negocio` y `tipo_tarea` (filtros sobre los `TEXT[]`).
- Sección **destacados** (`destacado = true`): semilla curada que enseña "lo que se puede hacer" y resuelve el arranque en frío del ranking.

---

## 5. Pasos asistidos por LLM (contratos)

Todos deben devolver **JSON válido y nada más** (sin Markdown, sin preámbulo). El backend parsea de forma defensiva.

### 5.1 Generación de metadatos
- **Entrada:** texto del prompt.
- **Salida (JSON):** `{proposito, tipo, idioma, variables:[{nombre,tipo,obligatorio,descripcion}], formato_salida, dominio_negocio:[], tipo_tarea:[], tags:[], criticidad, datos_sensibles}`.
- **Reglas:** detectar placeholders existentes `{{...}}` y proponer variables faltantes; marcar `datos_sensibles=true` si el prompt manejaría PII. Estos dos campos los **confirma el autor**.

### 5.2 Comprensión de intención
- **Entrada:** descripción de la tarea en lenguaje natural.
- **Salida (JSON):** `{dominio_negocio:[], tipo_tarea:[], restricciones:[], consulta_expandida}`. `consulta_expandida` es texto enriquecido que se usa para generar el embedding de la consulta.

### 5.3 Generación de preguntas de rellenado
- **Entrada:** `variables` del canónico.
- **Salida (JSON):** `[{nombre, pregunta}]` — una pregunta clara en lenguaje natural por variable, sin jerga.

### 5.4 Explicación de candidatos
- **Entrada:** intención del usuario + top-N candidatos (título + propósito).
- **Salida (JSON):** `[{id, cuando_usarlo}]` — una frase breve por candidato.

### 5.5 Turno de agente (Fase 7)
- **Entrada:** dict de sesión `{original_query, iteration, last_result_count, user_response}`.
- **Salida (JSON):** acción a ejecutar, uno de:
  - `{"type": "search", "query": str, "dominio": list[str], "tarea": list[str]}`
  - `{"type": "ask_user", "question": str}`
  - `{"type": "done"}`
- El LLM decide qué acción tomar según el estado de la sesión (número de iteraciones, resultados encontrados, respuesta del usuario).

> Los textos exactos de los prompts del sistema para estos pasos los define el desarrollador; lo fijo aquí es la **forma de entrada/salida**, no la redacción.

---

## 6. API (REST, orientativa)

| Método | Ruta | Función |
|---|---|---|
| POST | `/prompts/capture` | Recibe texto crudo; devuelve metadatos propuestos + candidatos duplicados |
| POST | `/prompts` | Crea canónico + variante tras confirmación del autor |
| GET | `/prompts/{id}` | Detalle |
| POST | `/search` | Recibe descripción de tarea; devuelve candidatos ordenados y explicados |
| GET | `/discover` | Explorar por faceta + destacados |
| POST | `/prompts/{id}/fill` | Rellenado guiado: devuelve preguntas / acepta respuestas / entrega prompt final |
| POST | `/prompts/{id}/use` | Registra uso (`registro_uso`) |
| POST | `/prompts/{id}/rate` | Registra valoración (+1/-1) |
| GET | `/facets` | Valores de taxonomía disponibles |

### 6.4 Reranking (opcional)
Solo si la calidad de los candidatos del Nivel 0 + RRF resulta insuficiente en la PoC. Cross-encoder o servicio de rerank sobre los top-k antes de la explicación. No construir por defecto.

---

## 7. Señales de recomendación

> No implementar "lo más usado = lo más recomendable" tal cual: genera bucle de popularidad, confunde frecuencia con calidad y deja la señal vacía en arranque en frío. Combinar señales y capar la popularidad.

Puntuación de ordenación = combinación de:
- **Relevancia de recuperación** (RRF de §4.2) — peso dominante.
- **Uso implícito** (`registro_uso`, p. ej. recuento normalizado en ventana temporal) — con tope para que no domine.
- **Valoración explícita** (`valoracion`, balance +1/−1).
- **Recencia / impulso a lo nuevo** — para que lo recién añadido tenga oportunidad.
- **Destacado** (`destacado=true`) — los curados aparecen en descubrimiento y reciben prioridad cuando no hay datos de uso.

Los pesos concretos son `(calibrar)` durante la PoC. El arranque en frío se resuelve con los destacados, no con el histórico de uso (que no existe al principio).

---

## 8. Decisiones que el agente debe confirmar (no inventar)

1. `⚠` Proveedor de LLM y modelo de embeddings, y si hay requisito on-prem.
2. `⚠` Dimensión del vector (`<DIM>`) según el modelo de embeddings.
3. `⚠` Valores iniciales de taxonomía: lista de `dominio_negocio` y `tipo_tarea`.
4. `⚠` Conjunto de prompts semilla destacados (contenido curado para el arranque).
5. `(calibrar)` Umbral de similitud para duplicados.
6. `(calibrar)` Pesos de la puntuación de recomendación.
7. `⚠` Modelo de identidad de usuario en la PoC (¿login real o `owner` simple?).
