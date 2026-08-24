import os
import uuid
import traceback
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query, status
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import User, Invoice, InvoiceLineItem, AnomalyFinding
from app.authentication import get_current_user
from app.ai.graph.workflow import process_invoice_workflow, process_single_invoice_workflow
from app.ai.ocr_service import ocr_service, get_currency_symbol, normalize_currency

router = APIRouter(prefix="/api/v1/invoice", tags=["Invoice Processing & Validation"])

ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
ALLOWED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
ALLOWED_PDF_TYPES = ["application/pdf"]
ALLOWED_PDF_EXTENSIONS = (".pdf",)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def run_invoice_ai_background(
    invoice_id: uuid.UUID,
    file_bytes: bytes,
    file_name: str,
    mime_type: str,
    user_id: uuid.UUID,
):
    """
    Background worker that extracts all invoices (1, 2, 3+) from the uploaded file,
    runs the full LangGraph validation & anomaly pipeline for each invoice independently,
    and creates/updates PostgreSQL records for all detected invoices with proper currency formatting.
    """
    print("\n" + "=" * 70)
    print(f"🚀 [BACKGROUND TASK STARTED] Initial Invoice ID: {invoice_id} | File: {file_name}")
    print("=" * 70)

    db = SessionLocal()
    try:
        # 1. Multi-Invoice OCR Extraction
        print(f"[Worker] Invoking multi-invoice OCR extraction for {file_name} ({len(file_bytes)} bytes)...")
        extracted_invoices = ocr_service.extract_all_invoices(
            document_bytes=file_bytes,
            file_name=file_name,
            mime_type=mime_type,
        )
        print(f"[Worker] Multi-Invoice Result: Found {len(extracted_invoices)} invoice(s) in {file_name}.")

        initial_invoice_record = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        doc_url = initial_invoice_record.document_url if initial_invoice_record else f"/uploads/{file_name}"

        # 2. Process each individual invoice through all validation steps
        for idx, ext_invoice in enumerate(extracted_invoices):
            extracted_dict = ext_invoice.model_dump()
            norm_curr = normalize_currency(extracted_dict.get("currency"), raw_text_context=extracted_dict.get("raw_text", ""))
            extracted_dict["currency"] = norm_curr
            sym = get_currency_symbol(norm_curr)

            print(f"\n--- [Processing Invoice {idx+1}/{len(extracted_invoices)}] ---")
            print(f"    Inv#: '{ext_invoice.invoice_number}', Vendor: '{ext_invoice.vendor_name}', Amount: {sym}{ext_invoice.total_amount:,.2f} ({norm_curr})")

            # Run full LangGraph pipeline for this specific invoice
            pipeline_result = process_single_invoice_workflow(
                extracted_data=extracted_dict,
                document_bytes=file_bytes,
                file_name=file_name,
                mime_type=mime_type,
                user_id=str(user_id),
            )

            final_extracted = pipeline_result.get("extracted_data") or extracted_dict
            anomalies_data = pipeline_result.get("anomalies") or []
            status_result = pipeline_result.get("status", "PENDING_REVIEW")
            risk_score_val = float(pipeline_result.get("risk_score") if pipeline_result.get("risk_score") is not None else 0.05)
            risk_level_val = str(pipeline_result.get("risk_level") or "LOW")
            confidence_val = float(pipeline_result.get("overall_confidence") if pipeline_result.get("overall_confidence") is not None else 0.95)

            # Parse extracted date safely
            invoice_date_val = date.today()
            if final_extracted.get("invoice_date"):
                try:
                    invoice_date_val = datetime.strptime(
                        final_extracted["invoice_date"][:10], "%Y-%m-%d"
                    ).date()
                except Exception as e:
                    print(f"    [Worker] Date parsing notice: {e}, using today's date.")

            # Assign or create Invoice in PostgreSQL
            if idx == 0 and initial_invoice_record:
                target_invoice = initial_invoice_record
            else:
                target_invoice = Invoice(
                    id=uuid.uuid4(),
                    submitter_id=user_id,
                    document_url=doc_url,
                )
                db.add(target_invoice)

            target_invoice.invoice_number = final_extracted.get("invoice_number", f"INV-{uuid.uuid4().hex[:8].upper()}")
            target_invoice.vendor_name = final_extracted.get("vendor_name", "Unknown Vendor")
            target_invoice.invoice_date = invoice_date_val
            target_invoice.subtotal = float(final_extracted.get("subtotal") or final_extracted.get("total_amount") or 0.0)
            target_invoice.tax_amount = float(final_extracted.get("tax_amount") or 0.0)
            target_invoice.total_amount = float(final_extracted.get("total_amount") or 0.0)
            target_invoice.currency = final_extracted.get("currency") or "INR"
            target_invoice.status = status_result
            target_invoice.ai_status = status_result
            target_invoice.human_status = "PENDING"
            target_invoice.overall_confidence = confidence_val
            target_invoice.risk_level = risk_level_val
            target_invoice.risk_score = risk_score_val
            target_invoice.recommended_action = pipeline_result.get("recommended_action")

            # Clean previous items & insert fresh Line Items for this specific invoice
            db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == target_invoice.id).delete()
            print(f"    [Worker] Saving {len(final_extracted.get('line_items', []))} line item(s)...")
            for item in final_extracted.get("line_items", []):
                line_item = InvoiceLineItem(
                    id=uuid.uuid4(),
                    invoice_id=target_invoice.id,
                    description=str(item.get("description") or "Item"),
                    quantity=float(item.get("quantity") or 1.0),
                    unit_price=float(item.get("unit_price") or 0.0),
                    total_amount=float(item.get("total_amount") or 0.0),
                    category=str(item.get("category") or "General"),
                )
                db.add(line_item)

            # Clean previous anomalies & insert fresh Anomaly Findings for this specific invoice
            db.query(AnomalyFinding).filter(AnomalyFinding.invoice_id == target_invoice.id).delete()
            print(f"    [Worker] Saving {len(anomalies_data)} anomaly finding(s) to PostgreSQL...")
            seen_flags = set()
            for anomaly in anomalies_data:
                a_flag = str(anomaly.get("anomaly_flag") or anomaly.get("anomaly_type") or "AUDIT_NOTICE").strip()[:150]
                if a_flag in seen_flags:
                    continue
                seen_flags.add(a_flag)

                a_type = a_flag
                sev = str(anomaly.get("severity") or "MEDIUM").strip().upper()
                if sev not in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                    sev = "MEDIUM"
                reason = str(anomaly.get("reason") or anomaly.get("explanation") or "Potential discrepancy detected during audit.").strip()
                expl = reason
                evid = str(anomaly.get("evidence")).strip() if anomaly.get("evidence") else None

                anomaly_entry = AnomalyFinding(
                    id=uuid.uuid4(),
                    invoice_id=target_invoice.id,
                    anomaly_flag=a_flag,
                    anomaly_type=a_type,
                    severity=sev,
                    reason=reason,
                    explanation=expl,
                    evidence=evid,
                )
                db.add(anomaly_entry)

            db.commit()
            print(f"    ✅ Successfully saved Invoice {idx+1}/{len(extracted_invoices)} (ID: {target_invoice.id}, Inv#: {target_invoice.invoice_number}, Status: '{status_result}', Risk: {risk_score_val:.2f}, Confidence: {confidence_val:.2f})")

        print("=" * 70)
        print(f"✅ [BACKGROUND TASK FINISHED] Successfully extracted and saved {len(extracted_invoices)} separate invoice(s) in PostgreSQL!")
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
    and delegates the multi-invoice LangGraph AI extraction to a background worker.
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

    MAX_FILE_SIZE = 10 * 1024 * 1024  # Strict 10MB limit
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the 10MB limit ({len(file_bytes) / (1024 * 1024):.1f}MB uploaded). Please upload a file under 10MB.",
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

    # Check if PDF file is password protected
    if expected_type == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(local_file_path)
            if reader.is_encrypted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="PDF file is password protected. Please remove the password and try again.",
                )
        except HTTPException:
            raise
        except Exception:
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(local_file_path)
                if reader.is_encrypted:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="PDF file is password protected. Please remove the password and try again.",
                    )
            except HTTPException:
                raise
            except Exception as e:
                print(f"[Upload] PDF encryption check notice: {e}")

    new_invoice = Invoice(
        id=new_invoice_id,
        submitter_id=current_user.id,
        invoice_number=temp_invoice_number,
        vendor_name="",
        invoice_date=date.today(),
        subtotal=0.0,
        tax_amount=0.0,
        total_amount=0.0,
        currency="INR",
        status="PROCESSING",
        document_url=f"/uploads/{stored_filename}",
        overall_confidence=0.95,
        risk_level="LOW",
        risk_score=0.05,
        recommended_action="AI audit in progress...",
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
        "message": "Invoice uploaded successfully. AI processing started in the background (supporting multiple invoices per document).",
        "invoice_id": str(new_invoice.id),
        "invoice_number": new_invoice.invoice_number,
        "vendor_name": new_invoice.vendor_name,
        "status": new_invoice.status,
        "ai_status": new_invoice.ai_status or new_invoice.status,
        "human_status": new_invoice.human_status or "PENDING",
        "subtotal": float(new_invoice.subtotal or 0.0),
        "tax_amount": float(new_invoice.tax_amount or 0.0),
        "total_amount": float(new_invoice.total_amount),
        "currency": new_invoice.currency,
        "overall_confidence": float(new_invoice.overall_confidence or 0.95),
        "overall_confidance": float(new_invoice.overall_confidence or 0.95),
        "risk_level": new_invoice.risk_level or "LOW",
        "risk_score": float(new_invoice.risk_score or 0.05),
        "recommended_action": new_invoice.recommended_action,
        "decision_notes": new_invoice.decision_notes,
        "decision_by_name": new_invoice.decision_by_name,
        "decision_by_role": new_invoice.decision_by_role,
        "decision_at": new_invoice.decision_at.isoformat() if new_invoice.decision_at else None,
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
    Only Finance, Auditor, and Admin users can approve or reject invoices.
    Mandatory human approval is strictly enforced.
    """
    role = (current_user.role or "").upper()
    dept = (current_user.department or "").upper()
    
    allowed_roles = {"ADMIN", "AUDITOR", "FINANCE", "SUPERADMIN"}
    allowed_depts = {"FINANCE", "AUDIT", "ADMIN"}

    if role not in allowed_roles and dept not in allowed_depts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Invoice approval/rejection requires Finance, Auditor, or Admin privileges. Human approval is mandatory.",
        )
    return current_user


def _serialize_invoice(inv: Invoice) -> dict:
    """Helper to serialize an Invoice ORM object with its line items and anomalies into a dictionary."""
    conf_val = float(inv.overall_confidence) if inv.overall_confidence is not None else 0.95
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "vendor_name": inv.vendor_name,
        "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
        "subtotal": float(inv.subtotal) if inv.subtotal is not None else float(inv.total_amount or 0.0),
        "tax_amount": float(inv.tax_amount) if inv.tax_amount is not None else 0.0,
        "total_amount": float(inv.total_amount) if inv.total_amount is not None else 0.0,
        "currency": inv.currency or "USD",
        "status": inv.status,
        "ai_status": inv.ai_status or inv.status,
        "human_status": inv.human_status or ("APPROVED" if inv.status == "APPROVED" else ("REJECTED" if inv.status == "REJECTED" else "PENDING")),
        "decision_notes": inv.decision_notes,
        "decision_by_name": inv.decision_by_name or (inv.approver.name if inv.approver else None),
        "decision_by_role": inv.decision_by_role or (inv.approver.role if inv.approver else None),
        "decision_at": inv.decision_at.isoformat() if inv.decision_at else None,
        "document_url": inv.document_url,
        "overall_confidence": conf_val,
        "overall_confidance": conf_val,
        "risk_level": inv.risk_level or "LOW",
        "risk_score": float(inv.risk_score) if inv.risk_score is not None else 0.05,
        "recommended_action": inv.recommended_action,
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
            for li in (inv.line_items or [])
        ],
        "anomalies": [
            {
                "id": str(an.id),
                "anomaly_flag": an.anomaly_flag or an.anomaly_type,
                "anomaly_type": an.anomaly_type or an.anomaly_flag,
                "severity": an.severity,
                "reason": an.reason or an.explanation,
                "explanation": an.explanation or an.reason,
                "evidence": an.evidence,
                "created_at": an.created_at.isoformat() if an.created_at else None,
            }
            for an in (inv.anomalies or [])
        ],
    }


# ============================================================================
# 5. RETRIEVAL & USER INVOICE ROUTES
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
    return [_serialize_invoice(inv) for inv in invoices]


@router.get("/my-invoices", status_code=status.HTTP_200_OK)
@router.get("/my", status_code=status.HTTP_200_OK)
def get_user_invoices(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: PENDING_REVIEW, APPROVED, FLAGGED, REJECTED, PROCESSING"),
    search: Optional[str] = Query(None, description="Search by vendor name or invoice number"),
    start_date: Optional[date] = Query(None, description="Filter invoices on or after this date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter invoices on or before this date (YYYY-MM-DD)"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Limit number of results returned"),
    skip: int = Query(0, ge=0, description="Number of results to skip (offset)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all invoices posted/submitted by the currently authenticated user only.
    Includes full details: submitter info, approver info, line items, and anomaly findings.
    """
    query = db.query(Invoice).filter(Invoice.submitter_id == current_user.id)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Invoice.status == status_filter.upper().strip())

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Invoice.vendor_name.ilike(search_term)) | (Invoice.invoice_number.ilike(search_term))
        )

    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)

    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    query = query.order_by(Invoice.created_at.desc())

    if skip > 0:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)

    invoices = query.all()
    return [_serialize_invoice(inv) for inv in invoices]


@router.get("/my-summary", status_code=status.HTTP_200_OK)
@router.get("/my-invoices/summary", status_code=status.HTTP_200_OK)
def get_user_invoices_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve aggregated summary statistics for invoices posted by the authenticated user.
    """
    invoices = (
        db.query(Invoice)
        .filter(Invoice.submitter_id == current_user.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )

    total_invoices = len(invoices)
    total_spend = sum(float(inv.total_amount or 0.0) for inv in invoices)

    status_counts = {
        "APPROVED": 0,
        "PENDING_REVIEW": 0,
        "PROCESSING": 0,
        "FLAGGED": 0,
        "REJECTED": 0,
    }

    total_anomalies = 0
    for inv in invoices:
        st = (inv.status or "PENDING_REVIEW").upper()
        status_counts[st] = status_counts.get(st, 0) + 1
        total_anomalies += len(inv.anomalies)

    latest_date = invoices[0].created_at.isoformat() if invoices and invoices[0].created_at else None

    return {
        "user_id": str(current_user.id),
        "user_name": current_user.name,
        "user_email": current_user.email,
        "user_department": current_user.department,
        "total_invoices": total_invoices,
        "total_spend": total_spend,
        "currency": "USD",
        "status_counts": status_counts,
        "total_anomalies": total_anomalies,
        "latest_submission": latest_date,
    }


@router.get("/my-invoices/{invoice_id}", status_code=status.HTTP_200_OK)
def get_user_invoice_detail(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve full details for a specific invoice submitted by the currently authenticated user.
    """
    inv = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.submitter_id == current_user.id)
        .first()
    )
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or you do not have permission to view it.",
        )
    return _serialize_invoice(inv)


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
    return _serialize_invoice(inv)


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

    valid_statuses = {"APPROVED", "REJECTED", "FLAGGED", "PENDING_REVIEW", "PENDING", "RESET"}
    requested_status = decision_in.status.upper()
    if requested_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: '{decision_in.status}'. Must be one of {valid_statuses}",
        )

    user_role = (current_user.role or "").upper()
    is_admin = user_role in ["ADMIN", "SUPERADMIN"]

    # Check if invoice was already finalized by a human reviewer
    current_human_status = (invoice.human_status or "").upper()
    if current_human_status in ["APPROVED", "REJECTED"]:
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This invoice has already been finalized as '{current_human_status}' by a human reviewer. Only an Administrator can undo or modify this decision.",
            )

    # Handle Admin Undo / Reset Action
    if requested_status in ["PENDING", "RESET", "PENDING_REVIEW"] and current_human_status in ["APPROVED", "REJECTED"]:
        invoice.human_status = "PENDING"
        invoice.status = invoice.ai_status or "PENDING_REVIEW"
        invoice.approver_id = current_user.id
        invoice.decision_by_name = current_user.name
        invoice.decision_by_role = current_user.role
        invoice.decision_at = datetime.utcnow()
        invoice.decision_notes = (
            f"[Admin Undo by {current_user.name}]: {decision_in.notes}"
            if decision_in.notes
            else f"[Admin Undo by {current_user.name}]: Decision undone and reopened for review."
        )
        # Remove previous human reviewer flags if undoing
        db.query(AnomalyFinding).filter(
            AnomalyFinding.invoice_id == invoice.id,
            AnomalyFinding.anomaly_flag == "HUMAN_REVIEWER_FLAG",
        ).delete()
    else:
        actual_human_status = "PENDING" if requested_status in ["PENDING", "RESET"] else requested_status
        invoice.status = requested_status if requested_status not in ["PENDING", "RESET"] else (invoice.ai_status or "PENDING_REVIEW")
        invoice.human_status = actual_human_status
        invoice.approver_id = current_user.id
        invoice.decision_by_name = current_user.name
        invoice.decision_by_role = current_user.role
        invoice.decision_at = datetime.utcnow()
        invoice.decision_notes = decision_in.notes
        
        # If notes provided and status is FLAGGED or REJECTED, record a manual AnomalyFinding
        if decision_in.notes and requested_status in ["FLAGGED", "REJECTED"]:
            db.query(AnomalyFinding).filter(
                AnomalyFinding.invoice_id == invoice.id,
                AnomalyFinding.anomaly_flag == "HUMAN_REVIEWER_FLAG",
            ).delete()
            manual_finding = AnomalyFinding(
                id=uuid.uuid4(),
                invoice_id=invoice.id,
                anomaly_flag="HUMAN_REVIEWER_FLAG",
                anomaly_type="HUMAN_REVIEWER_FLAG",
                severity="HIGH" if requested_status == "FLAGGED" else "CRITICAL",
                reason=f"Reviewer ({current_user.name} / {current_user.role}): {decision_in.notes}",
                explanation=f"Reviewer ({current_user.name} / {current_user.role}): {decision_in.notes}",
                evidence=f"Reviewed by {current_user.email} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
            )
            db.add(manual_finding)

    db.commit()
    db.refresh(invoice)

    print(f"[HumanDecision] Invoice {invoice.invoice_number} marked as '{invoice.status}' (Human Status: '{invoice.human_status}') by {current_user.name} ({current_user.role}). Notes: {invoice.decision_notes}")

    return {
        "message": f"Invoice {invoice.invoice_number} successfully marked as {invoice.status}.",
        "invoice_id": str(invoice.id),
        "status": invoice.status,
        "ai_status": invoice.ai_status,
        "human_status": invoice.human_status,
        "decision_notes": invoice.decision_notes,
        "decision_by_name": invoice.decision_by_name,
        "decision_by_role": invoice.decision_by_role,
        "decision_at": invoice.decision_at.isoformat() if invoice.decision_at else None,
        "approver_name": current_user.name,
    }
