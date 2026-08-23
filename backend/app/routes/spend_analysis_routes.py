import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.database import get_db
from app.models import User, Invoice, InvoiceLineItem
from app.authentication import get_current_user

router = APIRouter(
    prefix="/api/v1/spend-analysis",
    tags=["Spend Analysis & Financial Intelligence"]
)


def normalize_vendor_name(raw_name: Optional[str]) -> str:
    """
    Cleans, strips, and canonicalizes vendor names to prevent duplicate split rows
    (e.g., 'amazon', 'AMAZON', '  Amazon  ' all merge cleanly into 'Amazon').
    """
    if not raw_name:
        return "Miscellaneous / Unidentified"
    clean = raw_name.strip()
    if not clean or clean.lower() in [
        "unknown vendor",
        "processing ocr...",
        "unidentified",
        "unidentified vendor",
        "n/a",
        "none",
        "null",
    ]:
        return "Miscellaneous / Unidentified"
    
    # Capitalize cleanly while preserving common enterprise acronyms
    words = clean.split()
    normalized_words = []
    for w in words:
        if len(w) <= 4 and w.isupper():
            normalized_words.append(w)
        else:
            normalized_words.append(w.capitalize())
    return " ".join(normalized_words)


def get_approved_invoices_query(
    db: Session,
    current_user: User,
    time_range: Optional[str] = "all",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    vendor: Optional[str] = None,
):
    """
    Constructs the base SQLAlchemy query for invoices that satisfy strict approval criteria:
    1. Human rejection ALWAYS excludes the invoice (human_status == 'REJECTED' is filtered out).
    2. Human approval ALWAYS includes the invoice (human_status == 'APPROVED').
    3. If human review is pending or unset, AI / System approval is accepted (ai_status == 'APPROVED' or status == 'APPROVED').
    """
    role = (current_user.role or "EMPLOYEE").upper()
    dept = (current_user.department or "GENERAL").upper()

    is_admin = role in ["ADMIN", "SUPERADMIN"]
    is_finance = role == "FINANCE" or dept == "FINANCE"
    is_compliance = role in ["COMPLIANCE", "AUDITOR"] or dept in ["COMPLIANCE", "AUDIT", "LEGAL"]
    is_manager = role == "MANAGER"

    # Base query
    query = db.query(Invoice)

    # Scoping by role
    if not (is_admin or is_finance or is_compliance):
        if is_manager:
            dept_user_ids = [u.id for u in db.query(User.id).filter(func.upper(User.department) == dept).all()]
            query = query.filter(
                or_(Invoice.submitter_id.in_(dept_user_ids), Invoice.submitter_id == current_user.id)
            )
        else:
            query = query.filter(Invoice.submitter_id == current_user.id)

    # Strict Case-Insensitive Approval Filter
    approved_filter = and_(
        or_(Invoice.human_status == None, func.upper(Invoice.human_status) != "REJECTED"),
        or_(
            func.upper(Invoice.human_status) == "APPROVED",
            and_(
                or_(Invoice.human_status == None, func.upper(Invoice.human_status) == "PENDING"),
                or_(func.upper(Invoice.ai_status) == "APPROVED", func.upper(Invoice.status) == "APPROVED"),
            ),
        ),
    )
    query = query.filter(approved_filter)

    # Time range filters
    now = datetime.utcnow()
    if time_range == "30d":
        cutoff = now - timedelta(days=30)
        query = query.filter(Invoice.created_at >= cutoff)
    elif time_range == "90d":
        cutoff = now - timedelta(days=90)
        query = query.filter(Invoice.created_at >= cutoff)
    elif time_range == "6m":
        cutoff = now - timedelta(days=180)
        query = query.filter(Invoice.created_at >= cutoff)
    elif time_range == "1y":
        cutoff = now - timedelta(days=365)
        query = query.filter(Invoice.created_at >= cutoff)

    # Exact calendar date filters
    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    # Department filter
    if department and department.strip().upper() not in ["ALL", ""]:
        dept_users = db.query(User.id).filter(func.upper(User.department) == department.strip().upper()).all()
        dept_uids = [u[0] for u in dept_users]
        query = query.filter(Invoice.submitter_id.in_(dept_uids))

    # Vendor name filter
    if vendor and vendor.strip().upper() not in ["ALL", ""]:
        query = query.filter(Invoice.vendor_name.ilike(f"%{vendor.strip()}%"))

    return query


@router.get("/overview")
def get_spend_overview(
    time_range: str = Query("all", description="Time range: 30d, 90d, 6m, 1y, all"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    vendor: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns high-level spend metrics computed strictly on Approved Invoices.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range, start_date, end_date, department, vendor
    ).all()

    total_approved_spend = sum(float(i.total_amount or 0.0) for i in invoices)
    total_subtotal = sum(float(i.subtotal if i.subtotal is not None else (i.total_amount or 0.0)) for i in invoices)
    total_tax_paid = sum(float(i.tax_amount or 0.0) for i in invoices)
    invoice_count = len(invoices)
    avg_invoice_value = round(total_approved_spend / max(1, invoice_count), 2)

    # Month-over-Month calculation (last 30 days vs previous 30 days)
    now = datetime.utcnow()
    last_30_cutoff = now - timedelta(days=30)
    prev_30_cutoff = now - timedelta(days=60)

    last_30_spend = sum(
        float(i.total_amount or 0.0) for i in invoices if i.created_at and i.created_at >= last_30_cutoff
    )
    prev_30_invoices = get_approved_invoices_query(db, current_user).filter(
        Invoice.created_at >= prev_30_cutoff,
        Invoice.created_at < last_30_cutoff
    ).all()
    prev_30_spend = sum(float(i.total_amount or 0.0) for i in prev_30_invoices)

    if prev_30_spend > 0:
        mom_growth_pct = round(((last_30_spend - prev_30_spend) / prev_30_spend) * 100, 1)
    else:
        mom_growth_pct = 0.0

    return {
        "total_approved_spend": round(total_approved_spend, 2),
        "total_subtotal": round(total_subtotal, 2),
        "total_tax_paid": round(total_tax_paid, 2),
        "invoice_count": invoice_count,
        "avg_invoice_value": avg_invoice_value,
        "last_30_days_spend": round(last_30_spend, 2),
        "prev_30_days_spend": round(prev_30_spend, 2),
        "mom_growth_pct": mom_growth_pct,
        "currency": "INR",
        "filter_applied": {
            "time_range": time_range,
            "department": department or "All",
            "vendor": vendor or "All",
        },
    }


@router.get("/vendors")
def get_spend_by_vendors(
    limit: int = Query(20, description="Top N vendors to return"),
    time_range: str = Query("all", description="Time range: 30d, 90d, 6m, 1y, all"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    vendor: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns spend aggregated by normalized vendor for all approved invoices.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range, start_date, end_date, department, vendor
    ).all()

    total_spend_all = sum(float(i.total_amount or 0.0) for i in invoices)
    vendor_stats = defaultdict(lambda: {
        "total_spend": 0.0,
        "tax_paid": 0.0,
        "invoice_count": 0,
        "latest_invoice_date": None,
        "currency": "INR",
    })

    for inv in invoices:
        v_name = normalize_vendor_name(inv.vendor_name)
        amt = float(inv.total_amount or 0.0)
        tax = float(inv.tax_amount or 0.0)
        vendor_stats[v_name]["total_spend"] += amt
        vendor_stats[v_name]["tax_paid"] += tax
        vendor_stats[v_name]["invoice_count"] += 1
        vendor_stats[v_name]["currency"] = inv.currency or "INR"
        
        inv_dt = inv.invoice_date or (inv.created_at.date() if inv.created_at else None)
        if inv_dt:
            curr_latest = vendor_stats[v_name]["latest_invoice_date"]
            if not curr_latest or inv_dt > curr_latest:
                vendor_stats[v_name]["latest_invoice_date"] = inv_dt

    sorted_vendors = sorted(vendor_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True)
    results = []

    for v_name, stats in sorted_vendors[:limit]:
        v_spend = round(stats["total_spend"], 2)
        share_pct = round((v_spend / total_spend_all * 100) if total_spend_all > 0 else 0.0, 1)
        results.append({
            "vendor_name": v_name,
            "total_spend": v_spend,
            "tax_paid": round(stats["tax_paid"], 2),
            "invoice_count": stats["invoice_count"],
            "avg_invoice_amount": round(v_spend / max(1, stats["invoice_count"]), 2),
            "share_percentage": share_pct,
            "latest_invoice_date": str(stats["latest_invoice_date"]) if stats["latest_invoice_date"] else None,
            "currency": stats.get("currency", "INR"),
        })

    return {
        "total_vendors_count": len(vendor_stats),
        "total_approved_spend": round(total_spend_all, 2),
        "top_vendors": results,
    }


@router.get("/vendor/{vendor_name}/invoices")
def get_vendor_approved_invoices(
    vendor_name: str,
    limit: int = Query(50, description="Max invoices to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the list of approved invoices for a specific vendor.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range="all", vendor=vendor_name
    ).order_by(Invoice.created_at.desc()).limit(limit).all()

    return {
        "vendor_name": vendor_name,
        "invoice_count": len(invoices),
        "total_spend": round(sum(float(i.total_amount or 0.0) for i in invoices), 2),
        "invoices": [
            {
                "id": str(i.id),
                "invoice_number": i.invoice_number,
                "vendor_name": i.vendor_name,
                "invoice_date": str(i.invoice_date) if i.invoice_date else None,
                "total_amount": float(i.total_amount or 0.0),
                "tax_amount": float(i.tax_amount or 0.0),
                "currency": i.currency or "INR",
                "status": i.status,
                "human_status": i.human_status or "APPROVED",
                "submitter_name": i.submitter.name if i.submitter else "Unknown",
                "submitter_department": i.submitter.department if i.submitter else "General",
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in invoices
        ],
    }


@router.get("/departments")
def get_spend_by_departments(
    time_range: str = Query("all", description="Time range: 30d, 90d, 6m, 1y, all"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns spend aggregated by submitting department across all approved invoices.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range, start_date, end_date
    ).all()

    total_spend_all = sum(float(i.total_amount or 0.0) for i in invoices)
    dept_stats = defaultdict(lambda: {"total_spend": 0.0, "invoice_count": 0, "tax_paid": 0.0})

    for inv in invoices:
        d_name = (inv.submitter.department if inv.submitter and inv.submitter.department else "General").strip().title()
        amt = float(inv.total_amount or 0.0)
        tax = float(inv.tax_amount or 0.0)
        dept_stats[d_name]["total_spend"] += amt
        dept_stats[d_name]["tax_paid"] += tax
        dept_stats[d_name]["invoice_count"] += 1

    sorted_depts = sorted(dept_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True)
    results = []

    for d_name, stats in sorted_depts:
        d_spend = round(stats["total_spend"], 2)
        share_pct = round((d_spend / total_spend_all * 100) if total_spend_all > 0 else 0.0, 1)
        results.append({
            "department": d_name,
            "total_spend": d_spend,
            "tax_paid": round(stats["tax_paid"], 2),
            "invoice_count": stats["invoice_count"],
            "share_percentage": share_pct,
        })

    return {
        "total_approved_spend": round(total_spend_all, 2),
        "departments": results,
    }


@router.get("/categories")
def get_spend_by_categories(
    time_range: str = Query("all", description="Time range: 30d, 90d, 6m, 1y, all"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns spend breakdown across line item expense categories (e.g. Software, Hardware, Travel, Services).
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range, start_date, end_date, department
    ).all()

    category_stats = defaultdict(lambda: {"total_spend": 0.0, "items_count": 0})
    total_line_spend = 0.0

    for inv in invoices:
        for item in (inv.line_items or []):
            cat = (item.category or "General Expenses").strip().title()
            item_amt = float(item.total_amount or 0.0)
            category_stats[cat]["total_spend"] += item_amt
            category_stats[cat]["items_count"] += 1
            total_line_spend += item_amt

    if total_line_spend == 0:
        total_line_spend = sum(float(i.total_amount or 0.0) for i in invoices)
        if total_line_spend > 0:
            category_stats["Operational & General"]["total_spend"] = total_line_spend
            category_stats["Operational & General"]["items_count"] = len(invoices)

    sorted_cats = sorted(category_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True)
    results = []

    for cat_name, stats in sorted_cats:
        cat_spend = round(stats["total_spend"], 2)
        share_pct = round((cat_spend / total_line_spend * 100) if total_line_spend > 0 else 0.0, 1)
        results.append({
            "category": cat_name,
            "total_spend": cat_spend,
            "items_count": stats["items_count"],
            "share_percentage": share_pct,
        })

    return {
        "total_line_spend": round(total_line_spend, 2),
        "categories": results,
    }


@router.get("/monthly-trend")
def get_monthly_spend_trend(
    months: int = Query(12, description="Number of historical months"),
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns month-over-month approved spend timeline for financial forecasting and burn rate analysis.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range="all", department=department
    ).all()

    today = date.today()
    monthly_data = {}
    
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        monthly_data[key] = {
            "month_key": key,
            "month_label": datetime(y, m, 1).strftime("%b %Y"),
            "total_spend": 0.0,
            "tax_paid": 0.0,
            "invoice_count": 0,
        }

    for inv in invoices:
        inv_dt = inv.invoice_date or (inv.created_at.date() if inv.created_at else None)
        if inv_dt:
            key = f"{inv_dt.year:04d}-{inv_dt.month:02d}"
            if key in monthly_data:
                monthly_data[key]["total_spend"] += float(inv.total_amount or 0.0)
                monthly_data[key]["tax_paid"] += float(inv.tax_amount or 0.0)
                monthly_data[key]["invoice_count"] += 1

    trend_list = []
    for k in sorted(monthly_data.keys()):
        item = monthly_data[k]
        trend_list.append({
            "month": item["month_key"],
            "label": item["month_label"],
            "total_spend": round(item["total_spend"], 2),
            "tax_paid": round(item["tax_paid"], 2),
            "invoice_count": item["invoice_count"],
        })

    return {
        "period_months": months,
        "monthly_trend": trend_list,
    }


@router.get("/all")
def get_all_spend_analysis(
    time_range: str = Query("all", description="Time range: 30d, 90d, 6m, 1y, all"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department: Optional[str] = None,
    vendor: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Consolidated single-request endpoint delivering all spend analytics dimensions for fast, reactive dashboard rendering.
    """
    invoices = get_approved_invoices_query(
        db, current_user, time_range, start_date, end_date, department, vendor
    ).all()

    # 1. Overview KPIs
    total_approved_spend = sum(float(i.total_amount or 0.0) for i in invoices)
    total_subtotal = sum(float(i.subtotal if i.subtotal is not None else (i.total_amount or 0.0)) for i in invoices)
    total_tax_paid = sum(float(i.tax_amount or 0.0) for i in invoices)
    invoice_count = len(invoices)
    avg_invoice_value = round(total_approved_spend / max(1, invoice_count), 2)

    # MoM Calculation
    now = datetime.utcnow()
    last_30_cutoff = now - timedelta(days=30)
    prev_30_cutoff = now - timedelta(days=60)
    last_30_spend = sum(float(i.total_amount or 0.0) for i in invoices if i.created_at and i.created_at >= last_30_cutoff)

    prev_30_invoices = get_approved_invoices_query(db, current_user).filter(
        Invoice.created_at >= prev_30_cutoff,
        Invoice.created_at < last_30_cutoff
    ).all()
    prev_30_spend = sum(float(i.total_amount or 0.0) for i in prev_30_invoices)
    mom_growth_pct = round(((last_30_spend - prev_30_spend) / prev_30_spend) * 100, 1) if prev_30_spend > 0 else 0.0

    # 2. Normalized Vendors Breakdown
    vendor_stats = defaultdict(lambda: {
        "total_spend": 0.0,
        "tax_paid": 0.0,
        "invoice_count": 0,
        "latest_invoice_date": None,
        "currency": "INR",
    })
    for inv in invoices:
        v_name = normalize_vendor_name(inv.vendor_name)
        amt = float(inv.total_amount or 0.0)
        tax = float(inv.tax_amount or 0.0)
        vendor_stats[v_name]["total_spend"] += amt
        vendor_stats[v_name]["tax_paid"] += tax
        vendor_stats[v_name]["invoice_count"] += 1
        vendor_stats[v_name]["currency"] = inv.currency or "INR"

        inv_dt = inv.invoice_date or (inv.created_at.date() if inv.created_at else None)
        if inv_dt:
            curr_latest = vendor_stats[v_name]["latest_invoice_date"]
            if not curr_latest or inv_dt > curr_latest:
                vendor_stats[v_name]["latest_invoice_date"] = inv_dt

    top_vendors = []
    for v_name, stats in sorted(vendor_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True)[:10]:
        v_spend = round(stats["total_spend"], 2)
        share_pct = round((v_spend / total_approved_spend * 100) if total_approved_spend > 0 else 0.0, 1)
        top_vendors.append({
            "vendor_name": v_name,
            "total_spend": v_spend,
            "tax_paid": round(stats["tax_paid"], 2),
            "invoice_count": stats["invoice_count"],
            "avg_invoice_amount": round(v_spend / max(1, stats["invoice_count"]), 2),
            "share_percentage": share_pct,
            "latest_invoice_date": str(stats["latest_invoice_date"]) if stats["latest_invoice_date"] else None,
            "currency": stats.get("currency", "INR"),
        })

    # 3. Department Breakdown
    dept_stats = defaultdict(lambda: {"total_spend": 0.0, "invoice_count": 0})
    for inv in invoices:
        d_name = (inv.submitter.department if inv.submitter and inv.submitter.department else "General").strip().title()
        dept_stats[d_name]["total_spend"] += float(inv.total_amount or 0.0)
        dept_stats[d_name]["invoice_count"] += 1

    departments_list = []
    for d_name, stats in sorted(dept_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True):
        d_spend = round(stats["total_spend"], 2)
        share_pct = round((d_spend / total_approved_spend * 100) if total_approved_spend > 0 else 0.0, 1)
        departments_list.append({
            "department": d_name,
            "total_spend": d_spend,
            "invoice_count": stats["invoice_count"],
            "share_percentage": share_pct,
        })

    # 4. Categories Breakdown
    category_stats = defaultdict(lambda: {"total_spend": 0.0, "items_count": 0})
    total_line_spend = 0.0
    for inv in invoices:
        for item in (inv.line_items or []):
            cat = (item.category or "General Expenses").strip().title()
            item_amt = float(item.total_amount or 0.0)
            category_stats[cat]["total_spend"] += item_amt
            category_stats[cat]["items_count"] += 1
            total_line_spend += item_amt

    if total_line_spend == 0 and total_approved_spend > 0:
        category_stats["Operational & General"]["total_spend"] = total_approved_spend
        category_stats["Operational & General"]["items_count"] = len(invoices)
        total_line_spend = total_approved_spend

    categories_list = []
    for cat_name, stats in sorted(category_stats.items(), key=lambda x: x[1]["total_spend"], reverse=True)[:8]:
        cat_spend = round(stats["total_spend"], 2)
        share_pct = round((cat_spend / total_line_spend * 100) if total_line_spend > 0 else 0.0, 1)
        categories_list.append({
            "category": cat_name,
            "total_spend": cat_spend,
            "items_count": stats["items_count"],
            "share_percentage": share_pct,
        })

    # 5. Monthly Trend (6 months)
    today = date.today()
    monthly_data = {}
    for i in range(5, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        monthly_data[key] = {
            "month": key,
            "label": datetime(y, m, 1).strftime("%b %Y"),
            "total_spend": 0.0,
            "tax_paid": 0.0,
            "invoice_count": 0,
        }

    for inv in invoices:
        inv_dt = inv.invoice_date or (inv.created_at.date() if inv.created_at else None)
        if inv_dt:
            key = f"{inv_dt.year:04d}-{inv_dt.month:02d}"
            if key in monthly_data:
                monthly_data[key]["total_spend"] += float(inv.total_amount or 0.0)
                monthly_data[key]["tax_paid"] += float(inv.tax_amount or 0.0)
                monthly_data[key]["invoice_count"] += 1

    monthly_trend = [
        {
            "month": v["month"],
            "label": v["label"],
            "total_spend": round(v["total_spend"], 2),
            "tax_paid": round(v["tax_paid"], 2),
            "invoice_count": v["invoice_count"],
        }
        for k, v in sorted(monthly_data.items())
    ]

    return {
        "overview": {
            "total_approved_spend": round(total_approved_spend, 2),
            "total_subtotal": round(total_subtotal, 2),
            "total_tax_paid": round(total_tax_paid, 2),
            "invoice_count": invoice_count,
            "avg_invoice_value": avg_invoice_value,
            "last_30_days_spend": round(last_30_spend, 2),
            "prev_30_days_spend": round(prev_30_spend, 2),
            "mom_growth_pct": mom_growth_pct,
            "currency": "INR",
        },
        "top_vendors": top_vendors,
        "departments": departments_list,
        "categories": categories_list,
        "monthly_trend": monthly_trend,
        "criteria": "Approved Invoices Only (Human Approval accepted, AI Approval accepted if human pending, Human Rejection strictly excluded)",
    }
