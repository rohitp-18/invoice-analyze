import uuid
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LineItemResponse(BaseModel):
    id: uuid.UUID
    description: str
    quantity: float
    unit_price: float
    total_amount: float
    category: Optional[str] = None

    class Config:
        from_attributes = True


class AnomalyResponse(BaseModel):
    id: uuid.UUID
    anomaly_flag: Optional[str] = None
    anomaly_type: str
    severity: str
    reason: Optional[str] = None
    explanation: str
    evidence: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    vendor_name: str
    invoice_date: Optional[date] = None
    subtotal: Optional[float] = 0.0
    tax_amount: Optional[float] = 0.0
    total_amount: float
    currency: str = "INR"
    status: str
    ai_status: Optional[str] = "PENDING_REVIEW"
    human_status: Optional[str] = "PENDING"
    decision_notes: Optional[str] = None
    decision_by_name: Optional[str] = None
    decision_by_role: Optional[str] = None
    decision_at: Optional[datetime] = None
    document_url: str
    overall_confidence: Optional[float] = 0.95
    overall_confidance: Optional[float] = 0.95
    risk_level: Optional[str] = "LOW"
    risk_score: Optional[float] = 0.05
    recommended_action: Optional[str] = None
    submitter_id: Optional[uuid.UUID] = None
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    submitter_department: Optional[str] = None
    approver_id: Optional[uuid.UUID] = None
    approver_name: Optional[str] = None
    created_at: Optional[datetime] = None
    line_items: List[LineItemResponse] = []
    anomalies: List[AnomalyResponse] = []

    class Config:
        from_attributes = True


class UserInvoicesSummaryResponse(BaseModel):
    total_invoices: int
    total_spend: float
    currency: str = "INR"
    status_counts: Dict[str, int]
    total_anomalies: int
    latest_submission: Optional[datetime] = None


class UserInvoicesListResponse(BaseModel):
    summary: UserInvoicesSummaryResponse
    invoices: List[InvoiceResponse]
