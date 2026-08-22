import base64
import io
import json
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.ai.llm_factory import get_vision_llm, get_llm


class ExtractedLineItem(BaseModel):
    description: str = "Item"
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
    Extracts verbatim numerical facts, dates, vendor names, and itemized rows.
    """

    def __init__(self):
        self._vision_llm = None
        self._structured_llm = None

    @property
    def vision_llm(self):
        if self._vision_llm is None:
            self._vision_llm = get_vision_llm(temperature=0.0)
        return self._vision_llm

    @property
    def structured_llm(self):
        if self._structured_llm is None:
            base_llm = get_llm(temperature=0.0)
            try:
                self._structured_llm = base_llm.with_structured_output(ExtractedInvoiceData)
            except Exception:
                self._structured_llm = base_llm
        return self._structured_llm

    def _parse_json_fallback(self, raw_text: str) -> ExtractedInvoiceData:
        """Helper to extract and parse JSON from raw LLM text responses."""
        try:
            cleaned = raw_text.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]

            data = json.loads(cleaned.strip())
            return ExtractedInvoiceData(**data)
        except Exception as e:
            print(f"  [OCRService] JSON parsing fallback warning: {e}")
            return ExtractedInvoiceData(
                invoice_number="INV-PARSE-ERR",
                vendor_name="Unidentified Vendor",
                raw_text=raw_text,
            )

    def extract_from_image_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
    ) -> ExtractedInvoiceData:
        """
        Extracts structured invoice information directly from image bytes using Multimodal LLMs.
        """
        print(f"  [OCRService] Processing invoice image ({len(image_bytes)} bytes)...")
        base64_data = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{mime_type};base64,{base64_data}"

        prompt = (
            "You are a strict financial OCR data extraction engine. "
            "Examine this invoice/receipt image carefully and extract all text and numbers exactly as printed.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Extract the exact 'invoice_number' (e.g. INV-1002, #44891). If none printed, output 'UNKNOWN'.\n"
            "2. Extract the exact 'vendor_name' (e.g. 'Apex Global Supplies Inc').\n"
            "3. Format 'invoice_date' strictly as 'YYYY-MM-DD' (e.g. '2026-08-20').\n"
            "4. Extract 'currency' (e.g. 'USD', 'EUR', 'INR', 'GBP'). Default to 'USD' if ambiguous.\n"
            "5. Extract numeric floats for 'total_amount', 'subtotal', and 'tax_amount'. Do NOT include currency symbols in numbers.\n"
            "6. Itemize every single line item into the 'line_items' array with: 'description', 'quantity' (float), 'unit_price' (float), 'total_amount' (float), and 'category'.\n\n"
            "Output MUST be valid JSON adhering to this schema:\n"
            "{\n"
            '  "invoice_number": "string",\n'
            '  "vendor_name": "string",\n'
            '  "invoice_date": "YYYY-MM-DD",\n'
            '  "currency": "USD",\n'
            '  "subtotal": 0.00,\n'
            '  "tax_amount": 0.00,\n'
            '  "total_amount": 0.00,\n'
            '  "payment_terms": "string or null",\n'
            '  "line_items": [\n'
            '    {"description": "string", "quantity": 1.0, "unit_price": 0.00, "total_amount": 0.00, "category": "string"}\n'
            "  ]\n"
            "}\n"
            "Return ONLY the JSON object."
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": image_url},
                },
            ]
        )

        try:
            print("  [OCRService] Invoking Vision LLM at temperature=0.0...")
            response = self.vision_llm.invoke([message])
            content = response.content if hasattr(response, "content") else str(response)
            result = self._parse_json_fallback(content)
            result.raw_text = content
            print(f"  [OCRService] Verbatim Extraction: Inv#='{result.invoice_number}', Vendor='{result.vendor_name}', Total=${result.total_amount:,.2f}")
            return result
        except Exception as e:
            print(f"  [OCRService] Vision LLM extraction error: {e}")
            return ExtractedInvoiceData(
                invoice_number="INV-ERR",
                vendor_name="Unknown Vendor",
                raw_text=f"Extraction failed: {str(e)}",
            )

    def extract_from_pdf_bytes(self, pdf_bytes: bytes) -> ExtractedInvoiceData:
        """
        Extracts invoice data from PDF files using pdfplumber and structured LLM parsing.
        """
        print(f"  [OCRService] Parsing PDF text ({len(pdf_bytes)} bytes)...")
        extracted_text = ""
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages[: settings.MAX_DOCUMENT_PAGES]:
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += page_text + "\n"
        except Exception as e:
            print(f"  [OCRService] pdfplumber error: {e}")

        if not extracted_text.strip():
            extracted_text = "Scanned PDF document without text layer."

        prompt = (
            "You are a strict financial OCR data extraction engine. "
            "Extract structured invoice fields verbatim from the document text below:\n\n"
            f"```\n{extracted_text}\n```\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Extract 'invoice_number', 'vendor_name', 'invoice_date' (YYYY-MM-DD), 'currency'.\n"
            "2. Extract numeric floats for 'total_amount', 'subtotal', and 'tax_amount'.\n"
            "3. Itemize all 'line_items' (description, quantity, unit_price, total_amount, category).\n"
            "Return ONLY a valid JSON object."
        )

        try:
            print("  [OCRService] Invoking LLM parser at temperature=0.0...")
            base_llm = get_llm(temperature=0.0)
            response = base_llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            result = self._parse_json_fallback(content)
            result.raw_text = extracted_text
            print(f"  [OCRService] PDF Parsed: Inv#='{result.invoice_number}', Vendor='{result.vendor_name}', Total=${result.total_amount:,.2f}")
            return result
        except Exception as e:
            print(f"  [OCRService] PDF text extraction error: {e}")
            return ExtractedInvoiceData(
                invoice_number="INV-PDF-ERR",
                vendor_name="PDF Vendor",
                raw_text=extracted_text,
            )


ocr_service = OCRService()
