import json
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
from app.ai.graph.state import InvoiceState
from app.ai.ocr_service import ocr_service, ExtractedInvoiceData
from app.ai.vector_store import vector_store_manager
from app.ai.llm_factory import get_llm


def ocr_extraction_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 1: Extract structured invoice data from the raw document bytes using Multimodal LLM / OCR.
    """
    doc_bytes = state.get("document_bytes")
    mime_type = state.get("mime_type", "application/pdf")

    if not doc_bytes:
        return {
            "errors": state.get("errors", []) + ["No document bytes provided for extraction."],
            "extracted_data": {},
        }

    try:
        if "pdf" in mime_type.lower():
            result: ExtractedInvoiceData = ocr_service.extract_from_pdf_bytes(doc_bytes)
        else:
            result: ExtractedInvoiceData = ocr_service.extract_from_image_bytes(doc_bytes, mime_type=mime_type)

        extracted_dict = result.model_dump()
        return {
            "extracted_data": extracted_dict,
            "raw_text": extracted_dict.get("raw_text", ""),
        }
    except Exception as e:
        return {
            "errors": state.get("errors", []) + [f"OCR extraction failed: {str(e)}"],
            "extracted_data": {},
        }


def vector_retrieval_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 2: Search Vector Store (FAISS / Pinecone) for historical invoices & vendor pricing context.
    """
    extracted = state.get("extracted_data") or {}
    vendor = extracted.get("vendor_name", "")
    items_desc = " ".join([i.get("description", "") for i in extracted.get("line_items", [])])

    query = f"Vendor: {vendor}. Items: {items_desc}"

    try:
        matches = vector_store_manager.similarity_search(query=query, k=3)
        historical_data = [
            {"content": doc.page_content, "metadata": doc.metadata}
            for doc in matches
            if doc.metadata.get("type") != "baseline"
        ]
        return {"historical_matches": historical_data}
    except Exception as e:
        print(f"[VectorStore] Retrieval warning: {e}")
        return {"historical_matches": []}


def rule_validation_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 3: Deterministic financial rule validations (sum checks, date validations).
    """
    extracted = state.get("extracted_data") or {}
    line_items = extracted.get("line_items", [])
    total_amount = float(extracted.get("total_amount") or 0.0)
    subtotal = float(extracted.get("subtotal") or 0.0)
    tax_amount = float(extracted.get("tax_amount") or 0.0)

    calculated_line_total = sum(float(i.get("total_amount") or 0.0) for i in line_items)
    rule_checks: List[Dict[str, Any]] = []

    # Check 1: Line items sum matches subtotal / total
    math_valid = True
    if line_items and calculated_line_total > 0:
        expected_total = subtotal + tax_amount if subtotal > 0 else calculated_line_total + tax_amount
        diff = abs(total_amount - expected_total)
        if diff > 0.05:  # Tolerance for cents rounding
            math_valid = False
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_MISMATCH",
                "passed": False,
                "detail": f"Calculated items sum ({calculated_line_total:.2f}) + tax does not match total amount ({total_amount:.2f})",
            })
        else:
            rule_checks.append({
                "rule": "LINE_ITEMS_SUM_CHECK",
                "passed": True,
                "detail": "Line items sum matches total amount.",
            })

    # Check 2: Total amount threshold
    if total_amount > 10000.0:
        rule_checks.append({
            "rule": "HIGH_VALUE_INVOICE",
            "passed": False,
            "detail": f"Invoice amount ${total_amount:,.2f} exceeds standard $10,000 threshold requiring senior approval.",
        })

    return {
        "rule_checks": rule_checks,
        "is_math_valid": math_valid,
    }


def anomaly_detection_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 4: AI Anomaly Detection comparing current extraction with historical context and rules.
    """
    extracted = state.get("extracted_data") or {}
    historical = state.get("historical_matches", [])
    rule_checks = state.get("rule_checks", [])

    llm = get_llm(temperature=0.0)

    prompt = (
        "You are an AI Forensic Auditor. Analyze this invoice extraction for anomalies, fraud risks, or policy violations.\n\n"
        f"INVOICE EXTRACTION:\n{json.dumps(extracted, indent=2)}\n\n"
        f"HISTORICAL SIMILAR INVOICES:\n{json.dumps(historical, indent=2)}\n\n"
        f"RULE EVALUATION RESULTS:\n{json.dumps(rule_checks, indent=2)}\n\n"
        "Return a JSON object with two fields:\n"
        "1. 'anomalies': array of objects with 'anomaly_type', 'severity' (LOW/MEDIUM/HIGH/CRITICAL), 'explanation', 'evidence'.\n"
        "2. 'risk_score': float from 0.0 (clean) to 1.0 (severe risk)."
    )

    try:
        response = llm.invoke([
            SystemMessage(content="You are a financial risk AI. Always return valid JSON."),
            HumanMessage(content=prompt),
        ])
        
        # Parse JSON response
        text = response.content
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        parsed = json.loads(text.strip())
        return {
            "anomalies": parsed.get("anomalies", []),
            "risk_score": float(parsed.get("risk_score", 0.0)),
        }
    except Exception as e:
        print(f"[AnomalyNode] LLM anomaly analysis fallback: {e}")
        return {
            "anomalies": [],
            "risk_score": 0.1 if state.get("is_math_valid", True) else 0.7,
        }


def decision_routing_node(state: InvoiceState) -> Dict[str, Any]:
    """
    Node 5: Formulate final approval status, audit summary, and indexing to vector store.
    """
    anomalies = state.get("anomalies", [])
    risk_score = state.get("risk_score", 0.0)
    is_math_valid = state.get("is_math_valid", True)
    extracted = state.get("extracted_data") or {}

    has_critical = any(a.get("severity") in ["CRITICAL", "HIGH"] for a in anomalies)

    if has_critical or not is_math_valid or risk_score >= 0.6:
        status = "FLAGGED"
        summary = f"Flagged for manual audit. Detected {len(anomalies)} anomalies (Risk Score: {risk_score:.2f})."
    elif risk_score >= 0.3:
        status = "PENDING_REVIEW"
        summary = f"Requires manager review. Minor policy alerts detected (Risk Score: {risk_score:.2f})."
    else:
        status = "APPROVED"
        summary = f"Invoice verified successfully with no discrepancies (Risk Score: {risk_score:.2f})."

    # Index approved/processed invoice to Vector Store for future reference
    if extracted.get("vendor_name") and extracted.get("vendor_name") != "UNKNOWN":
        try:
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
        except Exception as e:
            print(f"[VectorStore] Document indexing warning: {e}")

    return {
        "status": status,
        "audit_summary": summary,
    }
