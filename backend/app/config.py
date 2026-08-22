import os
from functools import lru_cache
from typing import Literal, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application-wide configuration loaded from environment variables and .env file.
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

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:Rohit18@localhost:5432/invoices",
        alias="POSTGRES_URL",
    )

    # Authentication & JWT
    SECRET_KEY: str = "super-secret-key-change-in-production-1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM Settings (Google Gemini & Ollama)
    LLM_PROVIDER: Literal["gemini", "ollama"] = "gemini"

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_VISION_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"

    # Ollama (Local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_VISION_MODEL: str = "llama3.2-vision"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"

    # Vector Stores
    VECTOR_STORE_PROVIDER: Literal["auto", "faiss", "pinecone"] = "auto"
    FAISS_INDEX_DIR: str = "./data/faiss_index"

    # Pinecone (Production)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX_NAME: str = "invoice-validation"
    PINECONE_ENVIRONMENT: Optional[str] = "us-east-1"

    # OCR Settings
    OCR_ENGINE: Literal["gemini_vision", "ollama_vision", "text_extractor"] = "gemini_vision"
    MAX_DOCUMENT_PAGES: int = 10

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def active_vector_store(self) -> Literal["faiss", "pinecone"]:
        if self.VECTOR_STORE_PROVIDER == "auto":
            return "pinecone" if self.is_production else "faiss"
        return self.VECTOR_STORE_PROVIDER


@lru_cache()
def get_settings() -> Settings:
    """Returns cached application settings singleton instance."""
    return Settings()


settings = get_settings()
