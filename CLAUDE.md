# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- After any change that affects architecture, APIs, data model, or implementation status: update the relevant file in `docs/` and `README.md`.

## Project memory

Persistent context lives in `.claude/memory/` — read `MEMORY.md` there for the index. Check it at the start of any session.

## Running the stack

Everything runs in Docker. The override file mounts source for hot-reload.

```bash
cp .env.example .env          # first time only
docker compose up             # starts db + api (hot-reload) + frontend (hot-reload)
```

Services:
- API: http://localhost:8000 — FastAPI, auto-reload via uvicorn
- Frontend: http://localhost:3000 — Next.js dev server
- Docs: http://localhost:8000/docs — OpenAPI (Swagger)

Restart a single service after adding a new router or dependency:

```bash
docker compose restart api
docker compose restart frontend
```

## Database migrations and seed

```bash
# Run migrations (runs inside the container)
docker compose exec api alembic upgrade head

# Load seed prompts (idempotent)
docker compose exec api python -m app.seed.seed

# Open a psql shell
docker compose exec db psql -U acervo acervo
```

## Useful one-liners

```bash
# Tail API logs
docker compose logs -f api

# TypeScript type-check (no emit)
docker compose exec frontend npx tsc --noEmit

# Lint frontend
docker compose exec frontend npm run lint

# Hit the API directly
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/facets | jq
curl -s -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "acta reunion"}' | jq
```

## Architecture

### Overview

Acervo is a **prompt recommender** (not an executor). It surfaces the right stored prompt ready to copy into Cowork, Copilot, or Claude. The PoC has one platform: Cowork.

```
frontend (Next.js 14 App Router)
    └── src/lib/api.ts          ← all fetch calls, typed interfaces
    └── src/app/<route>/        ← one directory per page
    └── src/components/         ← Sidebar, TopBar, PageHeader

backend (FastAPI)
    └── app/routers/            ← thin HTTP layer, delegates to services
    └── app/services/           ← business logic (capture, search)
    └── app/clients/            ← LLM + embedding providers (stub → real)
    └── app/schemas.py          ← all Pydantic models (request + response)
    └── app/db_asyncpg.py       ← asyncpg pool (used for all DB ops)
    └── app/db.py               ← SQLAlchemy engine (health check only)

postgres (pgvector/pgvector:pg16)
    └── prompt_canonico         ← canonical prompts; embedding + fts columns
    └── variante_plataforma     ← platform renders (PoC: cowork only)
    └── registro_uso            ← implicit usage signal
    └── valoracion              ← explicit +1/-1 rating
```

### Key architectural choices

**Single DB for everything.** PostgreSQL + pgvector handles relational data, HNSW vector index, and Spanish-config tsvector FTS — no separate vector store.

**asyncpg for all DB writes and vector ops.** SQLAlchemy struggles with `::cast` syntax and named params in raw vector SQL. `db_asyncpg.py` holds the pool; `db.py` (SQLAlchemy) is only used by the health check. Do not introduce SQLAlchemy ORM queries for new features.

**Stub clients.** `clients/embeddings.py` and `clients/llm.py` both have `Stub*` implementations that return zeros / hardcoded JSON. The real provider is blocked on `⚠ CONFIRMAR con Ángel` (LLM + embedding model, on-prem constraints). All code paths must work with `EMBEDDING_PROVIDER=stub` and `LLM_PROVIDER=stub`.

**Two-step capture flow.** `POST /prompts/capture` embeds + deduplicates + generates metadata (LLM), returns a proposal. The author confirms in the UI, then `POST /prompts` persists. Never persist without the author confirmation step.

**Hybrid search (Phase 2).** `services/search.py` runs vector cosine and tsvector lexical queries independently, fuses results with RRF (k=60) in Python, then fetches full rows for the top candidates. When `EMBEDDING_PROVIDER=stub`, vector search is skipped and the system falls back to lexical-only.

**FTS is trigger-maintained.** The `fts` tsvector column on `prompt_canonico` is populated by `trg_prompt_fts` (defined in migration `0001`). It weights titulo=A, proposito+tags=B, cuerpo_canonico=C with Spanish stemming. Queries use `plainto_tsquery('spanish', ...)`.

### Adding a new phase

1. Add Pydantic models to `schemas.py`
2. Create `services/<phase>.py` for business logic using the asyncpg pool
3. Create `routers/<phase>.py` with thin FastAPI endpoints
4. Register the router in `main.py`
5. Add fetch functions and TypeScript interfaces to `frontend/src/lib/api.ts`
6. Build the page under `frontend/src/app/<route>/page.tsx`

### Design system

Frontend uses the AI Manager design system as reference:
- Sidebar: `bg-gray-900`, active nav: `bg-indigo-950 border-l-2 border-indigo-500`
- Content area: `bg-gray-50`, cards: `bg-white rounded-xl shadow-sm border border-gray-100`
- Primary accent: `indigo-600` / `indigo-500`, font: Inter

### Implementation status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Infrastructure (FastAPI, Postgres+pgvector, migrations, seed, stub clients) | Done |
| 1 | Capture with auto-metadata + deduplication | Done |
| 2 | Hybrid search — vector + lexical, RRF k=60, facet filters | Done |
| 3 | Intent-based recommendation (LLM intent → hybrid search → explained candidates) | Pending |
| 4 | Guided variable fill + delivery (LLM questions per variable → filled Cowork variant) | Pending |
| 5 | Discovery surface + multi-signal ranking | Pending |
| 6 | UX polish + adoption validation | Pending |

### What is NOT in the PoC

No prompt execution, no agentic loop, no MCP server, no active approval workflow, no platform variants other than Cowork, no reranker. These are MVP scope.
