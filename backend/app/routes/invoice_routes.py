import os
import uuid
import traceback
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import User, Invoice, InvoiceLineItem, AnomalyFinding
from app.authentication import get_current_user
from app.ai.graph.workflow import process_invoice_workflow

router = APIRouter(prefix="/api/v1/invoice", tags=["Invoice Processing & Validation"])

ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
ALLOWED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
ALLOWED_PDF_TYPES = ["application/pdf"]
ALLOWED_PDF_EXTENSIONS = (".pdf",)

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def run_invoice_ai_background(
    invoice_id: uuid.UUID,
    file_bytes: bytes,
    file_name: str,
    mime_type: str,
    user_id: uuid.UUID,
):
    """
    Background worker that runs the LangGraph AI invoice extraction and anomaly
    detection workflow, then updates the PostgreSQL database record with findings.
    """
    print("\n" + "=" * 70)
    print(f"🚀 [BACKGROUND TASK STARTED] Invoice ID: {invoice_id} | File: {file_name}")
    print("=" * 70)

    db = SessionLocal()
    try:
        # 1. Execute the LangGraph StateGraph Workflow
        print(f"[Worker] Invoking LangGraph pipeline for {file_name} ({len(file_bytes)} bytes)...")
        pipeline_result = process_invoice_workflow(
            document_bytes=file_bytes,
            file_name=file_name,
            mime_type=mime_type,
            user_id=str(user_id),
        )

        extracted = pipeline_result.get("extracted_data") or {}
        anomalies_data = pipeline_result.get("anomalies") or []
        status_result = pipeline_result.get("status", "PENDING_REVIEW")
        audit_summary = pipeline_result.get("audit_summary", "")

        print(f"[Worker] Pipeline finished. Extracted Vendor='{extracted.get('vendor_name')}', Total=${extracted.get('total_amount')}, Status='{status_result}'")

        # 2. Parse extracted date safely
        invoice_date_val = date.today()
        if extracted.get("invoice_date"):
            try:
                invoice_date_val = datetime.strptime(
                    extracted["invoice_date"][:10], "%Y-%m-%d"
                ).date()
            except Exception as e:
                print(f"[Worker] Date parsing notice: {e}, using today's date.")

        # 3. Retrieve and update existing invoice in PostgreSQL
        invoice_record = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice_record:
            print(f"[Worker] ❌ Invoice record {invoice_id} not found in database.")
            return

        invoice_record.invoice_number = extracted.get("invoice_number", invoice_record.invoice_number)
        invoice_record.vendor_name = extracted.get("vendor_name", "Unknown Vendor")
        invoice_record.invoice_date = invoice_date_val
        invoice_record.total_amount = float(extracted.get("total_amount") or 0.0)
        invoice_record.currency = extracted.get("currency", "USD")
        invoice_record.status = status_result

        # 4. Insert extracted Line Items
        print(f"[Worker] Saving {len(extracted.get('line_items', []))} line item(s)...")
        for item in extracted.get("line_items", []):
            line_item = InvoiceLineItem(
                id=uuid.uuid4(),
                invoice_id=invoice_record.id,
                description=item.get("description", "Item"),
                quantity=float(item.get("quantity") or 1.0),
                unit_price=float(item.get("unit_price") or 0.0),
                total_amount=float(item.get("total_amount") or 0.0),
                category=item.get("category", "General"),
            )
            db.add(line_item)

        # 5. Insert Anomaly Findings
        print(f"[Worker] Saving {len(anomalies_data)} anomaly finding(s)...")
        for anomaly in anomalies_data:
            anomaly_entry = AnomalyFinding(
                id=uuid.uuid4(),
                invoice_id=invoice_record.id,
                anomaly_type=anomaly.get("anomaly_type", "GENERIC_ALERT"),
                severity=anomaly.get("severity", "MEDIUM"),
                explanation=anomaly.get("explanation", "Potential anomaly detected."),
                evidence=anomaly.get("evidence"),
            )
            db.add(anomaly_entry)

        db.commit()
        print("=" * 70)
        print(f"✅ [BACKGROUND TASK FINISHED] Successfully updated Invoice {invoice_id} in PostgreSQL!")
        print("=" * 70 + "\n")

    except Exception as e:
        print("=" * 70)
        print(f"❌ [BACKGROUND TASK FAILED] Error processing invoice {invoice_id}: {e}")
        print(traceback.format_exc())
        print("=" * 70 + "\n")
        try:
            db.rollback()
            failed_invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if failed_invoice:
                failed_invoice.status = "FLAGGED"
                db.commit()
        except Exception as db_err:
            print(f"[Worker] Rollback error: {db_err}")
    finally:
        db.close()


async def _handle_invoice_upload(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Session,
    current_user: User,
    expected_type: Optional[str] = None,
):
    """
    Validates file format, saves initial invoice row immediately to PostgreSQL,
    and delegates the heavy LangGraph AI extraction to a background worker.
    """
    filename = (file.filename or "invoice").lower()
    content_type = (file.content_type or "").lower()

    # 1. Format validation
    if expected_type == "image":
        if not (content_type in ALLOWED_IMAGE_TYPES or filename.endswith(ALLOWED_IMAGE_EXTENSIONS)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type for image upload. Please upload a PNG, JPG, JPEG, or WEBP image.",
            )
    elif expected_type == "pdf":
        if not (content_type in ALLOWED_PDF_TYPES or filename.endswith(ALLOWED_PDF_EXTENSIONS)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type for PDF upload. Please upload a PDF document (.pdf).",
            )
    else:
        is_image = content_type in ALLOWED_IMAGE_TYPES or filename.endswith(ALLOWED_IMAGE_EXTENSIONS)
        is_pdf = content_type in ALLOWED_PDF_TYPES or filename.endswith(ALLOWED_PDF_EXTENSIONS)
        if not (is_image or is_pdf):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a PDF or an Image (PNG, JPG, WEBP).",
            )

    # 2. Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # 3. Save physical file to disk for persistence
    unique_prefix = uuid.uuid4().hex[:8]
    stored_filename = f"{unique_prefix}_{file.filename or 'invoice.pdf'}"
    local_file_path = os.path.join(UPLOAD_DIR, stored_filename)

    try:
        with open(local_file_path, "wb") as f:
            f.write(file_bytes)
        print(f"[Upload] Saved physical file to {local_file_path}")
    except Exception as e:
        print(f"[Upload] Warning: Could not write to disk: {e}")

    # 4. Insert initial Invoice record into PostgreSQL with status="PROCESSING"
    new_invoice_id = uuid.uuid4()
    temp_invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"

    new_invoice = Invoice(
        id=new_invoice_id,
        submitter_id=current_user.id,
        invoice_number=temp_invoice_number,
        vendor_name="Processing OCR...",
        invoice_date=date.today(),
        total_amount=0.0,
        currency="USD",
        status="PROCESSING",
        document_url=f"/uploads/{stored_filename}",
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    print(f"[Upload] Ingested initial Invoice row (ID: {new_invoice.id}) in PostgreSQL.")

    # 5. Launch LangGraph AI extraction in the background
    background_tasks.add_task(
        run_invoice_ai_background,
        new_invoice.id,
        file_bytes,
        file.filename or "invoice.pdf",
        file.content_type or ("application/pdf" if expected_type == "pdf" else "image/png"),
        current_user.id,
    )

    # 6. Return immediate HTTP 201 response
    return {
        "message": "Invoice uploaded successfully. AI processing started in the background.",
        "invoice_id": str(new_invoice.id),
        "invoice_number": new_invoice.invoice_number,
        "vendor_name": new_invoice.vendor_name,
        "status": new_invoice.status,
        "total_amount": float(new_invoice.total_amount),
        "currency": new_invoice.currency,
        "anomalies_detected": 0,
    }


# ============================================================================
# 1. DEDICATED IMAGE UPLOAD ROUTE
# ============================================================================
@router.post("/upload/image", status_code=status.HTTP_201_CREATED)
async def upload_invoice_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Invoice image (PNG, JPG, JPEG, WEBP)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for uploading image-based invoices and receipts.
    Saves initial record and runs Vision OCR & LangGraph checks in the background.
    """
    return await _handle_invoice_upload(
        file=file,
        background_tasks=background_tasks,
        db=db,
        current_user=current_user,
        expected_type="image",
    )


# ============================================================================
# 2. DEDICATED PDF UPLOAD ROUTE
# ============================================================================
@router.post("/upload/pdf", status_code=status.HTTP_201_CREATED)
async def upload_invoice_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Invoice PDF document (.pdf)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for uploading PDF invoice documents.
    Saves initial record and runs PDF parsing & LangGraph checks in the background.
    """
    return await _handle_invoice_upload(
        file=file,
        background_tasks=background_tasks,
        db=db,
        current_user=current_user,
        expected_type="pdf",
    )


# ============================================================================
# 3. GENERAL MULTI-FORMAT UPLOAD ROUTE
# ============================================================================
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_and_validate_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Invoice file (PDF or Image)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Universal endpoint supporting either PDF or image files with background processing.
    """
    return await _handle_invoice_upload(
        file=file,
        background_tasks=background_tasks,
        db=db,
        current_user=current_user,
        expected_type=None,
    )


# ============================================================================
# 4. SCHEMAS & RBAC FOR INVOICE DECISIONS
# ============================================================================
from pydantic import BaseModel, Field

class InvoiceDecisionRequest(BaseModel):
    status: str = Field(..., description="Decision: APPROVED, REJECTED, FLAGGED, PENDING_REVIEW")
    notes: Optional[str] = Field(default=None, description="Optional audit notes or reviewer remarks")


def require_invoice_decision_maker(current_user: User = Depends(get_current_user)) -> User:
    """
    Role-Based Access Control:
    Auditor, Admin, Finance, Compliance, and Manager users can approve/reject invoices.
    """
    role = (current_user.role or "").upper()
    dept = (current_user.department or "").upper()
    
    allowed_roles = {"ADMIN", "AUDITOR", "FINANCE", "COMPLIANCE", "MANAGER", "SUPERADMIN"}
    allowed_depts = {"FINANCE", "COMPLIANCE", "ADMIN", "AUDIT", "LEGAL"}

    if role not in allowed_roles and dept not in allowed_depts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Invoice approval/rejection requires Auditor, Finance, Compliance, Manager, or Admin privileges.",
        )
    return current_user


# ============================================================================
# 5. RETRIEVAL & HUMAN-IN-THE-LOOP ROUTES
# ============================================================================
@router.get("/get-all-invoice")
def get_all_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all invoices in the ledger with submitter, approver, line items, and anomalies.
    """
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    
    results = []
    for inv in invoices:
        results.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name,
            "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
            "total_amount": float(inv.total_amount) if inv.total_amount is not None else 0.0,
            "currency": inv.currency,
            "status": inv.status,
            "document_url": inv.document_url,
            "submitter_id": str(inv.submitter_id) if inv.submitter_id else None,
            "submitter_name": inv.submitter.name if inv.submitter else "Unknown",
            "submitter_email": inv.submitter.email if inv.submitter else None,
            "submitter_department": inv.submitter.department if inv.submitter else None,
            "approver_id": str(inv.approver_id) if inv.approver_id else None,
            "approver_name": inv.approver.name if inv.approver else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "line_items": [
                {
                    "id": str(li.id),
                    "description": li.description,
                    "quantity": float(li.quantity),
                    "unit_price": float(li.unit_price),
                    "total_amount": float(li.total_amount),
                    "category": li.category,
                }
                for li in inv.line_items
            ],
            "anomalies": [
                {
                    "id": str(an.id),
                    "anomaly_type": an.anomaly_type,
                    "severity": an.severity,
                    "explanation": an.explanation,
                    "evidence": an.evidence,
                    "created_at": an.created_at.isoformat() if an.created_at else None,
                }
                for an in inv.anomalies
            ],
        })
    return results


@router.get("/{invoice_id}")
def get_invoice_details(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve specific invoice details along with full line items and anomalies.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "vendor_name": inv.vendor_name,
        "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
        "total_amount": float(inv.total_amount) if inv.total_amount is not None else 0.0,
        "currency": inv.currency,
        "status": inv.status,
        "document_url": inv.document_url,
        "submitter_id": str(inv.submitter_id) if inv.submitter_id else None,
        "submitter_name": inv.submitter.name if inv.submitter else "Unknown",
        "submitter_email": inv.submitter.email if inv.submitter else None,
        "submitter_department": inv.submitter.department if inv.submitter else None,
        "approver_id": str(inv.approver_id) if inv.approver_id else None,
        "approver_name": inv.approver.name if inv.approver else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "line_items": [
            {
                "id": str(li.id),
                "description": li.description,
                "quantity": float(li.quantity),
                "unit_price": float(li.unit_price),
                "total_amount": float(li.total_amount),
                "category": li.category,
            }
            for li in inv.line_items
        ],
        "anomalies": [
            {
                "id": str(an.id),
                "anomaly_type": an.anomaly_type,
                "severity": an.severity,
                "explanation": an.explanation,
                "evidence": an.evidence,
                "created_at": an.created_at.isoformat() if an.created_at else None,
            }
            for an in inv.anomalies
        ],
    }


@router.post("/{invoice_id}/decision")
def update_invoice_decision(
    invoice_id: uuid.UUID,
    decision_in: InvoiceDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_invoice_decision_maker),
):
    """
    Human-in-the-Loop decision endpoint:
    Allows Auditor, Admin, Finance, Compliance, or Manager to Approve, Reject, or Flag an invoice.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    valid_statuses = {"APPROVED", "REJECTED", "FLAGGED", "PENDING_REVIEW"}
    requested_status = decision_in.status.upper()
    if requested_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: '{decision_in.status}'. Must be one of {valid_statuses}",
        )

    invoice.status = requested_status
    invoice.approver_id = current_user.id
    
    # If notes provided and status is FLAGGED or REJECTED, we can log an AnomalyFinding or record
    if decision_in.notes and requested_status in ["FLAGGED", "REJECTED"]:
        manual_finding = AnomalyFinding(
            id=uuid.uuid4(),
            invoice_id=invoice.id,
            anomaly_type="HUMAN_REVIEWER_FLAG",
            severity="HIGH" if requested_status == "FLAGGED" else "CRITICAL",
            explanation=f"Reviewer ({current_user.name} / {current_user.role}): {decision_in.notes}",
            evidence=f"Reviewed by {current_user.email} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
        )
        db.add(manual_finding)

    db.commit()
    db.refresh(invoice)

    print(f"[HumanDecision] Invoice {invoice.invoice_number} marked as '{invoice.status}' by {current_user.name} ({current_user.role}).")

    return {
        "message": f"Invoice {invoice.invoice_number} successfully marked as {invoice.status}.",
        "invoice_id": str(invoice.id),
        "status": invoice.status,
        "approver_name": current_user.name,
    }
