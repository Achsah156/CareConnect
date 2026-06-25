"""
Central app configuration. All env-dependent values live here so nothing
is hardcoded deeper in the app. Copy .env.example to .env and fill in values.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/pathparallel"

    # Auth
    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    google_client_id: str = ""
    google_client_secret: str = ""

    # AI
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_provider: str = "openai"  # "openai" or "local" (for offline dev/testing)

    # Vector DB (Chroma, embedded/local mode for MVP)
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "situations"

    # App
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
