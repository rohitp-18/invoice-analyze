import os
from typing import List, Optional, Any, Dict
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from app.config import settings
from app.ai.embeddings import get_embeddings


class VectorStoreManager:
    """
    Unified Vector Store Manager.
    Automatically routes to FAISS for local development and Pinecone for production.
    """

    def __init__(self, provider: Optional[str] = None):
        self._explicit_provider = provider
        self._embeddings = None
        self._vector_store: Optional[VectorStore] = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            self._embeddings = get_embeddings()
        return self._embeddings

    @property
    def provider(self) -> str:
        if self._explicit_provider:
            return self._explicit_provider
        return settings.active_vector_store

    def get_vector_store(self) -> VectorStore:
        if self._vector_store is not None:
            return self._vector_store

        active = self.provider
        print(f"[VectorStore] Active Environment: '{settings.ENVIRONMENT.upper()}' | Using Provider: '{active.upper()}'")

        if active == "faiss":
            self._vector_store = self._init_faiss()
        elif active == "pinecone":
            self._vector_store = self._init_pinecone()
        else:
            raise ValueError(f"Unknown vector store provider: {active}")

        return self._vector_store

    def _init_faiss(self) -> VectorStore:
        """Initializes or loads local FAISS vector store."""
        from langchain_community.vectorstores import FAISS

        index_dir = settings.FAISS_INDEX_DIR
        index_file = os.path.join(index_dir, "index.faiss")

        if os.path.exists(index_file):
            try:
                print(f"[FAISS] Loading local index from: {index_dir}")
                return FAISS.load_local(
                    folder_path=index_dir,
                    embeddings=self.embeddings,
                    allow_dangerous_deserialization=True,
                )
            except Exception as e:
                print(f"[FAISS] Error loading local index: {e}. Reinitializing fresh index.")

        # Create a fresh empty FAISS store with an initial baseline document
        os.makedirs(index_dir, exist_ok=True)
        placeholder_doc = Document(
            page_content="Invoice validation initial index baseline",
            metadata={"source": "system_init", "type": "baseline"},
        )
        vector_store = FAISS.from_documents([placeholder_doc], self.embeddings)
        vector_store.save_local(index_dir)
        print(f"[FAISS] Initialized fresh local FAISS index at {index_dir}")
        return vector_store

    def _init_pinecone(self) -> VectorStore:
        """Initializes production Pinecone vector store."""
        try:
            from pinecone import Pinecone
            from langchain_pinecone import PineconeVectorStore

            api_key = settings.PINECONE_API_KEY or os.getenv("PINECONE_API_KEY")
            if not api_key:
                raise ValueError("PINECONE_API_KEY is required for production Pinecone vector store.")

            pc = Pinecone(api_key=api_key)
            index_name = settings.PINECONE_INDEX_NAME

            # Verify index availability
            existing_indexes = [idx.name for idx in pc.list_indexes()]
            print(f"[Pinecone] Connecting to cloud index '{index_name}' (Available: {existing_indexes})")

            return PineconeVectorStore(
                index_name=index_name,
                embedding=self.embeddings,
                pinecone_api_key=api_key,
            )
        except ImportError:
            raise ImportError(
                "langchain-pinecone and pinecone-client are required for Pinecone. Run: pip install langchain-pinecone pinecone-client"
            )

    def add_documents(self, documents: List[Document], **kwargs) -> List[str]:
        """Add documents to the vector store and persist if using FAISS."""
        store = self.get_vector_store()
        ids = store.add_documents(documents, **kwargs)

        if self.provider == "faiss":
            self.save_local()

        return ids

    def similarity_search(
        self,
        query: str,
        k: int = 4,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """Search for similar invoice documents or historical records."""
        store = self.get_vector_store()
        if filter:
            return store.similarity_search(query, k=k, filter=filter)
        return store.similarity_search(query, k=k)

    def save_local(self) -> None:
        """Saves FAISS index to disk."""
        if self.provider == "faiss" and self._vector_store is not None:
            os.makedirs(settings.FAISS_INDEX_DIR, exist_ok=True)
            self._vector_store.save_local(settings.FAISS_INDEX_DIR)
            print(f"[FAISS] Saved index snapshot to {settings.FAISS_INDEX_DIR}")


# Default singleton instance
vector_store_manager = VectorStoreManager()
