import json
import re
import traceback
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
from app.ai.graph.state import InvoiceState
from app.ai.ocr_service import ocr_service, ExtractedInvoiceData, get_currency_symbol, normalize_currency
from app.ai.vector_store import vector_store_manager
from app.ai.llm_factory import get_llm
from app.database import SessionLocal
from app.models import CompliancePolicy, Invoice


def ocr_extraction_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 1: Extract structured invoice data from raw document bytes using Multimodal LLM / OCR.
    If extracted_data is already populated in state, it validates and normalizes currency.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 1/5] OCR & Multimodal Extraction Node")
    print("------------------------------------------------------------")

    # Check if extracted_data is already provided (e.g. from multi-invoice runner)
    if state.get("extracted_data"):
        extracted_dict = state["extracted_data"]
        norm_curr = normalize_currency(extracted_dict.get("currency"), raw_text_context=extracted_dict.get("raw_text", ""))
        extracted_dict["currency"] = norm_curr
        sym = get_currency_symbol(norm_curr)
        print(f"  ✅ Pre-Extracted Data Provided: Vendor='{extracted_dict.get('vendor_name')}', Invoice#='{extracted_dict.get('invoice_number')}', Amount={sym}{extracted_dict.get('total_amount', 0.0):,.2f} ({norm_curr})")
        return {
            "extracted_data": extracted_dict,
            "raw_text": extracted_dict.get("raw_text", ""),
        }

    doc_bytes = state.get("document_bytes")
    mime_type = state.get("mime_type", "application/pdf")
    file_name = state.get("file_name", "invoice")

    if not doc_bytes:
        print("  ❌ No document bytes provided in state.")
        return {
            "errors": state.get("errors", []) + ["No document bytes provided for extraction."],
            "extracted_data": {},
        }

    try:
        print(f"  📄 Processing file: {file_name} ({len(doc_bytes)} bytes, MIME: {mime_type})")
        invoices: List[ExtractedInvoiceData] = ocr_service.extract_all_invoices(
            document_bytes=doc_bytes,
            file_name=file_name,
            mime_type=mime_type,
        )

        first_invoice = invoices[0] if invoices else ExtractedInvoiceData(currency="INR")
        extracted_dict = first_invoice.model_dump()
        norm_curr = normalize_currency(extracted_dict.get("currency"), raw_text_context=extracted_dict.get("raw_text", ""))
        extracted_dict["currency"] = norm_curr
        sym = get_currency_symbol(norm_curr)

        print(f"  ✅ Extraction Complete (Found {len(invoices)} invoice(s)): Vendor='{extracted_dict.get('vendor_name')}', Invoice#='{extracted_dict.get('invoice_number')}', Amount={sym}{extracted_dict.get('total_amount'):,.2f} ({norm_curr})")
        print(f"  📦 Line items extracted: {len(extracted_dict.get('line_items', []))}")

        return {
            "extracted_data": extracted_dict,
            "raw_text": extracted_dict.get("raw_text", ""),
            "multi_invoices": [inv.model_dump() for inv in invoices],
        }
    except Exception as e:
        print(f"  ❌ OCR extraction failed: {e}")
        print(traceback.format_exc())
        return {
            "errors": state.get("errors", []) + [f"OCR extraction failed: {str(e)}"],
            "extracted_data": {},
        }


def vector_retrieval_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 2: Search Vector Store (FAISS / Pinecone) for historical invoices & compliance policy rules.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 2/5] Vector Context & Compliance Policy Retrieval Node")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    vendor = extracted.get("vendor_name", "")
    total_amount = extracted.get("total_amount", 0.0)
    currency = extracted.get("currency", "INR")
    sym = get_currency_symbol(currency)
    items_desc = " ".join([i.get("description", "") for i in extracted.get("line_items", [])])

    query = f"Vendor: {vendor}. Date: {extracted.get('invoice_date', '')}. Invoice #: {extracted.get('invoice_number', '')}. Items: {items_desc}. Amount: {sym}{total_amount} {currency}"
    print(f"  🔍 Querying Vector Store for: {query[:80]}...")

    historical_data = []
    vector_policies = []

    try:
        matches = vector_store_manager.similarity_search(query=query, k=6)
        for doc in matches:
            doc_type = doc.metadata.get("type")
            if doc_type == "compliance_policy":
                vector_policies.append({"content": doc.page_content, "metadata": doc.metadata})
            elif doc_type != "baseline":
                historical_data.append({"content": doc.page_content, "metadata": doc.metadata})

        print(f"  ✅ Retrieved {len(historical_data)} historical invoices and {len(vector_policies)} relevant vector policies.")
    except Exception as e:
        print(f"  ⚠️ Vector store retrieval notice (non-fatal): {e}")

    # Also query active compliance policies and perform direct duplicate & historical pattern lookups in PostgreSQL
    active_db_policies = []
    db_duplicates = []
    vendor_history = {"count": 0, "total_spend": 0.0, "avg_amount": 0.0, "max_amount": 0.0, "min_amount": 0.0}
    recent_vendor_invoices = []

    try:
        db = SessionLocal()
        try:
            # 1. Active compliance policies
            db_rules = db.query(CompliancePolicy).filter(CompliancePolicy.is_active == True).all()
            for r in db_rules:
                active_db_policies.append({
                    "policy_code": r.policy_code,
                    "title": r.title,
                    "category": r.category,
                    "rule_type": r.rule_type,
                    "max_amount": float(r.max_amount) if r.max_amount is not None else None,
                    "currency": r.currency or "INR",
                    "severity": r.severity,
                    "department": r.department or "All",
                    "description": r.description,
                })
            print(f"  📜 Loaded {len(active_db_policies)} active compliance policies from database.")

            # 2. Deterministic Duplicate Detection in PostgreSQL
            inv_num = (extracted.get("invoice_number") or "").strip()
            vendor_clean = (extracted.get("vendor_name") or "").strip()
            
            if inv_num and inv_num.upper() not in ["UNKNOWN", "INV-UNKNOWN", "N/A", ""]:
                matches_num = db.query(Invoice).filter(Invoice.invoice_number.ilike(inv_num)).all()
                for m in matches_num:
                    db_duplicates.append({
                        "id": str(m.id),
                        "invoice_number": m.invoice_number,
                        "vendor_name": m.vendor_name,
                        "total_amount": float(m.total_amount or 0.0),
                        "invoice_date": str(m.invoice_date) if m.invoice_date else None,
                        "status": m.status,
                        "match_type": "EXACT_INVOICE_NUMBER",
                    })
                if db_duplicates:
                    print(f"  🚨 Found {len(db_duplicates)} duplicate invoice match(es) in database for #{inv_num}!")

            # 3. Vendor Historical Spend Pattern & Statistics
            if vendor_clean and vendor_clean.upper() not in ["UNKNOWN", "UNIDENTIFIED VENDOR", "N/A", ""]:
                past_invoices = db.query(Invoice).filter(Invoice.vendor_name.ilike(f"%{vendor_clean}%")).all()
                if past_invoices:
                    v_count = len(past_invoices)
                    v_total = sum(float(pi.total_amount or 0.0) for pi in past_invoices)
                    v_amounts = [float(pi.total_amount or 0.0) for pi in past_invoices]
                    vendor_history = {
                        "count": v_count,
                        "total_spend": round(v_total, 2),
                        "avg_amount": round(v_total / max(1, v_count), 2),
                        "max_amount": round(max(v_amounts), 2),
                        "min_amount": round(min(v_amounts), 2),
                    }
                    print(f"  📊 Vendor History for '{vendor_clean}': {v_count} prior invoices, Total: {sym}{v_total:,.2f}, Avg: {sym}{vendor_history['avg_amount']:,.2f}")

                # 4. Recent Invoices (7-day window) for Split Invoicing / Smurfing Analysis
                from datetime import timedelta
                cutoff_date = date.today() - timedelta(days=7)
                recent_invs = db.query(Invoice).filter(
                    Invoice.vendor_name.ilike(f"%{vendor_clean}%"),
                    Invoice.created_at >= cutoff_date
                ).all()
                for ri in recent_invs:
                    recent_vendor_invoices.append({
                        "id": str(ri.id),
                        "invoice_number": ri.invoice_number,
                        "amount": float(ri.total_amount or 0.0),
                        "created_at": ri.created_at.isoformat() if ri.created_at else None,
                    })
                if recent_vendor_invoices:
                    print(f"  ⏳ Found {len(recent_vendor_invoices)} invoice(s) for '{vendor_clean}' in the past 7 days.")
        finally:
            db.close()
    except Exception as db_err:
        print(f"  ⚠️ Database context fetch notice: {db_err}")

    return {
        "historical_matches": historical_data,
        "applicable_policies": active_db_policies or vector_policies,
        "db_duplicates": db_duplicates,
        "vendor_history": vendor_history,
        "recent_vendor_invoices": recent_vendor_invoices,
    }


from datetime import datetime, date
import dateutil.parser


def rule_validation_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 3: Deterministic financial rule validations (sum checks, currency checks, date validations).
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 3/5] Deterministic Financial Rule Validation Node")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    line_items = extracted.get("line_items", [])
    total_amount = float(extracted.get("total_amount") or 0.0)
    subtotal = float(extracted.get("subtotal") or 0.0)
    tax_amount = float(extracted.get("tax_amount") or 0.0)
    currency = extracted.get("currency", "INR")
    sym = get_currency_symbol(currency)

    calculated_line_total = sum(float(i.get("total_amount") or 0.0) for i in line_items)
    rule_checks: List[Dict[str, Any]] = []
    math_valid = True
    date_valid = True

    # Check 1: Line items sum check
    if line_items and calculated_line_total > 0:
        expected_total = subtotal + tax_amount if subtotal > 0 else calculated_line_total + tax_amount
        diff = abs(total_amount - expected_total)
        if diff > 0.05:
            math_valid = False
            severity_tag = "CRITICAL" if diff > 5000.0 else ("HIGH" if diff > 500.0 else "MEDIUM")
            print(f"  ⚠️ MATH DISCREPANCY: Items sum ({calculated_line_total:.2f}) + tax != total ({total_amount:.2f}) [Diff: {sym}{diff:.2f}]")
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_MISMATCH",
                "passed": False,
                "diff_amount": round(diff, 2),
                "severity_guideline": severity_tag,
                "detail": f"Calculated items sum ({sym}{calculated_line_total:.2f}) + tax ({sym}{tax_amount:.2f}) differs from total ({sym}{total_amount:.2f}) by {sym}{diff:.2f}.",
            })
        else:
            print("  ✅ Mathematical check passed: Line items accurately sum to total amount.")
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_CHECK",
                "passed": True,
                "detail": "Line items sum matches total amount within rounding tolerance.",
            })

    # Check 2: High value threshold check (Threshold adapted to currency)
    threshold_value = 100000.0 if currency == "INR" else 10000.0
    if total_amount > threshold_value:
        print(f"  ⚠️ HIGH VALUE INVOICE: {sym}{total_amount:,.2f} exceeds standard {sym}{threshold_value:,.2f} threshold.")
        rule_checks.append({
            "rule": "HIGH_VALUE_THRESHOLD",
            "passed": False,
            "severity_guideline": "HIGH",
            "detail": f"Invoice amount {sym}{total_amount:,.2f} exceeds standard {sym}{threshold_value:,.2f} threshold requiring senior executive approval.",
        })

    # Check 3: Deterministic Date Validation (Compares against exact today's date)
    raw_date_str = str(extracted.get("invoice_date") or "").strip()
    today = date.today()
    parsed_date = None

    if raw_date_str:
        # Try multiple date formats
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y", "%d %b %Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y"):
            try:
                date_part = raw_date_str[:10] if len(raw_date_str) >= 10 and ("-" in raw_date_str or "/" in raw_date_str or "." in raw_date_str) else raw_date_str
                parsed_date = datetime.strptime(date_part, fmt).date()
                break
            except Exception:
                continue

        if not parsed_date:
            try:
                parsed_date = dateutil.parser.parse(raw_date_str, fuzzy=True).date()
            except Exception:
                pass

    if parsed_date:
        diff_days = (parsed_date - today).days  # positive = future, negative = past
        if diff_days > 30:
            date_valid = False
            print(f"  ⚠️ CRITICAL FUTURE DATE: Invoice date {parsed_date} is {diff_days} days in the future (today is {today}).")
            rule_checks.append({
                "rule": "FUTURE_INVOICE_DATE_CRITICAL",
                "passed": False,
                "diff_days": diff_days,
                "severity_guideline": "CRITICAL",
                "detail": f"Invoice date '{parsed_date}' is {diff_days} days in the future (exceeds allowable 30-day forward threshold; today is {today.isoformat()}).",
            })
        elif 0 < diff_days <= 30:
            date_valid = False
            print(f"  ⚠️ POST-DATED INVOICE: Invoice date {parsed_date} is {diff_days} day(s) in future.")
            rule_checks.append({
                "rule": "FUTURE_INVOICE_DATE_WARNING",
                "passed": False,
                "diff_days": diff_days,
                "severity_guideline": "MEDIUM",
                "detail": f"Invoice date '{parsed_date}' is post-dated by {diff_days} day(s) in the future (today is {today.isoformat()}).",
            })
        elif -90 <= diff_days <= 0:
            date_valid = True
            days_ago = abs(diff_days)
            label = "today" if days_ago == 0 else ("yesterday" if days_ago == 1 else f"{days_ago} days ago")
            print(f"  ✅ Date check passed: Invoice date {parsed_date} is valid ({label}; today is {today}).")
            rule_checks.append({
                "rule": "DATE_VALIDITY_CHECK",
                "passed": True,
                "diff_days": diff_days,
                "detail": f"Invoice date '{parsed_date}' is valid (issued {label}; today is {today.isoformat()}).",
            })
        elif -365 <= diff_days < -90:
            days_ago = abs(diff_days)
            print(f"  ℹ️ STALE INVOICE: Invoice date {parsed_date} is {days_ago} days old.")
            rule_checks.append({
                "rule": "STALE_INVOICE_DATE",
                "passed": False,
                "diff_days": diff_days,
                "severity_guideline": "LOW",
                "detail": f"Invoice date '{parsed_date}' was issued {days_ago} days ago (> 90 days standard submission window).",
            })
        else:
            # diff_days < -365 (older than 1 year)
            date_valid = False
            days_ago = abs(diff_days)
            print(f"  ⚠️ EXPIRED FISCAL YEAR: Invoice date {parsed_date} is {days_ago} days old (> 1 year).")
            rule_checks.append({
                "rule": "EXPIRED_FISCAL_YEAR_DATE",
                "passed": False,
                "diff_days": diff_days,
                "severity_guideline": "HIGH",
                "detail": f"Invoice date '{parsed_date}' was issued {days_ago} days ago (> 365 days, closed fiscal period).",
            })
    elif raw_date_str:
        rule_checks.append({
            "rule": "UNPARSEABLE_DATE_FORMAT",
            "passed": False,
            "severity_guideline": "LOW",
            "detail": f"Invoice date format '{raw_date_str}' could not be parsed into a calendar date.",
        })

    # Check 4: Database-backed Duplicate Invoice Detection (Consolidated)
    db_duplicates = state.get("db_duplicates", [])
    if db_duplicates:
        primary_dup = db_duplicates[0]
        dup_inv = primary_dup.get("invoice_number", "")
        dup_vendor = primary_dup.get("vendor_name", "")
        dup_amt = primary_dup.get("total_amount", 0.0)
        dup_date = primary_dup.get("invoice_date", "N/A")
        dup_id = primary_dup.get("id", "")
        extra_count = len(db_duplicates) - 1
        extra_info = f" (and {extra_count} additional matching entry/entries in system)" if extra_count > 0 else ""
        print(f"  🚨 DUPLICATE INVOICE DETECTED: Matches existing Invoice #{dup_inv} ({dup_vendor}, {sym}{dup_amt:,.2f})")
        rule_checks.append({
            "rule": "DUPLICATE_INVOICE_DETECTED",
            "passed": False,
            "severity_guideline": "CRITICAL",
            "detail": f"Duplicate invoice detected: Invoice #{dup_inv} for vendor '{dup_vendor}' ({sym}{dup_amt:,.2f}, issued {dup_date}) already exists in the system (Invoice ID: {dup_id}){extra_info}.",
            "evidence": f"Existing Record ID: {dup_id} | Inv#: {dup_inv} | Amount: {sym}{dup_amt:,.2f} | Status: {primary_dup.get('status')}",
        })

    # Check 5: Split Invoices & Evasion Detection (Multiple invoices in 7 days)
    recent_vendor_invoices = state.get("recent_vendor_invoices", [])
    if len(recent_vendor_invoices) >= 2:
        combined_split_total = total_amount + sum(r.get("amount", 0.0) for r in recent_vendor_invoices)
        print(f"  ⚠️ SUSPECTED SPLIT INVOICES: {len(recent_vendor_invoices) + 1} invoices in 7-day window totaling {sym}{combined_split_total:,.2f}")
        rule_checks.append({
            "rule": "SPLIT_INVOICE_SUSPECTED",
            "passed": False,
            "severity_guideline": "HIGH",
            "detail": f"Suspected invoice splitting pattern: {len(recent_vendor_invoices) + 1} invoices detected for vendor '{extracted.get('vendor_name')}' within a 7-day window with combined spend of {sym}{combined_split_total:,.2f}. This may indicate structuring to circumvent standard executive authorization limits.",
            "evidence": f"Window: 7 Days | Invoice Count: {len(recent_vendor_invoices) + 1} | Cumulative Spend: {sym}{combined_split_total:,.2f}",
        })

    # Check 6: Unusual Spending Spikes & Vendor Historical Outliers
    vendor_history = state.get("vendor_history", {})
    if vendor_history.get("count", 0) >= 2:
        avg_amount = float(vendor_history.get("avg_amount", 0.0))
        if avg_amount > 0 and total_amount > (avg_amount * 2.5):
            multiplier = total_amount / avg_amount
            sev = "HIGH" if multiplier >= 4.0 else "MEDIUM"
            print(f"  ⚠️ UNUSUAL SPENDING SPIKE: {multiplier:.1f}x higher than vendor baseline average ({sym}{avg_amount:,.2f})")
            rule_checks.append({
                "rule": "UNUSUAL_SPENDING_SPIKE",
                "passed": False,
                "severity_guideline": sev,
                "detail": f"Unusual spending anomaly: Current invoice amount ({sym}{total_amount:,.2f}) is {multiplier:.1f}x higher than the historical baseline average of {sym}{avg_amount:,.2f} across {vendor_history.get('count')} past invoices for vendor '{extracted.get('vendor_name')}'.",
                "evidence": f"Current: {sym}{total_amount:,.2f} vs Historical Avg: {sym}{avg_amount:,.2f} ({multiplier:.1f}x Spike across {vendor_history.get('count')} prior records)",
            })

    return {
        "rule_checks": rule_checks,
        "is_math_valid": math_valid,
        "is_date_valid": date_valid,
    }


def canonical_anomaly_flag(flag: str) -> str:
    """Standardizes anomaly flags into canonical uppercase tokens to eliminate duplicates."""
    f = (flag or "AUDIT_NOTICE").strip().upper().replace("-", "_").replace(" ", "_")
    if "DUPLICATE" in f:
        return "DUPLICATE_INVOICE_DETECTED"
    if "SPLIT" in f:
        return "SPLIT_INVOICE_SUSPECTED"
    if "SPIKE" in f or "UNUSUAL_SPEND" in f or "OUTLIER" in f:
        return "UNUSUAL_SPENDING_SPIKE"
    if "MATH" in f or "CALCULATION" in f or "SUM_MISMATCH" in f:
        return "MATH_CALCULATION_DISCREPANCY"
    if "HIGH_VALUE" in f or ("THRESHOLD" in f and "POLICY" not in f):
        return "HIGH_VALUE_THRESHOLD_EXCEEDED"
    if "FUTURE" in f and "DATE" in f:
        return "FUTURE_INVOICE_DATE"
    if "EXPIRED" in f or "FISCAL" in f:
        return "EXPIRED_FISCAL_YEAR_DATE"
    if "STALE" in f:
        return "STALE_INVOICE_DATE"
    return f


def anomaly_detection_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 4: AI Forensic Anomaly Detection & Policy Enforcement Node.
    Deterministically evaluates rule checks & active corporate policies, then combines with LLM findings.
    Enforces strict canonical deduplication so no anomaly flag or reason is repeated.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 4/5] AI Forensic Anomaly & Policy Enforcement Node")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    historical = state.get("historical_matches", [])
    applicable_policies = state.get("applicable_policies", [])
    rule_checks = state.get("rule_checks", [])
    total_amount = float(extracted.get("total_amount") or 0.0)
    currency = extracted.get("currency", "INR")
    sym = get_currency_symbol(currency)
    today = date.today()
    today_str = today.isoformat()

    # 1. Deterministic Rule & Policy Checking (Guaranteed Anomaly Generation)
    deterministic_anomalies: List[Dict[str, Any]] = []

    # Check rule_checks (Math mismatches, high value thresholds, date checks, duplicates, split invoices, spikes)
    for rc in rule_checks:
        if not rc.get("passed", True):
            rule_name = rc.get("rule", "RULE_FAILED")
            if rule_name == "LINE_ITEMS_SUM_MISMATCH":
                deterministic_anomalies.append({
                    "anomaly_flag": "MATH_CALCULATION_DISCREPANCY",
                    "anomaly_type": "MATH_CALCULATION_DISCREPANCY",
                    "severity": rc.get("severity_guideline", "HIGH"),
                    "reason": rc.get("detail", "Calculated sum of line items does not equal total invoice amount."),
                    "explanation": rc.get("detail", "Calculated sum of line items does not equal total invoice amount."),
                    "evidence": f"Diff Amount: {sym}{rc.get('diff_amount', 0.0):.2f} {currency}",
                })
            elif rule_name == "HIGH_VALUE_THRESHOLD":
                threshold_val = 100000.0 if currency == "INR" else 10000.0
                deterministic_anomalies.append({
                    "anomaly_flag": "HIGH_VALUE_THRESHOLD_EXCEEDED",
                    "anomaly_type": "HIGH_VALUE_THRESHOLD_EXCEEDED",
                    "severity": rc.get("severity_guideline", "HIGH"),
                    "reason": rc.get("detail", f"Invoice amount exceeds standard {sym}{threshold_val:,.2f} threshold requiring executive sign-off."),
                    "explanation": rc.get("detail", f"Invoice amount exceeds standard {sym}{threshold_val:,.2f} threshold requiring executive sign-off."),
                    "evidence": f"Invoice Total: {sym}{total_amount:,.2f} {currency}",
                })
            elif rule_name in ["FUTURE_INVOICE_DATE_CRITICAL", "FUTURE_INVOICE_DATE_WARNING", "EXPIRED_FISCAL_YEAR_DATE", "STALE_INVOICE_DATE"]:
                sev = rc.get("severity_guideline", "MEDIUM")
                deterministic_anomalies.append({
                    "anomaly_flag": rule_name,
                    "anomaly_type": rule_name,
                    "severity": sev,
                    "reason": rc.get("detail", "Invoice date validation failed."),
                    "explanation": rc.get("detail", "Invoice date validation failed."),
                    "evidence": f"Invoice Date: '{extracted.get('invoice_date', '')}' vs Current Reference Date: '{today_str}' (Delta: {rc.get('diff_days', 0)} days)",
                })
            elif rule_name == "DUPLICATE_INVOICE_DETECTED":
                deterministic_anomalies.append({
                    "anomaly_flag": "DUPLICATE_INVOICE_DETECTED",
                    "anomaly_type": "DUPLICATE_INVOICE_DETECTED",
                    "severity": "CRITICAL",
                    "reason": rc.get("detail", "Duplicate invoice detected in system records."),
                    "explanation": rc.get("detail", "Duplicate invoice detected in system records."),
                    "evidence": str(rc.get("evidence") or rc.get("detail")),
                })
            elif rule_name == "SPLIT_INVOICE_SUSPECTED":
                deterministic_anomalies.append({
                    "anomaly_flag": "SPLIT_INVOICE_SUSPECTED",
                    "anomaly_type": "SPLIT_INVOICE_SUSPECTED",
                    "severity": rc.get("severity_guideline", "HIGH"),
                    "reason": rc.get("detail", "Suspected invoice splitting pattern detected across multiple recent submissions."),
                    "explanation": rc.get("detail", "Suspected invoice splitting pattern detected across multiple recent submissions."),
                    "evidence": str(rc.get("evidence") or rc.get("detail")),
                })
            elif rule_name == "UNUSUAL_SPENDING_SPIKE":
                deterministic_anomalies.append({
                    "anomaly_flag": "UNUSUAL_SPENDING_SPIKE",
                    "anomaly_type": "UNUSUAL_SPENDING_SPIKE",
                    "severity": rc.get("severity_guideline", "HIGH"),
                    "reason": rc.get("detail", "Unusual spending anomaly detected relative to vendor baseline history."),
                    "explanation": rc.get("detail", "Unusual spending anomaly detected relative to vendor baseline history."),
                    "evidence": str(rc.get("evidence") or rc.get("detail")),
                })
            else:
                deterministic_anomalies.append({
                    "anomaly_flag": rule_name,
                    "anomaly_type": rule_name,
                    "severity": rc.get("severity_guideline", "MEDIUM"),
                    "reason": rc.get("detail", "Automated validation rule check failed."),
                    "explanation": rc.get("detail", "Automated validation rule check failed."),
                    "evidence": str(rc.get("evidence") or rc.get("detail")),
                })

    # Check active compliance policies deterministically (one finding per policy code)
    seen_policy_codes = set()
    for policy in applicable_policies:
        code = policy.get("policy_code", "POLICY")
        if code in seen_policy_codes:
            continue
        max_amt = policy.get("max_amount")
        if max_amt is not None and max_amt > 0:
            if total_amount > float(max_amt):
                seen_policy_codes.add(code)
                title = policy.get("title", "Corporate Policy")
                sev = policy.get("severity", "HIGH").upper()
                pol_sym = get_currency_symbol(policy.get("currency", currency))
                msg = f"Policy [{code}] '{title}' breached: Invoice amount {sym}{total_amount:,.2f} exceeds allowable policy limit of {pol_sym}{float(max_amt):,.2f}."
                deterministic_anomalies.append({
                    "anomaly_flag": f"POLICY_BREACH_{code}"[:50],
                    "anomaly_type": f"POLICY_BREACH_{code}"[:50],
                    "severity": sev if sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "HIGH",
                    "reason": msg,
                    "explanation": msg,
                    "evidence": f"Policy Limit: {pol_sym}{float(max_amt):,.2f} vs Actual Total: {sym}{total_amount:,.2f} (Policy: {code})",
                })

    print(f"  📌 Identified {len(deterministic_anomalies)} deterministic anomaly finding(s).")

    # 2. LLM Contextual & Forensic Analysis
    system_prompt = (
        "You are an AI Forensic Auditor operating under strict Corporate Financial Audit Standards. "
        "Your mission is to evaluate the provided invoice data against active corporate policies with 100% deterministic consistency.\n\n"
        f"CURRENT REFERENCE AUDIT DATE: Today is {today_str} (Year: {today.year}, Month: {today.month}, Day: {today.day}).\n"
        f"IMPORTANT: The invoice is denominated in '{currency}' (Symbol: {sym}). Format all numerical evidence using the '{sym}' symbol.\n\n"
        "=== STRICT DATE AUDITING RULES ===\n"
        f"- Today's current date is strictly {today_str}.\n"
        "- Do NOT perform date arithmetic in your head or guess date differences.\n"
        f"- Invoices dated on or before {today_str} (such as yesterday, last week, or within the last 90 days) are completely NORMAL and VALID. DO NOT flag them as future dates or fraudulent dates.\n"
        "- Date verification has already been computed deterministically and is supplied in DETERMINISTIC RULE RESULTS. Rely 100% on those rule results for date validity.\n\n"
        "=== STRICT SEVERITY CLASSIFICATION MATRIX ===\n"
        "You MUST classify anomalies according to these exact criteria:\n\n"
        "1. CRITICAL (Risk Score 0.85 - 1.00):\n"
        "   - Duplicate invoice: Identical invoice number and vendor with matching amount found in database/historical records.\n"
        "   - Severe mathematical tampering: Line items sum differs from invoice total by > 10%.\n"
        f"   - Confirmed Future Date: Invoice date is confirmed by deterministic rules to be > 30 days in the future relative to {today_str}.\n\n"
        "2. HIGH (Risk Score 0.60 - 0.84):\n"
        "   - Suspected Split Invoicing: Multiple invoices submitted within a short window to avoid approval caps.\n"
        "   - Unusual Spending Spike: Invoice amount is > 2.5x higher than historical baseline for this vendor.\n"
        "   - Policy threshold breach: Invoice exceeds a defined corporate policy limit.\n"
        "   - Calculation mismatch: Sum of line items differs from total significantly.\n"
        "   - Missing vendor identity: No verifiable vendor name or legal entity identifier.\n\n"
        "3. MEDIUM (Risk Score 0.30 - 0.59):\n"
        "   - Unit price outlier: Item unit price is > 30% higher than historical benchmark.\n"
        "   - Minor calculation discrepancy in line items or tax.\n"
        "   - Travel/Dining breach: Meal or travel expense exceeding corporate daily caps.\n\n"
        "4. LOW (Risk Score 0.10 - 0.29):\n"
        "   - Cent/Paisa rounding difference.\n"
        "   - Minor company name abbreviation or formatting note.\n\n"
        "5. CLEAN / NO ANOMALY (Risk Score 0.00 - 0.09):\n"
        "   - IF mathematical sums match within tolerance, amount is within policy limits, and vendor is legitimate, "
        "     YOU MUST RETURN an empty anomalies list '[]' and risk_score 0.05.\n\n"
        "=== OUTPUT FORMAT ===\n"
        "Return ONLY a valid JSON object with this exact schema:\n"
        "{\n"
        '  "anomalies": [\n'
        '    {\n'
        '      "anomaly_flag": "string",\n'
        '      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
        '      "reason": "Clear, factual explanation citing numbers, currency, and policy code",\n'
        '      "evidence": "Exact numbers with currency symbol, dates, and policy code"\n'
        '    }\n'
        "  ],\n"
        '  "risk_score": 0.05\n'
        "}"
    )

    user_payload = (
        f"CURRENT DATE: {today_str}\n\n"
        f"INVOICE UNDER AUDIT:\n{json.dumps(extracted, indent=2)}\n\n"
        f"VENDOR HISTORICAL SPENDING PATTERN:\n{json.dumps(state.get('vendor_history', {}), indent=2)}\n\n"
        f"RECENT INVOICES IN 7-DAY WINDOW (SPLIT CHECK):\n{json.dumps(state.get('recent_vendor_invoices', []), indent=2)}\n\n"
        f"DATABASE DUPLICATE MATCHES:\n{json.dumps(state.get('db_duplicates', []), indent=2)}\n\n"
        f"ACTIVE CORPORATE COMPLIANCE POLICIES:\n{json.dumps(applicable_policies, indent=2)}\n\n"
        f"HISTORICAL SIMILAR INVOICES:\n{json.dumps(historical, indent=2)}\n\n"
        f"DETERMINISTIC RULE RESULTS:\n{json.dumps(rule_checks, indent=2)}"
    )

    llm_anomalies: List[Dict[str, Any]] = []
    llm_risk_score = 0.05

    try:
        llm = get_llm(temperature=0.0)
        print(f"  🤖 Evaluating invoice against {len(applicable_policies)} corporate policies with LLM...")
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_payload),
        ])

        text = response.content if hasattr(response, "content") else str(response)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        parsed = json.loads(text.strip())
        raw_llm_anoms = parsed.get("anomalies", [])
        for a in raw_llm_anoms:
            flag = a.get("anomaly_flag") or a.get("anomaly_type") or "GENERIC_NOTICE"
            reason_text = a.get("reason") or a.get("explanation") or "Potential anomaly detected."
            llm_anomalies.append({
                "anomaly_flag": flag,
                "anomaly_type": flag,
                "severity": a.get("severity", "MEDIUM"),
                "reason": reason_text,
                "explanation": reason_text,
                "evidence": a.get("evidence"),
            })
        llm_risk_score = float(parsed.get("risk_score", 0.05))
    except Exception as e:
        print(f"  ⚠️ Anomaly Detection LLM notice: {e}")

    # 3. Comprehensive Canonical Merge & Deduplication (Zero Repeated Flags)
    SEVERITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    unique_anomalies_map: Dict[str, Dict[str, Any]] = {}

    all_candidates = deterministic_anomalies + llm_anomalies

    for an in all_candidates:
        raw_flag = an.get("anomaly_flag") or an.get("anomaly_type") or "GENERIC_NOTICE"
        canon_key = canonical_anomaly_flag(raw_flag)

        # Suppress any LLM hallucinated future date flags if deterministic check verified date is valid
        if "FUTURE" in canon_key and state.get("is_date_valid", True):
            print(f"  🛡️ Suppressing LLM hallucinated future date flag '{canon_key}' because date is verified valid.")
            continue

        sev = str(an.get("severity") or "MEDIUM").strip().upper()
        if sev not in SEVERITY_ORDER:
            sev = "MEDIUM"

        reason_text = str(an.get("reason") or an.get("explanation") or "Discrepancy detected.").strip()
        evidence_text = str(an.get("evidence")).strip() if an.get("evidence") else None

        if canon_key not in unique_anomalies_map:
            unique_anomalies_map[canon_key] = {
                "anomaly_flag": canon_key,
                "anomaly_type": canon_key,
                "severity": sev,
                "reason": reason_text,
                "explanation": reason_text,
                "evidence": evidence_text,
            }
        else:
            # Anomaly with this canonical flag already exists: merge cleanly
            existing = unique_anomalies_map[canon_key]
            existing_sev_rank = SEVERITY_ORDER.get(existing["severity"], 2)
            new_sev_rank = SEVERITY_ORDER.get(sev, 2)

            if new_sev_rank > existing_sev_rank:
                existing["severity"] = sev

            # Keep more informative/specific reason
            if len(reason_text) > len(existing["reason"]) and not existing["reason"].startswith("Duplicate invoice detected: Invoice #"):
                existing["reason"] = reason_text
                existing["explanation"] = reason_text

            if evidence_text and not existing.get("evidence"):
                existing["evidence"] = evidence_text

    merged_anomalies = list(unique_anomalies_map.values())

    # 4. Compute Final Dynamic Risk Score & Level
    severity_weights = {
        "CRITICAL": 0.95,
        "HIGH": 0.75,
        "MEDIUM": 0.45,
        "LOW": 0.15,
    }

    if merged_anomalies:
        max_sev_score = max(severity_weights.get(a.get("severity", "MEDIUM"), 0.45) for a in merged_anomalies)
        combined_score = min(1.0, max_sev_score + (0.05 * (len(merged_anomalies) - 1)))
        final_risk_score = max(combined_score, llm_risk_score)
    else:
        final_risk_score = min(llm_risk_score, 0.05)

    if final_risk_score >= 0.85:
        final_risk_level = "CRITICAL"
    elif final_risk_score >= 0.60:
        final_risk_level = "HIGH"
    elif final_risk_score >= 0.30:
        final_risk_level = "MEDIUM"
    else:
        final_risk_level = "LOW"

    # Overall Confidence Calculation
    math_penalty = 0.0 if state.get("is_math_valid", True) else 0.25
    date_penalty = 0.0 if state.get("is_date_valid", True) else 0.20
    anomaly_penalty = min(0.40, len(merged_anomalies) * 0.10)
    calculated_confidence = max(0.40, round(0.99 - (math_penalty + date_penalty + anomaly_penalty), 2))

    print(f"  🔍 Audit Summary: {len(merged_anomalies)} unique anomaly finding(s), Risk Level: {final_risk_level} (Score: {final_risk_score:.2f}), Confidence: {int(calculated_confidence*100)}%")
    for idx, a in enumerate(merged_anomalies, 1):
        print(f"     [{idx}] [{a.get('severity')}] {a.get('anomaly_flag')}: {a.get('reason')}")

    return {
        "anomalies": merged_anomalies,
        "risk_score": round(final_risk_score, 2),
        "risk_level": final_risk_level,
        "overall_confidence": calculated_confidence,
    }


def decision_routing_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 5: Formulate final approval status, audit summary, and indexing to vector store.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 5/5] Decision Routing & Vector Indexing Node")
    print("------------------------------------------------------------")

    anomalies = state.get("anomalies", [])
    risk_score = state.get("risk_score", 0.05)
    risk_level = state.get("risk_level", "LOW")
    overall_confidence = state.get("overall_confidence", 0.95)
    is_math_valid = state.get("is_math_valid", True)
    is_date_valid = state.get("is_date_valid", True)
    extracted = state.get("extracted_data") or {}
    currency = extracted.get("currency", "INR")
    sym = get_currency_symbol(currency)

    has_critical = any(a.get("severity") == "CRITICAL" for a in anomalies)
    has_high = any(a.get("severity") == "HIGH" for a in anomalies)

    if has_critical or (not is_math_valid and risk_score >= 0.70) or risk_score >= 0.85:
        status = "FLAGGED"
        summary = f"Flagged for urgent audit. Detected critical risk (Risk Score: {risk_score:.2f}, Level: {risk_level}, Confidence: {int(overall_confidence*100)}%)."
    elif has_high or not is_math_valid or risk_score >= 0.50:
        status = "FLAGGED"
        summary = f"Flagged for manual compliance review (Risk Score: {risk_score:.2f}, Level: {risk_level}, Confidence: {int(overall_confidence*100)}%)."
    elif len(anomalies) > 0 or risk_score >= 0.20:
        status = "PENDING_REVIEW"
        summary = f"Minor notices detected. Awaiting mandatory human review from Finance/Auditor (Risk Score: {risk_score:.2f}, Level: {risk_level}, Confidence: {int(overall_confidence*100)}%)."
    else:
        # HUMAN APPROVAL IS MANDATORY: AI validates data but clean invoices remain PENDING_REVIEW until approved by Finance/Auditor/Admin
        status = "PENDING_REVIEW"
        summary = f"Invoice verified clean by AI. Awaiting mandatory human sign-off from Finance/Auditor (Risk Score: {risk_score:.2f}, Level: {risk_level}, Confidence: {int(overall_confidence*100)}%)."

    # Synthesize Contextual Recommended Action
    recommended_actions_list: List[str] = []

    # 1. Math check
    if not is_math_valid:
        recommended_actions_list.append("Request vendor to provide a revised invoice correcting calculation discrepancies across itemized totals.")

    # 2. Anomaly specific checks
    for a in anomalies:
        flag = (a.get("anomaly_flag") or a.get("anomaly_type") or "").upper()
        if "DUPLICATE" in flag:
            recommended_actions_list.append("Halt disbursement immediately. Check ERP ledger and existing duplicate invoice record before proceeding.")
            break
        elif "SPLIT" in flag:
            recommended_actions_list.append("Consolidate split invoices for senior executive review to ensure aggregate spend complies with authorization thresholds.")
            break
        elif "UNUSUAL" in flag or "SPIKE" in flag:
            recommended_actions_list.append("Request vendor rate verification and business justification from submitting department for unusual spending spike.")
            break

    for a in anomalies:
        flag = (a.get("anomaly_flag") or a.get("anomaly_type") or "").upper()
        if "FUTURE" in flag:
            recommended_actions_list.append("Hold payment processing and request vendor confirmation of valid issuance date.")
            break
        elif "EXPIRED" in flag:
            recommended_actions_list.append("Verify closed accounting fiscal year rules with Finance before manual exception approval.")
            break

    for a in anomalies:
        flag = (a.get("anomaly_flag") or a.get("anomaly_type") or "").upper()
        if "POLICY_BREACH" in flag or "THRESHOLD" in flag:
            recommended_actions_list.append("Obtain formal executive / Department Head sign-off for corporate expense threshold override.")
            break
        elif "VENDOR" in flag:
            recommended_actions_list.append("Validate vendor tax identification number (GSTIN/EIN) and active vendor master record.")
            break

    # 3. Fallback based on overall status/risk if no specific rule action triggered
    if not recommended_actions_list:
        if status == "FLAGGED":
            recommended_actions_list.append("Route to Senior Financial Auditor for thorough compliance investigation before proceeding.")
        elif status == "PENDING_REVIEW":
            recommended_actions_list.append("Review highlighted line-item details with department manager prior to sign-off.")
        else:
            recommended_actions_list.append("Approve for standard accounts payable release and scheduled payment disbursement.")

    recommended_action = " ".join(recommended_actions_list[:2])

    print(f"  💡 Recommended Action: '{recommended_action}'")

    # Index processed invoice to Vector Store for future similarity queries
    if extracted.get("vendor_name") and extracted.get("vendor_name") not in ["UNKNOWN", "Unidentified Vendor"]:
        try:
            print("  💾 Indexing verified document to Vector Store...")
            doc_content = (
                f"Vendor: {extracted.get('vendor_name')}. "
                f"Total: {sym}{extracted.get('total_amount')} {currency}. "
                f"Date: {extracted.get('invoice_date')}. "
                f"Items: {', '.join([i.get('description', '') for i in extracted.get('line_items', [])])}"
            )
            vector_store_manager.add_documents([
                Document(
                    page_content=doc_content,
                    metadata={
                        "type": "invoice",
                        "invoice_number": extracted.get("invoice_number", ""),
                        "vendor_name": extracted.get("vendor_name", ""),
                        "amount": extracted.get("total_amount", 0.0),
                        "currency": currency,
                        "status": status,
                    },
                )
            ])
            print("  ✅ Document indexed in Vector Store.")
        except Exception as e:
            print(f"  ⚠️ VectorStore Document indexing notice: {e}")

    return {
        "status": status,
        "audit_summary": summary,
        "recommended_action": recommended_action,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "overall_confidence": overall_confidence,
    }
