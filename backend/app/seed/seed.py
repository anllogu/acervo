"""
Seed script: inserts featured prompts for cold-start discovery.
Idempotent — skips slugs that already exist.

Uses native asyncpg (bypasses SQLAlchemy text() to avoid ::cast + named-param conflicts).
Run: docker compose exec api python -m app.seed.seed
"""
import asyncio
import json
import os

import asyncpg
from pgvector.asyncpg import register_vector

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://acervo:acervo123@db:5432/acervo"
)
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1536"))

# ⚠ Taxonomy values (dominio_negocio, tipo_tarea) are placeholders.
# Confirm final taxonomy with Ángel before Phase 5.
SEED_PROMPTS = [
    {
        "slug": "resumir-reunion",
        "titulo": "Resumir acta de reunión",
        "proposito": (
            "Genera un resumen estructurado de una reunión a partir del acta, "
            "extrayendo decisiones, acciones y responsables."
        ),
        "cuerpo_canonico": (
            "Eres un asistente experto en síntesis de reuniones. "
            "A partir del siguiente acta, genera un resumen con estas secciones:\n"
            "1. Decisiones tomadas\n"
            "2. Acciones a realizar (responsable y fecha)\n"
            "3. Próximos pasos\n\n"
            "Acta:\n{{acta}}"
        ),
        "tipo": "user",
        "variables": [
            {
                "nombre": "acta",
                "tipo": "text",
                "obligatorio": True,
                "descripcion": "Texto completo del acta de la reunión",
            }
        ],
        "formato_salida": "Texto estructurado con tres secciones numeradas",
        "ejemplos": [],
        "dominio_negocio": ["operaciones", "comunicacion"],
        "tipo_tarea": ["extraccion", "generacion"],
        "tags": ["reunion", "acta", "resumen", "acciones"],
        "criticidad": "baja",
        "datos_sensibles": False,
        "destacado": True,
        "owner": "seed",
        "visibilidad": "compartido",
        "estado": "aprobada",
    },
    {
        "slug": "analizar-contrato",
        "titulo": "Analizar cláusulas de un contrato",
        "proposito": (
            "Identifica y resume las cláusulas más relevantes de un contrato, "
            "destacando riesgos y obligaciones principales."
        ),
        "cuerpo_canonico": (
            "Analiza el siguiente contrato y extrae:\n"
            "1. Partes contratantes\n"
            "2. Objeto del contrato\n"
            "3. Obligaciones principales de cada parte\n"
            "4. Cláusulas de riesgo o penalización\n"
            "5. Fechas clave\n\n"
            "Contrato:\n{{contrato}}"
        ),
        "tipo": "user",
        "variables": [
            {
                "nombre": "contrato",
                "tipo": "text",
                "obligatorio": True,
                "descripcion": "Texto completo o fragmento del contrato a analizar",
            }
        ],
        "formato_salida": "Lista estructurada con cinco secciones",
        "ejemplos": [],
        "dominio_negocio": ["legal"],
        "tipo_tarea": ["extraccion", "clasificacion"],
        "tags": ["contrato", "legal", "clausulas", "riesgo"],
        "criticidad": "alta",
        "datos_sensibles": True,
        "destacado": True,
        "owner": "seed",
        "visibilidad": "compartido",
        "estado": "aprobada",
    },
    {
        "slug": "redactar-email-profesional",
        "titulo": "Redactar email profesional",
        "proposito": (
            "Redacta un correo electrónico profesional a partir de puntos clave, "
            "adaptando el tono al contexto y al destinatario."
        ),
        "cuerpo_canonico": (
            "Redacta un email profesional en español con el siguiente propósito: "
            "{{proposito_email}}.\n\n"
            "Destinatario: {{destinatario}}\n"
            "Tono: {{tono}}\n\n"
            "El email debe ser conciso y terminar con una llamada a la acción si aplica."
        ),
        "tipo": "user",
        "variables": [
            {
                "nombre": "proposito_email",
                "tipo": "text",
                "obligatorio": True,
                "descripcion": "Qué se quiere comunicar o conseguir con el email",
            },
            {
                "nombre": "destinatario",
                "tipo": "text",
                "obligatorio": True,
                "descripcion": "A quién va dirigido (cargo o contexto)",
            },
            {
                "nombre": "tono",
                "tipo": "text",
                "obligatorio": False,
                "descripcion": "Formal, cercano, urgente, etc. Por defecto: formal",
            },
        ],
        "formato_salida": "Email con asunto, cuerpo y cierre",
        "ejemplos": [],
        "dominio_negocio": ["comunicacion", "rrhh"],
        "tipo_tarea": ["generacion"],
        "tags": ["email", "comunicacion", "redaccion", "profesional"],
        "criticidad": "baja",
        "datos_sensibles": False,
        "destacado": True,
        "owner": "seed",
        "visibilidad": "compartido",
        "estado": "aprobada",
    },
]

INSERT_SQL = """
    INSERT INTO prompt_canonico (
        slug, titulo, proposito, cuerpo_canonico, tipo,
        variables, formato_salida, ejemplos,
        dominio_negocio, tipo_tarea, tags,
        criticidad, datos_sensibles, destacado,
        owner, visibilidad, estado, embedding
    ) VALUES (
        $1, $2, $3, $4, $5::tipo_prompt,
        $6::jsonb, $7, $8::jsonb,
        $9::text[], $10::text[], $11::text[],
        $12::criticidad_tipo, $13, $14,
        $15, $16::visibilidad_tipo, $17::estado_ciclo, $18::vector
    )
"""


async def run_seed() -> None:
    # asyncpg uses postgresql:// not postgresql+asyncpg://
    url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    await register_vector(conn)

    zero_vector = [0.0] * EMBEDDING_DIM

    for prompt in SEED_PROMPTS:
        existing = await conn.fetchval(
            "SELECT id FROM prompt_canonico WHERE slug = $1",
            prompt["slug"],
        )
        if existing is not None:
            print(f"  skip (already exists): {prompt['slug']}")
            continue

        await conn.execute(
            INSERT_SQL,
            prompt["slug"],
            prompt["titulo"],
            prompt["proposito"],
            prompt["cuerpo_canonico"],
            prompt["tipo"],
            json.dumps(prompt["variables"]),
            prompt.get("formato_salida"),
            json.dumps(prompt.get("ejemplos", [])),
            prompt["dominio_negocio"],
            prompt["tipo_tarea"],
            prompt["tags"],
            prompt["criticidad"],
            prompt["datos_sensibles"],
            prompt["destacado"],
            prompt["owner"],
            prompt["visibilidad"],
            prompt["estado"],
            zero_vector,
        )
        print(f"  inserted: {prompt['slug']}")

    await conn.close()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(run_seed())
