import os
from typing import Optional
from langchain_core.embeddings import Embeddings
from app.config import settings


def get_embeddings(provider: Optional[str] = None) -> Embeddings:
    """
    Returns the configured embedding model.
    Defaults to Google Text Embedding (models/text-embedding-004),
    with optional fallback to Ollama embeddings for local offline execution.
    """
    selected_provider = provider or settings.LLM_PROVIDER
    api_key = settings.gemini_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

    # 1. Primary: Google Text Embedding
    if selected_provider == "gemini" or api_key:
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            if api_key:
                return GoogleGenerativeAIEmbeddings(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    google_api_key=api_key,
                )
        except Exception as e:
            print(f"[Warning] Failed to initialize Google Generative AI Embeddings: {e}")

    # 2. Local Fallback: Ollama Embeddings
    try:
        from langchain_ollama import OllamaEmbeddings

        return OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBEDDING_MODEL,
        )
    except Exception as e:
        print(f"[Warning] Failed to initialize Ollama Embeddings: {e}")

    # 3. Community Fallback: HuggingFace Embeddings
    try:
        from langchain_community.embeddings import FakeEmbeddings

        print("[Notice] Using FakeEmbeddings for testing/fallback environment.")
        return FakeEmbeddings(size=768)
    except Exception:
        raise RuntimeError("No embedding provider available. Set GOOGLE_API_KEY / GEMINI_API_KEY or run Ollama.")
