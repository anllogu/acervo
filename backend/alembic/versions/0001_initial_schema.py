"""Initial schema: prompt_canonico, variante_plataforma, registro_uso, valoracion

Revision ID: 0001
Revises:
Create Date: 2026-06-28
"""
import os
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1536"))


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("""
        CREATE TYPE estado_ciclo AS ENUM
            ('generada', 'en_uso', 'propuesta', 'aprobada', 'deprecada')
    """)
    op.execute("""
        CREATE TYPE visibilidad_tipo AS ENUM ('personal', 'equipo', 'compartido')
    """)
    op.execute("""
        CREATE TYPE tipo_prompt AS ENUM
            ('system', 'user', 'few_shot', 'cadena', 'plantilla_agente')
    """)
    op.execute("""
        CREATE TYPE criticidad_tipo AS ENUM ('baja', 'media', 'alta')
    """)
    op.execute("""
        CREATE TYPE tipo_adaptacion AS ENUM ('formato', 'semantica')
    """)

    op.execute(f"""
        CREATE TABLE prompt_canonico (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug            TEXT UNIQUE NOT NULL,
            titulo          TEXT NOT NULL,
            proposito       TEXT NOT NULL,
            cuerpo_canonico TEXT NOT NULL,
            tipo            tipo_prompt NOT NULL,
            idioma          TEXT NOT NULL DEFAULT 'es',
            variables       JSONB NOT NULL DEFAULT '[]',
            formato_salida  TEXT,
            ejemplos        JSONB NOT NULL DEFAULT '[]',
            dominio_negocio TEXT[] NOT NULL DEFAULT '{{}}',
            tipo_tarea      TEXT[] NOT NULL DEFAULT '{{}}',
            tags            TEXT[] NOT NULL DEFAULT '{{}}',
            criticidad      criticidad_tipo NOT NULL DEFAULT 'baja',
            datos_sensibles BOOLEAN NOT NULL DEFAULT false,
            estado          estado_ciclo NOT NULL DEFAULT 'generada',
            version         TEXT NOT NULL DEFAULT '0.1.0',
            owner           TEXT NOT NULL,
            equipo          TEXT,
            visibilidad     visibilidad_tipo NOT NULL DEFAULT 'personal',
            destacado       BOOLEAN NOT NULL DEFAULT false,
            embedding       vector({EMBEDDING_DIM}),
            fts             tsvector,
            creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
            actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE variante_plataforma (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            canonico_id     UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
            plataforma      TEXT NOT NULL,
            cuerpo_adaptado TEXT NOT NULL,
            tipo_adaptacion tipo_adaptacion NOT NULL DEFAULT 'formato',
            version         TEXT NOT NULL DEFAULT '0.1.0',
            estado          estado_ciclo NOT NULL DEFAULT 'en_uso',
            creado_por      TEXT NOT NULL,
            creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (canonico_id, plataforma)
        )
    """)

    op.execute("""
        CREATE TABLE registro_uso (
            id          BIGSERIAL PRIMARY KEY,
            variante_id UUID NOT NULL REFERENCES variante_plataforma(id) ON DELETE CASCADE,
            canonico_id UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
            usuario     TEXT NOT NULL,
            ts          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE valoracion (
            id          BIGSERIAL PRIMARY KEY,
            canonico_id UUID NOT NULL REFERENCES prompt_canonico(id) ON DELETE CASCADE,
            usuario     TEXT NOT NULL,
            senal       SMALLINT NOT NULL,
            ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (canonico_id, usuario)
        )
    """)

    op.execute("""
        CREATE INDEX idx_canonico_embedding ON prompt_canonico
            USING hnsw (embedding vector_cosine_ops)
    """)
    op.execute("CREATE INDEX idx_canonico_fts ON prompt_canonico USING gin (fts)")
    op.execute("CREATE INDEX idx_canonico_dominio ON prompt_canonico USING gin (dominio_negocio)")
    op.execute("CREATE INDEX idx_canonico_tarea ON prompt_canonico USING gin (tipo_tarea)")
    op.execute("CREATE INDEX idx_uso_canonico ON registro_uso (canonico_id)")

    op.execute("""
        CREATE OR REPLACE FUNCTION update_prompt_fts()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.fts :=
                setweight(to_tsvector('spanish', coalesce(NEW.titulo, '')), 'A') ||
                setweight(to_tsvector('spanish', coalesce(NEW.proposito, '')), 'B') ||
                setweight(to_tsvector('spanish', coalesce(NEW.cuerpo_canonico, '')), 'C') ||
                setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER trg_prompt_fts
            BEFORE INSERT OR UPDATE ON prompt_canonico
            FOR EACH ROW EXECUTE FUNCTION update_prompt_fts()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_prompt_fts ON prompt_canonico")
    op.execute("DROP FUNCTION IF EXISTS update_prompt_fts")
    op.execute("DROP TABLE IF EXISTS valoracion CASCADE")
    op.execute("DROP TABLE IF EXISTS registro_uso CASCADE")
    op.execute("DROP TABLE IF EXISTS variante_plataforma CASCADE")
    op.execute("DROP TABLE IF EXISTS prompt_canonico CASCADE")
    op.execute("DROP TYPE IF EXISTS tipo_adaptacion")
    op.execute("DROP TYPE IF EXISTS criticidad_tipo")
    op.execute("DROP TYPE IF EXISTS tipo_prompt")
    op.execute("DROP TYPE IF EXISTS visibilidad_tipo")
    op.execute("DROP TYPE IF EXISTS estado_ciclo")
    op.execute("DROP EXTENSION IF EXISTS vector")
