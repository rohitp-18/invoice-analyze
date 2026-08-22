from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AnomalyItem(BaseModel):
    anomaly_type: str  # e.g., "PRICE_MISMATCH", "UNRECOGNIZED_VENDOR", "DUPLICATE_INVOICE", "POLICY_VIOLATION"
    severity: str      # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    explanation: str
    evidence: Optional[str] = None


class InvoiceState(TypedDict, total=False):
    """
    LangGraph state schema representing the complete invoice processing lifecycle.
    """
    # Raw input data
    document_bytes: Optional[bytes]
    file_name: str
    mime_type: str
    user_id: Optional[str]

    # Stage 1: Extracted OCR / Multimodal Data
    extracted_data: Optional[Dict[str, Any]]
    raw_text: Optional[str]

    # Stage 2: Vector Store Historical Context (FAISS / Pinecone)
    historical_matches: List[Dict[str, Any]]

    # Stage 3: Rule-Based Validation Results
    rule_checks: List[Dict[str, Any]]
    is_math_valid: bool

    # Stage 4: AI Anomaly Detection & Fraud Analysis
    anomalies: List[Dict[str, Any]]
    risk_score: float

    # Final Decision & Audit
    status: str  # "APPROVED", "PENDING_REVIEW", "FLAGGED"
    audit_summary: str
    errors: List[str]
