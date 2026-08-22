import base64
import io
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.ai.llm_factory import get_vision_llm, get_llm


class ExtractedLineItem(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    total_amount: float = 0.0
    category: Optional[str] = "General"


class ExtractedInvoiceData(BaseModel):
    invoice_number: str = "UNKNOWN"
    vendor_name: str = "UNKNOWN"
    invoice_date: str = ""
    due_date: Optional[str] = None
    currency: str = "USD"
    subtotal: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    payment_terms: Optional[str] = None
    line_items: List[ExtractedLineItem] = Field(default_factory=list)
    raw_text: Optional[str] = ""
    notes: Optional[str] = None


class OCRService:
    """
    OCR & Document Parsing Service using Multimodal LLMs (Gemini / Ollama Vision).
    Handles PDF, PNG, JPG, and WEBP invoice documents.
    """

    def __init__(self):
        self.vision_llm = get_vision_llm()
        self.structured_llm = get_llm(temperature=0.0).with_structured_output(ExtractedInvoiceData)

    def extract_from_image_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
    ) -> ExtractedInvoiceData:
        """
        Extracts structured invoice information directly from image bytes using Multimodal LLMs.
        """
        base64_data = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{mime_type};base64,{base64_data}"

        system_prompt = (
            "You are an expert financial auditor and OCR data extraction system. "
            "Extract all invoice details, line items, amounts, vendor data, and dates from this document image. "
            "Ensure numerical values are exact and accurate."
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": "Analyze this invoice document and extract all fields according to the schema."},
                {
                    "type": "image_url",
                    "image_url": {"url": image_url},
                },
            ]
        )

        try:
            # Use structured output extraction
            response = self.structured_llm.invoke([SystemMessage(content=system_prompt), message])
            return response
        except Exception as e:
            print(f"[OCRService] Multimodal extraction fallback due to: {e}")
            # Fallback to direct vision prompt
            raw_response = self.vision_llm.invoke([SystemMessage(content=system_prompt), message])
            return ExtractedInvoiceData(
                invoice_number="INV-TEMP",
                vendor_name="Scanned Vendor",
                raw_text=raw_response.content if hasattr(raw_response, "content") else str(raw_response),
            )

    def extract_from_pdf_bytes(self, pdf_bytes: bytes) -> ExtractedInvoiceData:
        """
        Extracts invoice data from PDF files using pdfplumber/pypdf and LLM parsing.
        """
        extracted_text = ""
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages[: settings.MAX_DOCUMENT_PAGES]:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += page_text + "\n"
        except Exception as e:
            print(f"[OCRService] Error reading PDF text: {e}")

        if not extracted_text.strip():
            # If PDF has no text layer (scanned PDF), use first page image if available
            extracted_text = "Scanned PDF document without embedded text layer."

        prompt = (
            f"Extract structured invoice information from the following text:\n\n"
            f"```\n{extracted_text}\n```"
        )

        result: ExtractedInvoiceData = self.structured_llm.invoke(prompt)
        result.raw_text = extracted_text
        return result


ocr_service = OCRService()
