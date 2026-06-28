# Acervo — Plan de implementación por fases (PoC)

> **Acervo** es el catálogo de prompts de la organización.
> Documento 2 de 2. Acompaña a `acervo-01-especificacion-tecnica-poc.md`.
> Destinatario: agente de desarrollo.

## Principio de orden

El orden no es negociable en un punto: **la recuperación (Nivel 0) se construye antes que cualquier capa de LLM encima.** Un sistema de recomendación es tan bueno como su recuperación; si se monta la capa de intención sobre una búsqueda mala, se amplifican los fallos y deja de poder depurarse (no se sabe si el error está en recuperar o en razonar).

Antes de empezar, resolver con Ángel las decisiones marcadas `⚠ CONFIRMAR` en la especificación (§8). Sin el modelo de embeddings no se puede fijar la dimensión del vector ni crear el esquema definitivo.

Cada fase indica **alcance**, **tareas**, **entregable** y **criterio de aceptación**. La PoC se considera completa cuando se cumple el criterio de la Fase 6, que es de *adopción*, no técnico.

---

## Fase 0 — Cimientos

**Alcance:** entorno reproducible y esquema de datos.

**Tareas:**
- Proyecto backend (FastAPI) + configuración por entorno (claves de LLM/embeddings, cadena de conexión).
- Postgres con pgvector; migraciones con el DDL de la especificación (§3), con `<DIM>` ya resuelto.
- Cargador de datos semilla: taxonomía (`dominio_negocio`, `tipo_tarea`) y prompts destacados.
- Cliente de embeddings y cliente de LLM con parseo defensivo de JSON.

**Entregable:** API que arranca, base de datos migrada, semillas cargadas.

**Criterio de aceptación:** se puede insertar un prompt a mano, generar su embedding y su `fts`, y recuperarlo por ambas vías por separado.

---

## Fase 1 — Captura con metadatos automáticos y deduplicación

**Alcance:** meter datos al catálogo con baja fricción y sin duplicar.

**Tareas:**
- `POST /prompts/capture`: embedding del texto → detección de duplicados (umbral `(calibrar)`) → si no hay duplicado, generación de metadatos por LLM (§5.1).
- Confirmación del autor (en el front), con énfasis en `variables` y `datos_sensibles`.
- `POST /prompts`: crea `prompt_canonico` (`en_uso`, `personal`) + `variante_plataforma` (`cowork`) con linaje.

**Entregable:** flujo de captura completo de extremo a extremo.

**Criterio de aceptación:** al capturar un prompt casi idéntico a uno existente, el sistema lo detecta y ofrece reutilizar en lugar de crear; al capturar uno nuevo, propone metadatos razonables que el autor confirma.

---

## Fase 2 — Búsqueda híbrida (Nivel 0)

**Alcance:** el cimiento de recuperación.

**Tareas:**
- Consulta vectorial (coseno) y consulta léxica (`ts_rank`, config `spanish`).
- Fusión por **RRF** (`k_rrf = 60`).
- Filtros por faceta (`dominio_negocio`, `tipo_tarea`).

**Entregable:** endpoint interno de búsqueda que devuelve candidatos ordenados a partir de una consulta de texto ya estructurada.

**Criterio de aceptación:** consultas con términos exactos/siglas y consultas parafraseadas recuperan ambas el prompt correcto; medir con un set pequeño de consultas de prueba representativas (definir con Ángel).

---

## Fase 3 — Recomendación por intención (Nivel 1)

**Alcance:** la experiencia central para la audiencia no técnica.

**Tareas:**
- `POST /search`: comprensión de intención por LLM (§5.2) → consulta expandida + facetas → búsqueda híbrida (Fase 2) → explicación de candidatos (§5.4).
- Ordenación con relevancia de recuperación (las señales de recomendación entran en la Fase 5).

**Entregable:** el usuario describe una tarea en lenguaje natural y recibe 2-3 candidatos explicados.

**Criterio de aceptación:** descripciones vagas y de negocio ("necesito sacar las acciones de un acta") devuelven candidatos pertinentes con una explicación útil de cuándo usar cada uno.

---

## Fase 4 — Rellenado guiado y entrega

**Alcance:** del candidato elegido al prompt listo para usar.

**Tareas:**
- `POST /prompts/{id}/fill`: generación de preguntas por variable (§5.3) → recogida de respuestas → sustitución de placeholders en la variante de Cowork.
- Registro de uso (`registro_uso`) al entregar.

**Entregable:** prompt final relleno y copiable, con el uso registrado.

**Criterio de aceptación:** un usuario que no entiende de plantillas obtiene el prompt completo solo respondiendo preguntas en lenguaje natural.

---

## Fase 5 — Descubrimiento y señales de recomendación

**Alcance:** inspiración + ordenación que no caiga en el bucle de popularidad.

**Tareas:**
- `GET /discover`: explorar por faceta + sección de destacados.
- `POST /prompts/{id}/rate` y consumo de `registro_uso`.
- Puntuación de ordenación combinando relevancia + uso (con tope) + valoración + recencia + destacado (§7); pesos `(calibrar)`.

**Entregable:** superficie de descubrimiento y ranking multi-señal en la búsqueda.

**Criterio de aceptación:** con el catálogo vacío de histórico, los destacados guían igualmente al usuario; un prompt popular no aplasta a uno nuevo y bien valorado.

---

## Fase 6 — UX y validación de adopción

**Alcance:** lo que de verdad valida la PoC.

**Tareas:**
- Pulido de la UX en Streamlit: descubrir, buscar por intención, capturar, detalle + rellenado, valorar.
- Instrumentación mínima para medir adopción: tareas iniciadas, candidatos entregados, prompts usados, valoraciones, captura de nuevos prompts.

**Entregable:** PoC usable de extremo a extremo por un perfil de negocio.

**Criterio de aceptación (de adopción, el que cierra la PoC):** un usuario de negocio (1) describe una tarea en lenguaje natural, (2) recibe un prompt adecuado adaptado y relleno, (3) percibe el resultado como mejor que improvisar, y (4) descubre usos que no conocía. Si esto no engancha, el problema no se resuelve añadiendo gobierno.

---

## Lo que NO se construye en la PoC

Recordatorio para evitar deriva de alcance: nada de ejecución de prompts, bucle agéntico (Nivel 2), servidor MCP, workflow de aprobación activo, variantes para plataformas distintas de Cowork, ni reranker por defecto. Todo eso es MVP o posterior, y el modelo de datos ya está preparado para incorporarlo sin rehacerse.
