# Acervo — Documento de diseño (PoC → MVP)

> **Acervo** es el catálogo de prompts de la organización. A lo largo del documento, "Acervo" es el nombre del producto y "el catálogo" se usa para referirse a su función.
> Estado: **PoC completada** (Fases 0–7, junio 2026). Documento de diseño original conservado como referencia de intención.
> Foco de la PoC: **UX y adopción**. El gobierno se deja *modelado y preparado*, no activado.
> Audiencia final del sistema: **perfiles no técnicos** (negocio). La audiencia de este documento es técnica.
> Para el estado real de implementación ver `acervo-03-arquitectura-implementada.md`.

---

## 1. Propósito y alcance

El sistema es un **catálogo** de prompts: la fuente de verdad (*system of record*) de los prompts de la organización. Permite descubrir, encontrar y obtener el prompt adecuado para una tarea, adaptado a la plataforma donde se vaya a usar.

**Lo que el catálogo NO es:** no ejecuta prompts. La ejecución vive en las plataformas destino (Copilot, Cowork, Claude, Delfos…), y cada una mantiene su propia auditoría de ejecución. El catálogo gobierna **artefactos** (los prompts), no **ejecuciones**. Esta separación evita duplicar la responsabilidad de auditar PII, coste y trazabilidad de uso real, que ya asumen las plataformas.

Patrón de interacción: **recomendador**, no ejecutor. El usuario describe lo que quiere hacer; el sistema le entrega el prompt adecuado (uno o varios candidatos), ya adaptado a la plataforma indicada y con las variables rellenadas de forma guiada. La salida es *el prompt listo para usar*, que el usuario lleva a su plataforma.

---

## 2. Principios de diseño

1. **Separación de responsabilidades.** El catálogo es el sistema de verdad de los prompts; las plataformas son el sistema de verdad de las ejecuciones.
2. **Intención primero.** La audiencia no técnica no busca por taxonomía; describe tareas en lenguaje natural. La capa de comprensión de intención es el suelo mínimo, no un refinamiento.
3. **Descubrimiento además de búsqueda.** El problema de adopción central es que la gente no sabe qué quiere ni qué es posible. El catálogo debe *inspirar* (explorar, ver ejemplos destacados), no solo responder consultas.
4. **Captura sin fricción, gobierno donde importa.** Persistir lo que se usa es barato y casi automático; el control de calidad (aprobación) se aplica solo a lo que se comparte con otros.
5. **Canónico + variantes.** Un prompt tiene una versión canónica (la intención y la lógica) y renders por plataforma. La adaptación produce artefactos versionables, nunca transformaciones efímeras sin trazar.
6. **Gobierno preparado, no prematuro.** El modelo de datos contempla versionado, estados y aprobación desde el inicio; el workflow de aprobación no se construye en la PoC.

---

## 3. Decisiones cerradas (con su porqué)

| Decisión | Elección | Motivo |
|---|---|---|
| Ejecución | Fuera del catálogo | Las plataformas ya auditan sus ejecuciones; duplicarlo crea un segundo punto de riesgo de PII/coste |
| Patrón | Recomendador (entrega el prompt) | Coherente con que la ejecución vive en otro sitio |
| Audiencia | No técnica (negocio) | Determina que la interfaz sea por intención y el rellenado guiado |
| Metadatos | Autogenerados por LLM, confirmados por el autor | El autor no técnico no producirá buenos metadatos a mano; sin buenos metadatos el catálogo no es buscable |
| Adaptación por plataforma | LLM como herramienta de **autoría**, no de **consumo** | Lo que se sirve es siempre una variante ya validada, nunca algo generado en el instante de consumo |
| Modelo | Canónico + variantes por plataforma | Permite añadir plataformas sin rehacer el esquema |
| Foco PoC | UX y adopción | El riesgo no es técnico, es que nadie use ni alimente el catálogo |
| Gobierno | Modelado pero no activo en PoC | El versionado/aprobación importa, pero no es donde está el riesgo inicial |

---

## 4. Modelo de datos

La pieza central es la separación **PromptCanónico** (fuente) ↔ **VarianteDePlataforma** (render). La búsqueda y la recomendación operan sobre el canónico; lo que se entrega es la variante de la plataforma elegida.

### 4.1 PromptCanónico

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `slug` | string | identificador legible |
| `titulo` | string | |
| `proposito` | text | para qué sirve y cuándo usarlo (autogenerado, confirmado) |
| `cuerpo_canonico` | text | lógica del prompt con placeholders `{{variable}}` |
| `tipo` | enum | system / user / few-shot / cadena / plantilla de agente |
| `idioma` | string | |
| `variables` | json | lista: nombre, tipo, obligatorio, descripción (autogenerado, confirmado) |
| `formato_salida` | text | qué produce |
| `ejemplos` | json | al menos un par input→output |
| `dominio_negocio` | tag[] | faceta de clasificación |
| `tipo_tarea` | tag[] | extracción / clasificación / generación / razonamiento / agéntico |
| `tags` | tag[] | libres |
| `criticidad` | enum | baja / media / alta |
| `marca_datos_sensibles` | bool | autogenerado, **confirmado por el autor** |
| `plataformas_soportadas` | enum[] | qué variantes existen |
| `estado` | enum | ver §5 |
| `version` | semver | |
| `owner` | ref usuario | |
| `equipo` | ref | |
| `visibilidad` | enum | personal / equipo / compartido |
| `embedding` | vector | sobre propósito + cuerpo + ejemplos, para búsqueda semántica |
| `creado_en` / `actualizado_en` | timestamp | |

### 4.2 VarianteDePlataforma

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `canonico_id` | ref | linaje al prompt del que deriva |
| `plataforma` | enum | Cowork / Copilot / Claude / Delfos / … |
| `cuerpo_adaptado` | text | el render para esa plataforma |
| `tipo_adaptacion` | enum | formato (envoltorio) / semántica (lógica distinta) — ver §11 |
| `version` | semver | |
| `estado` | enum | ver §5 |
| `creado_por` | ref usuario | |

### 4.3 Entidades de soporte

- **RegistroDeUso**: `variante_id`, `usuario`, `timestamp`. Señal implícita para recomendación (§8). No registra el resultado de la ejecución (eso vive en la plataforma), solo que se recuperó/copió desde el catálogo.
- **Valoración**: `canonico_id`, `usuario`, `señal` (pulgar arriba/abajo o estrellas), `timestamp`. Señal explícita.
- **Evaluación** *(preparada, fuera de PoC)*: `canonico_id`, `version`, `golden_set`, `resultado`. Para regresión cuando cambia versión o modelo.

---

## 5. Ciclo de vida y estados

Aplica tanto a canónicos como a variantes. La clave es **separar "registrar uso" de "promover a compartido"**: si se fusionan, se aprueba sin revisar (gobierno falso); si todo pasa por revisión obligatoria, se mata la adopción.

```
generada        → artefacto recién creado por el LLM, aún efímero
en_uso          → el autor confirma que lo usa: se persiste y se traza (linaje), pero es PERSONAL.
                  Baja fricción, casi un clic. No contamina el catálogo común.
propuesta       → el autor (o un par) la propone para uso compartido
aprobada        → revisada y disponible para otros; se considera canon
deprecada       → retirada
```

- **`generada → en_uso`** es de baja fricción y es lo que evita que las variantes se evaporen.
- **`en_uso → propuesta → aprobada`** es donde se aplica el gobierno. *En la PoC este tramo se deja modelado pero el workflow de aprobación no se construye*; basta con que los estados existan.

---

## 6. Flujos clave

### 6.1 Captura / autoría (con metadatos automáticos)

1. El usuario trae o escribe un prompt (típicamente la variante que ya está usando en Cowork).
2. **Antes de persistir**, detección de casi-duplicados por embeddings: si ya existe uno equivalente, se ofrece reutilizarlo en lugar de crear otro. *Esto es necesario, no opcional*: el bucle de captura sin este control convierte el catálogo en una fábrica de casi-duplicados.
3. El LLM genera los metadatos: propósito, clasificación, tags, variables detectadas, marca de datos sensibles.
4. El autor confirma (un clic), revisando especialmente **variables** y **marca PII**.
5. Se persiste como `en_uso` / personal, con linaje a su canónico (o creando uno nuevo).

### 6.2 Descubrimiento / inspiración

Superficie distinta de la búsqueda, para quien no sabe qué pedir: explorar por dominio de negocio y tipo de tarea, y una sección de **ejemplos destacados/curados** que enseñan "lo que se puede hacer". Esta superficie es la que ataca directamente el problema de adopción y la que resuelve el arranque en frío del sistema de recomendación (§8).

### 6.3 Recomendación por intención

1. El usuario describe su tarea en lenguaje natural ("necesito sacar las acciones de un acta").
2. **Comprensión de intención** (LLM): traduce el lenguaje vago a una consulta estructurada (dominio, tipo de tarea, restricciones).
3. **Búsqueda híbrida** (semántica + palabra clave) sobre los canónicos.
4. **Reranking** (opcional, cuando crezca el catálogo) para afinar precisión.
5. Se presentan los mejores candidatos con explicación de cuándo usar cada uno.
6. El usuario elige plataforma → se entrega la **variante** correspondiente.

### 6.4 Rellenado guiado de variables

El usuario no edita plantillas. El sistema pregunta en lenguaje natural por cada variable ("¿de qué reunión son las actas?", "¿lo quieres como lista o como tabla?") y rellena los huecos. Refuerza lo conversacional en todo el flujo.

---

## 7. Capa de recuperación — por niveles

No saltar directo al agente completo en la PoC: un agente solo es tan bueno como su recuperación, y un agente sobre mala recuperación *amplifica* el fallo y es más difícil de depurar.

- **Nivel 0 — base (obligatorio):** búsqueda híbrida directa (semántica + palabra clave). Es el cimiento aunque haya un LLM encima. La búsqueda solo-vectorial falla con siglas y nombres exactos; combinar densa + léxica mejora el recall.
- **Nivel 1 — la PoC:** comprensión de intención con LLM + búsqueda híbrida + (reranking opcional) + presentación de candidatos con explicación. Es un *pipeline de un paso*, no un bucle agéntico. Da el grueso de la experiencia "dime qué quieres y te encuentro el prompt", es barato y, sobre todo, **medible**.
- **Nivel 2 — agéntico (Fase 7, implementado en PoC):** recuperación agéntica con bucle ReAct: el LLM decide si buscar de nuevo, pedir clarificación al usuario, o finalizar. Implementado en `POST /agent/search` con sesiones en memoria y UI conversacional en `/agente`. Ver `acervo-03-arquitectura-implementada.md §7`.

---

## 8. Valoración y señales de recomendación

> Advertencia de diseño: **"lo más usado = lo más recomendable" no se debe implementar tal cual.** Genera un bucle de popularidad (lo visible se usa más y se vuelve más visible), confunde frecuencia con calidad, y deja la señal vacía en el arranque en frío — justo durante la PoC. Además choca con el objetivo de ayudar a descubrir la *amplitud* de lo posible.

Enfoque recomendado, combinando señales en lugar de una sola:

- **Uso implícito** (`RegistroDeUso`): cuántas veces se recupera/copia.
- **Valoración explícita** (`Valoración`): pulgar arriba/abajo, más fiable que las estrellas para perfiles no técnicos.
- **Recencia**: un impulso a lo nuevo para que tenga oportunidad de surgir y no quede sepultado por lo popular.
- **Tope a la popularidad**: que la frecuencia no domine el ranking; mezclar con las otras señales.
- **Ejemplos curados/destacados**: semilla editorial que resuelve el arranque en frío y cumple el objetivo de inspiración. Es la pieza que más aporta al inicio, cuando no hay datos de uso.

---

## 9. Arquitectura técnica (PoC → MVP)

Objetivo: minimizar piezas móviles en la PoC sin cerrar puertas al MVP.

- **Almacén único: PostgreSQL + pgvector.** Da relacional, vectorial y búsqueda por texto (`tsvector`) en el mismo sistema → permite **búsqueda híbrida sin** añadir una base de datos vectorial aparte. Escala razonablemente al MVP.
- **Embeddings:** la elección depende de si se puede enviar texto a una API externa o se requiere on-prem por cumplimiento (relevante por ISO 42001 / EU AI Act). *No se fijan cifras de rendimiento aquí: dependen del corpus real y deben medirse con los propios prompts.*
- **Reranking:** opcional, cuando el catálogo crezca (cross-encoder o servicio de rerank).
- **API:** servicio backend (p. ej. FastAPI).
- **Frontend PoC:** algo rápido (p. ej. Streamlit) para validar UX; front propio en el MVP.
- **Diferido al MVP:** exposición del catálogo como **servidor MCP**, para que los clientes (agentes/IDEs) recuperen la variante aprobada según qué plataforma la pide. Encaja con el sistema KB-first con recuperación vía MCP. No construir en la PoC.
- **Alternativa pospuesta:** base de datos vectorial dedicada (Qdrant/Weaviate) solo si el volumen lo justifica; en la PoC sería complejidad prematura.

---

## 10. Qué valida la PoC (criterios de adopción)

El riesgo principal no es técnico: es **por qué un perfil no técnico iría al catálogo en lugar de pedirle directamente a Cowork lo que quiere**. Cowork ya obedece en lenguaje natural sin prompts. El catálogo solo se gana su sitio si ofrece algo tangiblemente mejor:

- un resultado claramente superior al de improvisar, o
- el respaldo de que es un prompt aprobado y conforme a políticas, o
- **inspiración**: enseñarle lo que ni sabía que podía pedir.

La PoC se considera validada si un usuario de negocio: (1) describe una tarea en lenguaje natural, (2) recibe un prompt adecuado adaptado y relleno, (3) percibe el resultado como mejor que improvisar, y (4) descubre usos que no conocía. Si esto no engancha, el resto del gobierno es irrelevante porque nadie alimentará el catálogo.

---

## 11. Riesgos y decisiones abiertas

- **¿Formato vs semántica entre plataformas?** Aún sin determinar. Si las diferencias son de *formato* (mismo prompt, distinto envoltorio — p. ej. Claude responde bien a estructura en etiquetas XML), basta el modelo "un canónico, varios renders". Si son *semánticas* (en Copilot referencia archivos del repo, en Delfos invoca una herramienta concreta), en esos casos son **prompts hermanos** de una misma tarea, no renders de uno solo. Probablemente haya de los dos. **El propio bucle de captura de la PoC dará el dato**: observar qué adaptaciones hace realmente la gente al llevar un canónico a Cowork. No construir el adaptador automático entre plataformas hasta tener esa evidencia.
- **Calidad de metadatos autogenerados.** Mitigado con confirmación del autor en variables y PII; vigilar en la PoC si la clasificación automática es suficientemente buena.
- **Proliferación de casi-duplicados.** Mitigado con detección por embeddings en la captura (§6.1).
- **Bucle de popularidad en el ranking.** Mitigado con mezcla de señales y curaduría (§8).

---

## 12. Roadmap PoC → MVP

**PoC (foco: UX y adopción) — COMPLETADA junio 2026**
- Postgres + pgvector, búsqueda híbrida vectorial + léxica con RRF (Nivel 0). ✅
- Comprensión de intención + recomendación de candidatos (Nivel 1). ✅
- Captura con metadatos automáticos + detección de duplicados. ✅
- Modelo canónico + variantes, con una sola plataforma real (Cowork). ✅
- Superficie de descubrimiento con ejemplos curados. ✅
- Rellenado guiado de variables. ✅
- Estados del ciclo de vida modelados (sin workflow de aprobación activo). ✅
- Búsqueda agéntica conversacional con bucle ReAct y fallback OR en FTS (Nivel 2 parcial). ✅

**MVP**
- Workflow de aprobación activo (en_uso → propuesta → aprobada).
- Variantes para más plataformas (Claude, Copilot, Delfos).
- Señales de valoración completas + ranking mezclado.
- Capa de evaluación / regresión.
- Servidor MCP para recuperación por agentes/IDEs.
- Recuperación agéntica (Nivel 2) si los datos de uso lo justifican.
