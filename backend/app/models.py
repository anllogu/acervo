import uuid
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, SmallInteger,
    Text, UniqueConstraint, func,
    Enum as PGEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector
from .config import settings

Base = declarative_base()


class PromptCanonico(Base):
    __tablename__ = "prompt_canonico"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(Text, unique=True, nullable=False)
    titulo = Column(Text, nullable=False)
    proposito = Column(Text, nullable=False)
    cuerpo_canonico = Column(Text, nullable=False)
    tipo = Column(
        PGEnum("system", "user", "few_shot", "cadena", "plantilla_agente",
               name="tipo_prompt", create_type=False),
        nullable=False,
    )
    idioma = Column(Text, nullable=False, default="es")
    variables = Column(JSONB, nullable=False, default=list)
    formato_salida = Column(Text)
    ejemplos = Column(JSONB, nullable=False, default=list)
    dominio_negocio = Column(ARRAY(Text), nullable=False, default=list)
    tipo_tarea = Column(ARRAY(Text), nullable=False, default=list)
    tags = Column(ARRAY(Text), nullable=False, default=list)
    criticidad = Column(
        PGEnum("baja", "media", "alta", name="criticidad_tipo", create_type=False),
        nullable=False,
        default="baja",
    )
    datos_sensibles = Column(Boolean, nullable=False, default=False)
    estado = Column(
        PGEnum("generada", "en_uso", "propuesta", "aprobada", "deprecada",
               name="estado_ciclo", create_type=False),
        nullable=False,
        default="generada",
    )
    version = Column(Text, nullable=False, default="0.1.0")
    owner = Column(Text, nullable=False)
    equipo = Column(Text)
    visibilidad = Column(
        PGEnum("personal", "equipo", "compartido", name="visibilidad_tipo", create_type=False),
        nullable=False,
        default="personal",
    )
    destacado = Column(Boolean, nullable=False, default=False)
    embedding = Column(Vector(settings.embedding_dim))
    # fts is trigger-managed; queried via raw SQL in hybrid search
    creado_en = Column(DateTime(timezone=True), nullable=False, default=func.now())
    actualizado_en = Column(DateTime(timezone=True), nullable=False, default=func.now())


class VariantePlataforma(Base):
    __tablename__ = "variante_plataforma"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonico_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_canonico.id", ondelete="CASCADE"),
        nullable=False,
    )
    plataforma = Column(Text, nullable=False)
    cuerpo_adaptado = Column(Text, nullable=False)
    tipo_adaptacion = Column(
        PGEnum("formato", "semantica", name="tipo_adaptacion", create_type=False),
        nullable=False,
        default="formato",
    )
    version = Column(Text, nullable=False, default="0.1.0")
    estado = Column(
        PGEnum("generada", "en_uso", "propuesta", "aprobada", "deprecada",
               name="estado_ciclo", create_type=False),
        nullable=False,
        default="en_uso",
    )
    creado_por = Column(Text, nullable=False)
    creado_en = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (UniqueConstraint("canonico_id", "plataforma"),)


class RegistroUso(Base):
    __tablename__ = "registro_uso"

    id = Column(Text, primary_key=True)  # BIGSERIAL mapped as Text for simplicity
    variante_id = Column(
        UUID(as_uuid=True),
        ForeignKey("variante_plataforma.id", ondelete="CASCADE"),
        nullable=False,
    )
    canonico_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_canonico.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario = Column(Text, nullable=False)
    ts = Column(DateTime(timezone=True), nullable=False, default=func.now())


class Valoracion(Base):
    __tablename__ = "valoracion"

    id = Column(Text, primary_key=True)  # BIGSERIAL mapped as Text for simplicity
    canonico_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_canonico.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario = Column(Text, nullable=False)
    senal = Column(SmallInteger, nullable=False)
    ts = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (UniqueConstraint("canonico_id", "usuario"),)
