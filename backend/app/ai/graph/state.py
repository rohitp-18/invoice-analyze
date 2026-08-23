from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AnomalyItem(BaseModel):
    anomaly_flag: Optional[str] = None  # e.g., "PRICE_MISMATCH", "MATH_CALCULATION_DISCREPANCY"
    anomaly_type: str                  # Backward compatibility alias
    severity: str                      # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    reason: Optional[str] = None       # e.g., "Line items do not sum to total"
    explanation: str                   # Backward compatibility alias
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

    # Stage 2: Database & Vector Store Historical Context (FAISS / Pinecone / PostgreSQL)
    historical_matches: List[Dict[str, Any]]
    applicable_policies: List[Dict[str, Any]]
    db_duplicates: List[Dict[str, Any]]
    vendor_history: Dict[str, Any]
    recent_vendor_invoices: List[Dict[str, Any]]

    # Stage 3: Rule-Based Validation Results
    rule_checks: List[Dict[str, Any]]
    is_math_valid: bool
    is_date_valid: bool

    # Stage 4: AI Anomaly Detection & Fraud Analysis
    anomalies: List[Dict[str, Any]]
    risk_score: float
    risk_level: str
    overall_confidence: float

    # Final Decision & Audit
    status: str  # "APPROVED", "PENDING_REVIEW", "FLAGGED", "REJECTED"
    audit_summary: str
    recommended_action: Optional[str]
    errors: List[str]
