import os
from typing import Optional, Literal
from langchain_core.language_models.chat_models import BaseChatModel
from app.config import settings


def get_llm(
    model: Optional[str] = None,
    temperature: float = 0.0,
    provider: Optional[Literal["gemini", "ollama"]] = None,
) -> BaseChatModel:
    """
    Factory function returning the configured LLM (Google Gemini or Ollama).
    Defaults to temperature=0.0 for deterministic, repeatable audit results.
    """
    selected_provider = provider or settings.LLM_PROVIDER

    if selected_provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            api_key = settings.gemini_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY / GOOGLE_API_KEY is not set in environment or .env file.")

            return ChatGoogleGenerativeAI(
                model=model or settings.GEMINI_MODEL,
                google_api_key=api_key,
                temperature=temperature,
            )
        except ImportError:
            raise ImportError(
                "langchain-google-genai is required for Gemini models. Run: pip install langchain-google-genai"
            )

    elif selected_provider == "ollama":
        try:
            from langchain_ollama import ChatOllama

            return ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=model or settings.OLLAMA_MODEL,
                temperature=temperature,
            )
        except ImportError:
            raise ImportError(
                "langchain-ollama is required for Ollama models. Run: pip install langchain-ollama"
            )

    else:
        raise ValueError(f"Unsupported LLM provider: {selected_provider}. Choose 'gemini' or 'ollama'.")


def get_vision_llm(
    model: Optional[str] = None,
    temperature: float = 0.0,
    provider: Optional[Literal["gemini", "ollama"]] = None,
) -> BaseChatModel:
    """
    Factory function returning a vision-capable LLM for OCR, receipt parsing, and visual document reasoning.
    Defaults to temperature=0.0 for exact visual feature extraction.
    """
    selected_provider = provider or settings.LLM_PROVIDER

    if selected_provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = settings.gemini_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY / GOOGLE_API_KEY is not set in environment or .env file.")

        return ChatGoogleGenerativeAI(
            model=model or settings.GEMINI_VISION_MODEL,
            google_api_key=api_key,
            temperature=temperature,
        )

    elif selected_provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=model or settings.OLLAMA_VISION_MODEL,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported vision LLM provider: {selected_provider}")
