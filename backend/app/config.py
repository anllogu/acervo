from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://acervo:changeme@db:5432/acervo"
    embedding_provider: str = "stub"
    embedding_dim: int = 1536
    llm_provider: str = "stub"
    llm_api_key: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
