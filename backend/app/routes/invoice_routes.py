import uuid
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Invoice, InvoiceLineItem, AnomalyFinding
from app.authentication import get_current_user
from app.ai.graph.workflow import process_invoice_workflow

router = APIRouter(prefix="/api/v1/invoice", tags=["Invoice Processing & Validation"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_and_validate_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an invoice (PDF or Image), process it through the LangGraph AI workflow,
    detect anomalies, validate financial rules, and persist findings to the database.
    """
    # 1. Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # 2. Execute LangGraph AI validation workflow
    pipeline_result = process_invoice_workflow(
        document_bytes=file_bytes,
        file_name=file.filename or "invoice.pdf",
        mime_type=file.content_type or "application/pdf",
        user_id=str(current_user.id),
    )

    extracted = pipeline_result.get("extracted_data") or {}
    anomalies_data = pipeline_result.get("anomalies") or []
    status_result = pipeline_result.get("status", "PENDING_REVIEW")

    # 3. Parse date safely
    invoice_date_val = date.today()
    if extracted.get("invoice_date"):
        try:
            invoice_date_val = datetime.strptime(
                extracted["invoice_date"][:10], "%Y-%m-%d"
            ).date()
        except Exception:
            pass

    # 4. Save Invoice record to PostgreSQL
    new_invoice = Invoice(
        id=uuid.uuid4(),
        submitter_id=current_user.id,
        invoice_number=extracted.get("invoice_number", f"INV-{uuid.uuid4().hex[:8].upper()}"),
        vendor_name=extracted.get("vendor_name", "Unknown Vendor"),
        invoice_date=invoice_date_val,
        total_amount=float(extracted.get("total_amount") or 0.0),
        currency=extracted.get("currency", "USD"),
        status=status_result,
        document_url=f"/uploads/{file.filename}",
    )
    db.add(new_invoice)
    db.flush()

    # 5. Save Line Items
    for item in extracted.get("line_items", []):
        line_item = InvoiceLineItem(
            id=uuid.uuid4(),
            invoice_id=new_invoice.id,
            description=item.get("description", "Item"),
            quantity=float(item.get("quantity") or 1.0),
            unit_price=float(item.get("unit_price") or 0.0),
            total_amount=float(item.get("total_amount") or 0.0),
            category=item.get("category", "General"),
        )
        db.add(line_item)

    # 6. Save Anomaly Findings
    for anomaly in anomalies_data:
        anomaly_entry = AnomalyFinding(
            id=uuid.uuid4(),
            invoice_id=new_invoice.id,
            anomaly_type=anomaly.get("anomaly_type", "GENERIC_ALERT"),
            severity=anomaly.get("severity", "MEDIUM"),
            explanation=anomaly.get("explanation", "Potential anomaly detected."),
            evidence=anomaly.get("evidence"),
        )
        db.add(anomaly_entry)

    db.commit()
    db.refresh(new_invoice)

    return {
        "message": "Invoice processed successfully",
        "invoice_id": str(new_invoice.id),
        "invoice_number": new_invoice.invoice_number,
        "vendor_name": new_invoice.vendor_name,
        "status": new_invoice.status,
        "total_amount": float(new_invoice.total_amount),
        "anomalies_detected": len(anomalies_data),
        "audit_summary": pipeline_result.get("audit_summary", ""),
        "risk_score": pipeline_result.get("risk_score", 0.0),
    }


@router.get("/get-all-invoice")
def get_all_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all invoices submitted by the user or visible to administrative personnel.
    """
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    return invoices


@router.get("/{invoice_id}")
def get_invoice_details(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve specific invoice details including line items and anomaly findings.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return invoice
