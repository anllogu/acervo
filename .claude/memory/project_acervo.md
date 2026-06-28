---
name: project-acervo
description: Core context for the Acervo project — a prompt catalog PoC for non-technical business users at a Spanish organization
metadata: 
  node_type: memory
  type: project
  originSessionId: dbca48fa-a3c5-4be6-a625-de96cec5c83a
---

# Acervo — Prompt Catalog PoC

Acervo is an organizational prompt catalog (catálogo de prompts). It is a **recommender**, not an executor — it delivers the right prompt ready to use; execution lives in target platforms (Cowork, Copilot, Claude, Delfos).

**Why:** The risk is adoption, not technical. Business users (non-technical) already use Cowork to ask directly in natural language. Acervo wins only if it demonstrably beats improvising — via superior results, policy compliance, or discovery of unknown possibilities.

**How to apply:** Frame suggestions around UX and adoption risk, not technical complexity. Scope decisions must stay inside PoC scope.

## Status (as of 2026-06-28)
Only docs exist; no code has been written yet. Three documents in `/docs/`:
- `acervo-00-diseno-poc.md` — product design, decisions, data model, principles
- `acervo-01-especificacion-tecnica-poc.md` — technical spec (DDL, API, LLM contracts)
- `acervo-02-plan-implementacion-fases-poc.md` — phased implementation plan (Phases 0–6)

## Architecture
- **DB:** PostgreSQL + pgvector (HNSW index). Single store: relational + vector + full-text (tsvector). No separate vector DB.
- **Backend:** FastAPI + Pydantic + SQLAlchemy (or psycopg direct)
- **Frontend PoC:** Streamlit (fast UX validation, not production)
- **LLM/Embeddings:** provider `⚠ CONFIRMAR` with Ángel — may require on-prem (ISO 42001 / EU AI Act)
- **Embedding dimension:** `<DIM>` — depends on chosen model, must be confirmed before schema

## Data model (key tables)
- `prompt_canonico` — canonical prompt (intention + logic, with `{{variable}}` placeholders, embedding, fts, lifecycle state)
- `variante_plataforma` — platform render (PoC: only `cowork`), linked by `canonico_id`
- `registro_uso` — implicit signal (retrieved/copied from catalog)
- `valoracion` — explicit signal (+1/-1)

## Lifecycle states
`generada → en_uso → propuesta → aprobada → deprecada`
- `generada→en_uso`: low friction (one click), personal only
- `en_uso→propuesta→aprobada`: governance workflow — **modeled but NOT active in PoC**

## Implementation phases
- **Phase 0:** Infrastructure (FastAPI, Postgres+pgvector, migrations, seed data, embedding/LLM clients)
- **Phase 1:** Capture with auto-metadata + deduplication (embedding similarity threshold)
- **Phase 2:** Hybrid search Level 0 (vector cosine + tsvector, fused by RRF k=60)
- **Phase 3:** Intent-based recommendation Level 1 (LLM intent→structured query→hybrid search→candidate explanation)
- **Phase 4:** Guided variable fill + delivery (LLM generates questions per variable, fills placeholders in platform variant)
- **Phase 5:** Discovery surface + multi-signal ranking (no popularity loop; combine relevance+usage+rating+recency+curated)
- **Phase 6:** UX polish + adoption validation (the actual PoC success criterion)

## Items requiring confirmation with Ángel (⚠ CONFIRMAR)
1. LLM provider + embedding model (on-prem constraint?)
2. Embedding vector dimension `<DIM>`
3. Initial taxonomy values: `dominio_negocio` and `tipo_tarea` lists
4. Seed curated prompts (`destacado=true`) for cold start
5. User identity model in PoC (real login or simple `owner` string?)

## Key design decisions
- Hybrid search: vector (cosine) + lexical (tsvector spanish) fused by RRF, NOT pure vector
- No agentic retrieval loop in PoC (Level 2 deferred to MVP)
- No MCP server in PoC (deferred to MVP)
- No approval workflow active in PoC (states modeled but no governed transitions)
- Only platform in PoC: **Cowork**
- Deduplication on capture via embedding similarity — mandatory, not optional
- LLM used for authoring (metadata gen, intent understanding, fill questions, candidate explanation) — NOT for serving (what's served is always a stored, validated variant)
- Featured/curated prompts (`destacado=true`) solve cold start — NOT usage history

## API endpoints (orientative)
- `POST /prompts/capture` — analyze raw text, return proposed metadata + duplicate candidates
- `POST /prompts` — create canonical + variant after author confirmation
- `GET /prompts/{id}` — detail
- `POST /search` — intent description → ranked + explained candidates
- `GET /discover` — browse by facet + featured
- `POST /prompts/{id}/fill` — guided variable fill → final prompt
- `POST /prompts/{id}/use` — log usage
- `POST /prompts/{id}/rate` — log rating (+1/-1)
- `GET /facets` — available taxonomy values
