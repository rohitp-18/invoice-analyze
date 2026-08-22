from typing import Optional, Dict, Any
from langgraph.graph import StateGraph, START, END
from app.ai.graph.state import InvoiceState
from app.ai.graph.nodes import (
    ocr_extraction_node,
    vector_retrieval_node,
    rule_validation_node,
    anomaly_detection_node,
    decision_routing_node,
)


def build_invoice_validation_graph():
    """
    Constructs and compiles the end-to-end LangGraph state graph.
    """
    builder = StateGraph(InvoiceState)

    # 1. Add Processing Nodes
    builder.add_node("ocr_extraction", ocr_extraction_node)
    builder.add_node("vector_retrieval", vector_retrieval_node)
    builder.add_node("rule_validation", rule_validation_node)
    builder.add_node("anomaly_detection", anomaly_detection_node)
    builder.add_node("decision_routing", decision_routing_node)

    # 2. Add Sequential & Conditional Edges
    builder.add_edge(START, "ocr_extraction")
    builder.add_edge("ocr_extraction", "vector_retrieval")
    builder.add_edge("vector_retrieval", "rule_validation")
    builder.add_edge("rule_validation", "anomaly_detection")
    builder.add_edge("anomaly_detection", "decision_routing")
    builder.add_edge("decision_routing", END)

    # 3. Compile Graph
    return builder.compile()


# Compiled LangGraph Workflow Singleton
invoice_validation_graph = build_invoice_validation_graph()


def process_invoice_workflow(
    document_bytes: bytes,
    file_name: str,
    mime_type: str,
    user_id: Optional[str] = None,
) -> InvoiceState:
    """
    High-level execution helper to run a document through the LangGraph invoice pipeline.
    """
    initial_state: InvoiceState = {
        "document_bytes": document_bytes,
        "file_name": file_name,
        "mime_type": mime_type,
        "user_id": user_id,
        "historical_matches": [],
        "rule_checks": [],
        "anomalies": [],
        "errors": [],
    }

    final_state = invoice_validation_graph.invoke(initial_state)
    return final_state
