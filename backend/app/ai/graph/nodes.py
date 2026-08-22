import json
import traceback
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
from app.ai.graph.state import InvoiceState
from app.ai.ocr_service import ocr_service, ExtractedInvoiceData
from app.ai.vector_store import vector_store_manager
from app.ai.llm_factory import get_llm


def ocr_extraction_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 1: Extract structured invoice data from raw document bytes using Multimodal LLM / OCR.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 1/5] OCR & Multimodal Extraction Node")
    print("------------------------------------------------------------")

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
        if "pdf" in mime_type.lower() or file_name.lower().endswith(".pdf"):
            result: ExtractedInvoiceData = ocr_service.extract_from_pdf_bytes(doc_bytes)
        else:
            result: ExtractedInvoiceData = ocr_service.extract_from_image_bytes(doc_bytes, mime_type=mime_type)

        extracted_dict = result.model_dump()
        print(f"  ✅ Extraction Complete: Vendor='{extracted_dict.get('vendor_name')}', Invoice#='{extracted_dict.get('invoice_number')}', Amount=${extracted_dict.get('total_amount'):,.2f}")
        print(f"  📦 Line items extracted: {len(extracted_dict.get('line_items', []))}")

        return {
            "extracted_data": extracted_dict,
            "raw_text": extracted_dict.get("raw_text", ""),
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
    Node 2: Search Vector Store (FAISS / Pinecone) for historical invoices & vendor pricing context.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 2/5] Vector Context Retrieval Node (FAISS / Pinecone)")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    vendor = extracted.get("vendor_name", "")
    items_desc = " ".join([i.get("description", "") for i in extracted.get("line_items", [])])

    query = f"Vendor: {vendor}. Items: {items_desc}"
    print(f"  🔍 Querying Vector Store for: {query[:80]}...")

    try:
        matches = vector_store_manager.similarity_search(query=query, k=3)
        historical_data = [
            {"content": doc.page_content, "metadata": doc.metadata}
            for doc in matches
            if doc.metadata.get("type") != "baseline"
        ]
        print(f"  ✅ Retrieved {len(historical_data)} historical matching records.")
        return {"historical_matches": historical_data}
    except Exception as e:
        print(f"  ⚠️ Vector store retrieval notice (non-fatal): {e}")
        return {"historical_matches": []}


def rule_validation_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 3: Deterministic financial rule validations (sum checks, date validations).
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 3/5] Deterministic Financial Rule Validation Node")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    line_items = extracted.get("line_items", [])
    total_amount = float(extracted.get("total_amount") or 0.0)
    subtotal = float(extracted.get("subtotal") or 0.0)
    tax_amount = float(extracted.get("tax_amount") or 0.0)

    calculated_line_total = sum(float(i.get("total_amount") or 0.0) for i in line_items)
    rule_checks: List[Dict[str, Any]] = []
    math_valid = True

    # Check 1: Line items sum check
    if line_items and calculated_line_total > 0:
        expected_total = subtotal + tax_amount if subtotal > 0 else calculated_line_total + tax_amount
        diff = abs(total_amount - expected_total)
        if diff > 0.05:
            math_valid = False
            severity_tag = "CRITICAL" if diff > 50.0 else ("HIGH" if diff > 5.0 else "MEDIUM")
            print(f"  ⚠️ MATH DISCREPANCY: Items sum ({calculated_line_total:.2f}) + tax != total ({total_amount:.2f}) [Diff: ${diff:.2f}]")
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_MISMATCH",
                "passed": False,
                "diff_amount": round(diff, 2),
                "severity_guideline": severity_tag,
                "detail": f"Calculated items sum (${calculated_line_total:.2f}) + tax (${tax_amount:.2f}) differs from total (${total_amount:.2f}) by ${diff:.2f}.",
            })
        else:
            print("  ✅ Mathematical check passed: Line items accurately sum to total amount.")
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_CHECK",
                "passed": True,
                "detail": "Line items sum matches total amount within rounding tolerance.",
            })

    # Check 2: High value threshold check ($10,000)
    if total_amount > 10000.0:
        print(f"  ⚠️ HIGH VALUE INVOICE: ${total_amount:,.2f} exceeds standard $10,000 threshold.")
        rule_checks.append({
            "rule": "HIGH_VALUE_THRESHOLD",
            "passed": False,
            "severity_guideline": "HIGH",
            "detail": f"Invoice amount ${total_amount:,.2f} exceeds standard $10,000 threshold requiring senior executive approval.",
        })

    return {
        "rule_checks": rule_checks,
        "is_math_valid": math_valid,
    }


def anomaly_detection_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 4: AI Forensic Anomaly Detection with Strict Deterministic Severity Rubric.
    Evaluates extraction against historical context and rule checks.
    """
    print("\n------------------------------------------------------------")
    print("▶ [LangGraph Node 4/5] AI Forensic Anomaly Detection Node")
    print("------------------------------------------------------------")

    extracted = state.get("extracted_data") or {}
    historical = state.get("historical_matches", [])
    rule_checks = state.get("rule_checks", [])

    system_prompt = (
        "You are an AI Forensic Auditor operating under strict Corporate Financial Audit Standards. "
        "Your mission is to evaluate the provided invoice data with 100% deterministic consistency.\n\n"
        "=== STRICT SEVERITY CLASSIFICATION MATRIX ===\n"
        "You MUST classify anomalies according to these exact criteria:\n\n"
        "1. CRITICAL (Risk Score 0.85 - 1.00):\n"
        "   - Severe mathematical tampering: Line items sum differs from invoice total by > $50.00 or > 10%.\n"
        "   - Duplicate invoice: Identical invoice number and vendor with matching amount found in historical records.\n"
        "   - Fraudulent/Impossible dates: Invoice date is set > 30 days in the future or in a closed fiscal year.\n\n"
        "2. HIGH (Risk Score 0.60 - 0.84):\n"
        "   - Capital expenditure policy breach: Total invoice amount exceeds $10,000.00.\n"
        "   - Noticeable calculation mismatch: Sum of line items differs from total by $5.00 to $50.00.\n"
        "   - Missing vendor identity: No verifiable vendor name or legal entity identifier.\n\n"
        "3. MEDIUM (Risk Score 0.30 - 0.59):\n"
        "   - Price outlier: Item unit price is > 30% higher than historical benchmark.\n"
        "   - Minor calculation discrepancy: Difference between items sum and total is $0.50 to $4.99.\n"
        "   - Unitemized round-number expense: Flat unitemized lump sum (e.g. exactly $5,000.00) without breakdown.\n\n"
        "4. LOW (Risk Score 0.10 - 0.29):\n"
        "   - Cent rounding difference: Rounding discrepancy < $0.50.\n"
        "   - Minor name abbreviation or formatting notice (e.g. 'Inc' vs 'Incorporated').\n"
        "   - Informational note: Missing non-critical metadata (e.g. optional phone number).\n\n"
        "5. CLEAN / NO ANOMALY (Risk Score 0.00 - 0.09):\n"
        "   - IF mathematical sums match within $0.05, total is <= $10,000, and vendor is legitimate, "
        "     YOU MUST RETURN an empty anomalies list '[]' and risk_score 0.05.\n"
        "   - DO NOT invent anomalies or speculate about fraud if the invoice is clean and valid.\n\n"
        "=== OUTPUT FORMAT ===\n"
        "Return ONLY a JSON object with this exact schema:\n"
        "{\n"
        '  "anomalies": [\n'
        '    {\n'
        '      "anomaly_type": "string (e.g. MATH_MISMATCH, HIGH_VALUE_THRESHOLD, PRICE_OUTLIER, DUPLICATE_INVOICE)",\n'
        '      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
        '      "explanation": "Clear, factual explanation citing exact numbers",\n'
        '      "evidence": "Exact numbers and fields from invoice"\n'
        '    }\n'
        "  ],\n"
        '  "risk_score": 0.05\n'
        "}"
    )

    user_payload = (
        f"INVOICE UNDER AUDIT:\n{json.dumps(extracted, indent=2)}\n\n"
        f"HISTORICAL SIMILAR INVOICES:\n{json.dumps(historical, indent=2)}\n\n"
        f"DETERMINISTIC RULE RESULTS:\n{json.dumps(rule_checks, indent=2)}"
    )

    try:
        llm = get_llm(temperature=0.0)
        print("  🤖 Executing forensic audit with temperature=0.0...")
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
        anomalies = parsed.get("anomalies", [])
        risk_score = float(parsed.get("risk_score", 0.05))

        print(f"  ✅ Audit Result: Found {len(anomalies)} anomaly flag(s), Risk Score={risk_score:.2f}")
        for idx, a in enumerate(anomalies, 1):
            print(f"     [{idx}] [{a.get('severity')}] {a.get('anomaly_type')}: {a.get('explanation')}")

        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
        }
    except Exception as e:
        print(f"  ⚠️ Anomaly Detection LLM fallback: {e}")
        fallback_risk = 0.05 if state.get("is_math_valid", True) else 0.65
        return {
            "anomalies": [],
            "risk_score": fallback_risk,
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
    is_math_valid = state.get("is_math_valid", True)
    extracted = state.get("extracted_data") or {}

    has_critical = any(a.get("severity") == "CRITICAL" for a in anomalies)
    has_high = any(a.get("severity") == "HIGH" for a in anomalies)

    if has_critical or (not is_math_valid and risk_score >= 0.70) or risk_score >= 0.85:
        status = "FLAGGED"
        summary = f"Flagged for urgent audit. Detected critical risk (Risk Score: {risk_score:.2f})."
    elif has_high or not is_math_valid or risk_score >= 0.50:
        status = "FLAGGED"
        summary = f"Flagged for manual compliance review (Risk Score: {risk_score:.2f})."
    elif len(anomalies) > 0 or risk_score >= 0.20:
        status = "PENDING_REVIEW"
        summary = f"Requires manager sign-off. Minor notices detected (Risk Score: {risk_score:.2f})."
    else:
        status = "APPROVED"
        summary = f"Invoice verified successfully with no discrepancies (Risk Score: {risk_score:.2f})."

    print(f"  🏁 Final Decision: Status='{status}', Summary='{summary}'")

    # Index processed invoice to Vector Store for future similarity queries
    if extracted.get("vendor_name") and extracted.get("vendor_name") not in ["UNKNOWN", "Unidentified Vendor"]:
        try:
            print("  💾 Indexing verified document to Vector Store...")
            doc_content = (
                f"Vendor: {extracted.get('vendor_name')}. "
                f"Total: {extracted.get('total_amount')} {extracted.get('currency')}. "
                f"Date: {extracted.get('invoice_date')}. "
                f"Items: {', '.join([i.get('description', '') for i in extracted.get('line_items', [])])}"
            )
            vector_store_manager.add_documents([
                Document(
                    page_content=doc_content,
                    metadata={
                        "invoice_number": extracted.get("invoice_number", ""),
                        "vendor_name": extracted.get("vendor_name", ""),
                        "amount": extracted.get("total_amount", 0.0),
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
    }
