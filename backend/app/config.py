import os
from functools import lru_cache
from typing import Literal, Optional, Any
from pydantic import Field, AliasChoices, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application-wide configuration loaded from environment variables and .env file.
    Automatically toggles Database URLs and Vector Stores based on the active ENVIRONMENT.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Environment
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    APP_NAME: str = "Invoice Validate AI"
    DEBUG: bool = False

    @field_validator("ENVIRONMENT", "LLM_PROVIDER", "VECTOR_STORE_PROVIDER", "OCR_ENGINE", mode="before", check_fields=False)
    @classmethod
    def normalize_literals(cls, v: Any) -> Any:
        if isinstance(v, str):
            clean = v.strip().lower()
            if clean in ["dev", "local"]:
                return "development"
            if clean in ["prod"]:
                return "production"
            if clean in ["stage"]:
                return "staging"
            return clean
        return v

    # Database URLs
    # Development uses local DATABASE_URL, Production uses DEVELOPMENT_DATABASE_URL / PRODUCTION_DATABASE_URL
    DATABASE_URL: Optional[str] = Field(
        default="postgresql://postgres:Rohit18@localhost:5432/invoices",
        validation_alias=AliasChoices("DATABASE_URL", "LOCAL_DATABASE_URL"),
    )
    DEVELOPMENT_DATABASE_URL: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("DEVELOPMENT_DATABASE_URL", "PRODUCTION_DATABASE_URL", "POSTGRES_URL"),
    )
    PRODUCTION_DATABASE_URL: Optional[str] = None

    # Authentication & JWT
    SECRET_KEY: str = "super-secret-key-change-in-production-1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM Settings (Google Gemini & Ollama)
    LLM_PROVIDER: Literal["gemini", "ollama"] = "gemini"

    # Google Gemini Keys (accepts either GOOGLE_API_KEY or GEMINI_API_KEY)
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    )
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_VISION_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"

    # Ollama (Local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_VISION_MODEL: str = "llama3.2-vision"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"

    # Vector Stores (FAISS for local development, Pinecone for production)
    VECTOR_STORE_PROVIDER: Literal["auto", "faiss", "pinecone"] = "auto"
    FAISS_INDEX_DIR: str = "./data/faiss_index"

    # Pinecone (Production)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX_NAME: str = "invoice-validation"
    PINECONE_ENVIRONMENT: Optional[str] = "us-east-1"

    # OCR Settings
    OCR_ENGINE: Literal["gemini_vision", "ollama_vision", "text_extractor"] = "gemini_vision"
    MAX_DOCUMENT_PAGES: int = 10

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://[IP_ADDRESS],http://[IP_ADDRESS],https://[IP_ADDRESS]"

    @property
    def gemini_key(self) -> Optional[str]:
        return (
            self.GEMINI_API_KEY
            or self.GOOGLE_API_KEY
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ["production", "prod"]

    @property
    def active_database_url(self) -> str:
        """
        Returns DATABASE_URL for local development, and DEVELOPMENT_DATABASE_URL
        (or PRODUCTION_DATABASE_URL) when ENVIRONMENT is set to production.
        """
        if self.is_production:
            return (
                self.DEVELOPMENT_DATABASE_URL
                or self.PRODUCTION_DATABASE_URL
                or self.DATABASE_URL
                or "postgresql://postgres:postgres@localhost:5432/invoices"
            )
        return (
            self.DATABASE_URL
            or self.DEVELOPMENT_DATABASE_URL
            or "postgresql://postgres:Rohit18@localhost:5432/invoices"
        )

    @property
    def active_vector_store(self) -> Literal["faiss", "pinecone"]:
        """
        Uses FAISS for local development and Pinecone for production.
        """
        if self.VECTOR_STORE_PROVIDER == "auto":
            return "pinecone" if self.is_production else "faiss"
        return self.VECTOR_STORE_PROVIDER


@lru_cache()
def get_settings() -> Settings:
    """Returns cached application settings singleton instance."""
    inst = Settings()
    if inst.gemini_key:
        os.environ["GOOGLE_API_KEY"] = inst.gemini_key
        os.environ["GEMINI_API_KEY"] = inst.gemini_key
    return inst


settings = get_settings()
