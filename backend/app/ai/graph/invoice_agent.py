"""
==============================================================================
Agentic AI Invoice & Expense Anomaly Detection System
Framework: LangGraph (StateGraph, START, END)
==============================================================================
"""

import logging
import operator
from typing import Annotated, Any, Dict, List, Optional, TypedDict
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END

# ----------------------------------------------------------------------------
# 1. Standard Logging Setup
# ----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("InvoiceAnomalyAgent")


# ----------------------------------------------------------------------------
# 2. Pydantic Models & State Definition
# ----------------------------------------------------------------------------
class AnomalyFinding(BaseModel):
    """Represents an anomaly or rule violation detected during audit."""
    anomaly_type: str = Field(description="Category e.g. POLICY_VIOLATION, DUPLICATE_INVOICE, PRICE_OUTLIER")
    severity: str = Field(description="Severity level: LOW, MEDIUM, HIGH, CRITICAL")
    explanation: str = Field(description="Detailed explanation of the flag")
    evidence: Optional[str] = Field(default=None, description="Supporting context or numerical proof")


class InvoiceExtraction(BaseModel):
    """Structured extraction of raw invoice fields from OCR / Vision LLM."""
    invoice_number: str = "INV-UNKNOWN"
    vendor_name: str = "UNKNOWN"
    invoice_date: str = ""
    total_amount: float = 0.0
    currency: str = "USD"
    category: Optional[str] = "General"
    line_items: List[Dict[str, Any]] = Field(default_factory=list)


class InvoiceAgentState(TypedDict):
    """
    LangGraph Agent State.
    Uses operator.add reducer to safely merge parallel branch results.
    """
    document_url: str
    raw_extraction: Optional[InvoiceExtraction]
    policy_flags: Annotated[List[AnomalyFinding], operator.add]
    duplicate_flags: Annotated[List[AnomalyFinding], operator.add]
    statistical_flags: Annotated[List[AnomalyFinding], operator.add]
    is_anomalous: bool


# ----------------------------------------------------------------------------
# 3. Agent Nodes (The Processing Steps)
# ----------------------------------------------------------------------------
def extract_invoice(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node A: Simulates calling a Vision-Language Model (e.g. Gemini 2.5 Flash / Ollama Vision)
    to parse the invoice document at `document_url` into structured fields.
    """
    doc_url = state.get("document_url", "")
    logger.info(f"[extract_invoice] Ingesting document from: {doc_url}")

    # --- Vision LLM Extraction Logic (Simulated / Integration Hook) ---
    extracted_data = InvoiceExtraction(
        invoice_number="INV-2026-8891",
        vendor_name="Acme Tech Supplies",
        invoice_date="2026-08-20",
        total_amount=4850.00,
        currency="USD",
        category="Software & Hardware",
        line_items=[
            {"description": "Enterprise Cloud Server", "quantity": 2, "unit_price": 2000.00, "total_amount": 4000.00},
            {"description": "Premium Support Add-on", "quantity": 1, "unit_price": 850.00, "total_amount": 850.00},
        ],
    )
    logger.info(f"[extract_invoice] Extracted {extracted_data.invoice_number} from {extracted_data.vendor_name} for ${extracted_data.total_amount:,.2f}")

    return {
        "raw_extraction": extracted_data,
        "policy_flags": [],
        "duplicate_flags": [],
        "statistical_flags": [],
    }


def check_policy(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node B (Parallel): Simulates checking extracted invoice against corporate compliance
    and RAG policy vector stores.
    """
    extraction = state.get("raw_extraction")
    logger.info("[check_policy] Checking corporate expense policies and threshold limits...")

    flags: List[AnomalyFinding] = []
    if extraction:
        # Example Policy Rule: Unapproved single-item expense over $3,500 without procurement approval
        if extraction.total_amount > 3500.00:
            flags.append(
                AnomalyFinding(
                    anomaly_type="POLICY_VIOLATION",
                    severity="HIGH",
                    explanation=f"Invoice total (${extraction.total_amount:,.2f}) exceeds department manager direct sign-off threshold of $3,500.00.",
                    evidence=f"Total: ${extraction.total_amount:,.2f} | Policy: Section 4.2 Capital Expenditure Limit",
                )
            )

    logger.info(f"[check_policy] Found {len(flags)} policy flag(s).")
    return {"policy_flags": flags}


def check_duplicates(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node C (Parallel): Simulates querying Vector DB (FAISS/Pinecone) & SQL database for
    duplicate invoice numbers, identical amounts, or overlapping dates.
    """
    extraction = state.get("raw_extraction")
    logger.info("[check_duplicates] Checking vector database and ledger for duplicate invoices...")

    flags: List[AnomalyFinding] = []
    if extraction:
        # Example Duplicate Check Simulation:
        # Querying FAISS / Pinecone for exact vendor + amount match in last 30 days
        is_potential_duplicate = False  # Set to True when duplicate match is detected
        if is_potential_duplicate:
            flags.append(
                AnomalyFinding(
                    anomaly_type="DUPLICATE_INVOICE",
                    severity="CRITICAL",
                    explanation=f"Duplicate invoice detected: matching vendor '{extraction.vendor_name}' and amount ${extraction.total_amount:,.2f} found in recent ledger.",
                    evidence="Reference past invoice #INV-2026-8870 submitted on 2026-08-15.",
                )
            )

    logger.info(f"[check_duplicates] Found {len(flags)} duplicate flag(s).")
    return {"duplicate_flags": flags}


def check_statistics(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node D (Parallel): Simulates statistical outlier detection (e.g. Z-score price spike,
    unusual vendor billing deviation compared to historical baseline).
    """
    extraction = state.get("raw_extraction")
    logger.info("[check_statistics] Performing statistical outlier analysis on pricing & line items...")

    flags: List[AnomalyFinding] = []
    if extraction:
        # Example Statistical Rule: Unit price deviation test against vendor benchmark
        for item in extraction.line_items:
            unit_price = item.get("unit_price", 0.0)
            if unit_price > 1800.00:
                flags.append(
                    AnomalyFinding(
                        anomaly_type="PRICE_OUTLIER",
                        severity="MEDIUM",
                        explanation=f"Line item '{item.get('description')}' price (${unit_price:,.2f}) is 38% higher than median industry benchmark.",
                        evidence=f"Observed Unit Price: ${unit_price:,.2f} vs Historical Median: $1,450.00",
                    )
                )

    logger.info(f"[check_statistics] Found {len(flags)} statistical flag(s).")
    return {"statistical_flags": flags}


def compile_report(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node E: Converges parallel results, aggregates all detected flags, and determines
    whether human auditor intervention is required (`is_anomalous`).
    """
    policy_flags = state.get("policy_flags", [])
    duplicate_flags = state.get("duplicate_flags", [])
    statistical_flags = state.get("statistical_flags", [])

    all_flags = policy_flags + duplicate_flags + statistical_flags
    is_anomalous = len(all_flags) > 0

    logger.info(
        f"[compile_report] Total flags: {len(all_flags)} "
        f"(Policy: {len(policy_flags)}, Duplicates: {len(duplicate_flags)}, Statistical: {len(statistical_flags)}). "
        f"is_anomalous={is_anomalous}"
    )

    return {"is_anomalous": is_anomalous}


def human_review(state: InvoiceAgentState) -> Dict[str, Any]:
    """
    Node F: Triggered when `is_anomalous == True`. Prepares audit packet for human review.
    """
    extraction = state.get("raw_extraction")
    total_flags = (
        len(state.get("policy_flags", []))
        + len(state.get("duplicate_flags", []))
        + len(state.get("statistical_flags", []))
    )
    logger.warning(
        f"[human_review] ROUTED TO AUDITOR: Invoice {extraction.invoice_number if extraction else 'N/A'} "
        f"requires manual verification due to {total_flags} detected anomaly flag(s)."
    )
    return {}


# ----------------------------------------------------------------------------
# 4. StateGraph Assembly & Conditional Routing
# ----------------------------------------------------------------------------
def route_after_report(state: InvoiceAgentState) -> str:
    """
    Conditional routing logic:
    - If is_anomalous == True  -> Route to human_review
    - If is_anomalous == False -> Route to END (Auto-approve)
    """
    if state.get("is_anomalous", False):
        logger.info("[Routing] -> Condition met: Anomalies detected -> Routing to 'human_review'")
        return "human_review"
    logger.info("[Routing] -> Clean invoice -> Auto-approved -> Routing to END")
    return END


def build_invoice_agent_graph() -> Any:
    """
    Constructs and compiles the parallel LangGraph workflow.
    """
    workflow = StateGraph(InvoiceAgentState)

    # 1. Register Nodes
    workflow.add_node("extract_invoice", extract_invoice)
    workflow.add_node("check_policy", check_policy)
    workflow.add_node("check_duplicates", check_duplicates)
    workflow.add_node("check_statistics", check_statistics)
    workflow.add_node("compile_report", compile_report)
    workflow.add_node("human_review", human_review)

    # 2. Control Flow: START -> extract_invoice
    workflow.add_edge(START, "extract_invoice")

    # 3. Branch extract_invoice into parallel evaluation nodes
    workflow.add_edge("extract_invoice", "check_policy")
    workflow.add_edge("extract_invoice", "check_duplicates")
    workflow.add_edge("extract_invoice", "check_statistics")

    # 4. Converge parallel nodes into compile_report
    workflow.add_edge("check_policy", "compile_report")
    workflow.add_edge("check_duplicates", "compile_report")
    workflow.add_edge("check_statistics", "compile_report")

    # 5. Conditional Edge: compile_report -> human_review or END
    workflow.add_conditional_edges(
        "compile_report",
        route_after_report,
        {
            "human_review": "human_review",
            END: END,
        },
    )

    # 6. Route human_review to END after queuing for review
    workflow.add_edge("human_review", END)

    # 7. Compile Graph
    return workflow.compile()


# Compiled Application Singleton
app = build_invoice_agent_graph()


# ----------------------------------------------------------------------------
# 5. Example Invocation
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("=== Starting Invoice Anomaly Detection Pipeline ===")

    sample_initial_state: InvoiceAgentState = {
        "document_url": "https://storage.example.com/invoices/2026/sample-invoice-001.pdf",
        "raw_extraction": None,
        "policy_flags": [],
        "duplicate_flags": [],
        "statistical_flags": [],
        "is_anomalous": False,
    }

    # Execute LangGraph Pipeline
    final_output = app.invoke(sample_initial_state)

    logger.info("=== Pipeline Execution Complete ===")
    logger.info(f"Final Status: {'Flagged for Human Review' if final_output['is_anomalous'] else 'Auto-Approved'}")
    logger.info(f"Extracted Invoice: {final_output['raw_extraction']}")
    logger.info(f"Policy Flags ({len(final_output['policy_flags'])}): {final_output['policy_flags']}")
    logger.info(f"Duplicate Flags ({len(final_output['duplicate_flags'])}): {final_output['duplicate_flags']}")
    logger.info(f"Statistical Flags ({len(final_output['statistical_flags'])}): {final_output['statistical_flags']}")
