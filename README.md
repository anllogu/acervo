# Acervo

Catálogo de prompts de la organización. Acervo es un **recomendador**, no un ejecutor: entrega el prompt correcto listo para usar en Cowork, Copilot o Claude. La ejecución vive en las plataformas destino.

## Requisitos

- Docker + Docker Compose
- (Opcional) Node.js 20+ y Python 3.12+ para desarrollo local fuera de contenedores

## Puesta en marcha

```bash
cp .env.example .env
docker compose up
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |

Primera vez — migraciones y datos semilla:

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed.seed
```

## Estructura

```
backend/        FastAPI + asyncpg + pgvector
frontend/       Next.js 14 (App Router) + Tailwind CSS
docs/           Diseño de producto, especificación técnica y plan de fases
.claude/        Memoria de proyecto para Claude Code
```

## Estado de implementación

| Fase | Alcance | Estado |
|------|---------|--------|
| 0 | Infraestructura — FastAPI, Postgres+pgvector, migraciones, semilla, clientes stub | ✅ |
| 1 | Captura con metadatos automáticos y deduplicación | ✅ |
| 2 | Búsqueda híbrida — vectorial + léxica, fusión RRF k=60, filtros por faceta | ✅ |
| 3 | Recomendación por intención (LLM → búsqueda híbrida → candidatos explicados) | ✅ |
| 4 | Rellenado guiado de variables + entrega del prompt listo para Cowork | ✅ |
| 5 | Descubrimiento y ranking multi-señal | ✅ |
| 6 | Pulido UX + validación de adopción | ✅ |

## Decisiones pendientes (⚠ CONFIRMAR con Ángel)

1. Proveedor LLM y modelo de embeddings (¿restricción on-prem por ISO 42001 / EU AI Act?)
2. Dimensión del vector de embedding `EMBEDDING_DIM`
3. Valores de taxonomía definitivos (`dominio_negocio`, `tipo_tarea`)
4. Prompts destacados iniciales para cold start
5. Modelo de identidad en el PoC (login real vs. campo `owner` libre)

Hasta que se confirmen, el sistema funciona con `EMBEDDING_PROVIDER=stub` y `LLM_PROVIDER=stub`.

## Documentación

- [`docs/acervo-00-diseno-poc.md`](docs/acervo-00-diseno-poc.md) — diseño de producto y principios
- [`docs/acervo-01-especificacion-tecnica-poc.md`](docs/acervo-01-especificacion-tecnica-poc.md) — DDL, contratos de API y LLM
- [`docs/acervo-02-plan-implementacion-fases-poc.md`](docs/acervo-02-plan-implementacion-fases-poc.md) — plan por fases y criterios de aceptación
