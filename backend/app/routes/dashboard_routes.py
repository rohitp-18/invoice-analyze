import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import User, Invoice, InvoiceLineItem, AnomalyFinding, CompliancePolicy
from app.authentication import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["Role-Based Dashboard Analytics"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-Aware Dashboard Analytics API:
    Dynamically computes KPIs, status distributions, and recent activity queues
    tailored strictly to the user's role (ADMIN, FINANCE, COMPLIANCE, AUDITOR, MANAGER, EMPLOYEE).
    """
    role = (current_user.role or "EMPLOYEE").upper()
    dept = (current_user.department or "GENERAL").upper()

    is_admin = role in ["ADMIN", "SUPERADMIN"]
    is_finance = role == "FINANCE" or dept == "FINANCE"
    is_compliance = role in ["COMPLIANCE", "AUDITOR"] or dept in ["COMPLIANCE", "AUDIT", "LEGAL"]
    is_manager = role == "MANAGER"
    is_employee = not (is_admin or is_finance or is_compliance or is_manager)

    # ------------------------------------------------------------------------
    # 1. BASE INVOICE QUERY SCOPING
    # ------------------------------------------------------------------------
    if is_admin or is_finance or is_compliance:
        # Full company scope
        scoped_invoices_query = db.query(Invoice)
    elif is_manager:
        # Departmental scope: invoices by users in the same department or submitted by manager
        dept_user_ids = [u.id for u in db.query(User.id).filter(func.upper(User.department) == dept).all()]
        scoped_invoices_query = db.query(Invoice).filter(
            (Invoice.submitter_id.in_(dept_user_ids)) | (Invoice.submitter_id == current_user.id)
        )
    else:
        # Employee scope: only own submitted invoices
        scoped_invoices_query = db.query(Invoice).filter(Invoice.submitter_id == current_user.id)

    all_scoped_invoices = scoped_invoices_query.order_by(Invoice.created_at.desc()).all()

    # ------------------------------------------------------------------------
    # 2. STATUS BREAKDOWN & AGGREGATES
    # ------------------------------------------------------------------------
    total_count = len(all_scoped_invoices)
    total_spend = sum(float(inv.total_amount or 0.0) for inv in all_scoped_invoices)
    
    approved_invoices = [i for i in all_scoped_invoices if i.status == "APPROVED"]
    pending_invoices = [i for i in all_scoped_invoices if i.status in ["PENDING_REVIEW", "PROCESSING"]]
    flagged_invoices = [i for i in all_scoped_invoices if i.status == "FLAGGED"]
    rejected_invoices = [i for i in all_scoped_invoices if i.status == "REJECTED"]

    approved_spend = sum(float(i.total_amount or 0.0) for i in approved_invoices)
    pending_spend = sum(float(i.total_amount or 0.0) for i in pending_invoices)
    flagged_spend = sum(float(i.total_amount or 0.0) for i in flagged_invoices)

    status_breakdown = {
        "APPROVED": len(approved_invoices),
        "PENDING_REVIEW": len([i for i in all_scoped_invoices if i.status == "PENDING_REVIEW"]),
        "PROCESSING": len([i for i in all_scoped_invoices if i.status == "PROCESSING"]),
        "FLAGGED": len(flagged_invoices),
        "REJECTED": len(rejected_invoices),
    }

    # ------------------------------------------------------------------------
    # 3. RECENT INVOICES FORMATTER
    # ------------------------------------------------------------------------
    recent_invoices = []
    for inv in all_scoped_invoices[:8]:
        conf_val = float(inv.overall_confidence) if inv.overall_confidence is not None else 0.95
        recent_invoices.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name,
            "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
            "subtotal": float(inv.subtotal) if inv.subtotal is not None else float(inv.total_amount or 0.0),
            "tax_amount": float(inv.tax_amount) if inv.tax_amount is not None else 0.0,
            "total_amount": float(inv.total_amount or 0.0),
            "currency": inv.currency,
            "status": inv.status,
            "ai_status": inv.ai_status or inv.status,
            "human_status": inv.human_status or ("APPROVED" if inv.status == "APPROVED" else ("REJECTED" if inv.status == "REJECTED" else "PENDING")),
            "decision_notes": inv.decision_notes,
            "decision_by_name": inv.decision_by_name or (inv.approver.name if inv.approver else None),
            "decision_by_role": inv.decision_by_role or (inv.approver.role if inv.approver else None),
            "decision_at": inv.decision_at.isoformat() if inv.decision_at else None,
            "overall_confidence": conf_val,
            "overall_confidance": conf_val,
            "risk_level": inv.risk_level or "LOW",
            "risk_score": float(inv.risk_score) if inv.risk_score is not None else 0.05,
            "recommended_action": inv.recommended_action,
            "submitter_name": inv.submitter.name if inv.submitter else "Unknown",
            "submitter_department": inv.submitter.department if inv.submitter else "General",
            "approver_name": inv.approver.name if inv.approver else None,
            "anomalies_count": len(inv.anomalies),
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })

    # ------------------------------------------------------------------------
    # 4. ROLE-SPECIFIC METRIC COMPILATION
    # ------------------------------------------------------------------------
    metrics = []

    if is_admin:
        total_policies = db.query(CompliancePolicy).count()
        total_users = db.query(User).count()
        critical_anomalies = db.query(AnomalyFinding).filter(AnomalyFinding.severity == "CRITICAL").count()

        metrics = [
            {
                "id": "total_invoices",
                "title": "Total Corporate Invoices",
                "value": str(total_count),
                "detail": f"${total_spend:,.2f} total ledger value",
                "type": "primary",
            },
            {
                "id": "pending_action",
                "title": "Invoices Pending Decision",
                "value": str(len(pending_invoices)),
                "detail": f"${pending_spend:,.2f} awaiting review",
                "type": "warning",
            },
            {
                "id": "critical_risk",
                "title": "Critical AI Risk Flags",
                "value": str(critical_anomalies),
                "detail": f"{len(flagged_invoices)} invoices flagged",
                "type": "danger",
            },
            {
                "id": "active_governance",
                "title": "Compliance Policies",
                "value": str(total_policies),
                "detail": f"{total_users} users in system",
                "type": "success",
            },
        ]

    elif is_finance:
        math_anomalies_count = db.query(AnomalyFinding).filter(
            AnomalyFinding.anomaly_type.ilike("%MATH%") | AnomalyFinding.anomaly_type.ilike("%TOTAL%")
        ).count()

        metrics = [
            {
                "id": "total_spend",
                "title": "Total Spend Volume",
                "value": f"${total_spend:,.2f}",
                "detail": f"{total_count} total invoices processed",
                "type": "primary",
            },
            {
                "id": "ready_disbursement",
                "title": "Approved for Payment",
                "value": f"${approved_spend:,.2f}",
                "detail": f"{len(approved_invoices)} cleared invoices",
                "type": "success",
            },
            {
                "id": "pending_payout",
                "title": "Pending Payout Approvals",
                "value": f"${pending_spend:,.2f}",
                "detail": f"{len(pending_invoices)} invoices in review queue",
                "type": "warning",
            },
            {
                "id": "math_discrepancy",
                "title": "Math / Tax Flags",
                "value": str(math_anomalies_count),
                "detail": "Discrepancies identified by AI",
                "type": "danger",
            },
        ]

    elif is_compliance:
        active_policies = db.query(CompliancePolicy).filter(CompliancePolicy.is_active == True).count()
        total_anomalies = db.query(AnomalyFinding).count()

        metrics = [
            {
                "id": "flagged_invoices",
                "title": "Invoices Flagged for Audit",
                "value": str(len(flagged_invoices)),
                "detail": f"${flagged_spend:,.2f} at potential policy risk",
                "type": "danger",
            },
            {
                "id": "total_violations",
                "title": "Total AI Anomaly Findings",
                "value": str(total_anomalies),
                "detail": "Across historical invoices",
                "type": "warning",
            },
            {
                "id": "active_policies",
                "title": "Active Corporate Policies",
                "value": str(active_policies),
                "detail": "Enforced in FAISS vector store",
                "type": "primary",
            },
            {
                "id": "approved_clean",
                "title": "Compliant / Approved",
                "value": str(len(approved_invoices)),
                "detail": f"{round((len(approved_invoices) / max(1, total_count)) * 100, 1)}% compliance rate",
                "type": "success",
            },
        ]

    elif is_manager:
        metrics = [
            {
                "id": "dept_spend",
                "title": f"{dept.capitalize()} Department Spend",
                "value": f"${total_spend:,.2f}",
                "detail": f"{total_count} total team submissions",
                "type": "primary",
            },
            {
                "id": "awaiting_manager",
                "title": "Awaiting Manager Decision",
                "value": str(len(pending_invoices)),
                "detail": f"${pending_spend:,.2f} pending sign-off",
                "type": "warning",
            },
            {
                "id": "dept_approved",
                "title": "Approved Invoices",
                "value": str(len(approved_invoices)),
                "detail": f"${approved_spend:,.2f} approved",
                "type": "success",
            },
            {
                "id": "dept_flagged",
                "title": "Flagged / Disputed",
                "value": str(len(flagged_invoices) + len(rejected_invoices)),
                "detail": "Requires reviewer follow-up",
                "type": "danger",
            },
        ]

    else:
        # Standard Employee
        metrics = [
            {
                "id": "my_submissions",
                "title": "My Uploaded Invoices",
                "value": str(total_count),
                "detail": f"${total_spend:,.2f} total claim amount",
                "type": "primary",
            },
            {
                "id": "my_pending",
                "title": "In AI Review / Pending",
                "value": str(len(pending_invoices)),
                "detail": f"${pending_spend:,.2f} currently processing",
                "type": "warning",
            },
            {
                "id": "my_approved",
                "title": "Approved Submissions",
                "value": str(len(approved_invoices)),
                "detail": f"${approved_spend:,.2f} cleared for reimbursement",
                "type": "success",
            },
            {
                "id": "my_flagged",
                "title": "Flagged / Inquiries",
                "value": str(len(flagged_invoices) + len(rejected_invoices)),
                "detail": "Requires audit clarification",
                "type": "danger",
            },
        ]

    return {
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "role": role,
            "department": dept,
        },
        "role_category": "ADMIN" if is_admin else ("FINANCE" if is_finance else ("COMPLIANCE" if is_compliance else ("MANAGER" if is_manager else "EMPLOYEE"))),
        "metrics": metrics,
        "status_breakdown": status_breakdown,
        "recent_invoices": recent_invoices,
        "total_count": total_count,
        "total_spend": total_spend,
    }
