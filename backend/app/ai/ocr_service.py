import base64
import io
import json
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.ai.llm_factory import get_vision_llm, get_llm


def get_currency_symbol(currency: Optional[str]) -> str:
    """
    Returns the appropriate currency symbol for display.
    Defaults to Indian Rupees (₹) if currency is unspecified or INR.
    """
    if not currency:
        return "₹"
    c = currency.strip().upper()
    if c in ["INR", "RS", "RS.", "RUPEE", "RUPEES", "₹"]:
        return "₹"
    if c in ["USD", "$", "DOLLAR"]:
        return "$"
    if c in ["EUR", "€", "EURO"]:
        return "€"
    if c in ["GBP", "£", "POUND"]:
        return "£"
    if c in ["JPY", "¥", "YEN"]:
        return "¥"
    if c in ["AED"]:
        return "AED "
    if c in ["CAD", "CA$"]:
        return "CA$"
    if c in ["AUD", "A$"]:
        return "A$"
    return "₹"


def normalize_currency(raw_currency: Optional[str], raw_text_context: str = "") -> str:
    """
    Normalizes extracted currency to standard ISO code.
    CRITICAL REQUIREMENT: If no currency symbol or code is found, default to 'INR' (Indian Rupees).
    """
    if not raw_currency or str(raw_currency).strip().upper() in ["NONE", "NULL", "UNKNOWN", "", "N/A"]:
        # Inspect raw text context for symbols
        if any(sym in raw_text_context for sym in ["₹", "Rs.", "Rs ", "INR", "Rupees", "Rupee"]):
            return "INR"
        if "$" in raw_text_context or "USD" in raw_text_context:
            return "USD"
        if "€" in raw_text_context or "EUR" in raw_text_context:
            return "EUR"
        if "£" in raw_text_context or "GBP" in raw_text_context:
            return "GBP"
        # DEFAULT TO INDIAN RUPEES (INR)
        return "INR"

    c = str(raw_currency).strip().upper()
    if c in ["₹", "RS", "RS.", "INR", "RUPEE", "RUPEES", "INR (₹)"]:
        return "INR"
    if c in ["$", "USD", "DOLLAR", "US DOLLAR"]:
        return "USD"
    if c in ["€", "EUR", "EURO"]:
        return "EUR"
    if c in ["£", "GBP", "POUND", "POUNDS"]:
        return "GBP"
    if c in ["¥", "JPY", "YEN"]:
        return "JPY"
    if c in ["AED", "DIRHAM"]:
        return "AED"
    if c in ["CAD", "CA$"]:
        return "CAD"
    if c in ["AUD", "A$"]:
        return "AUD"
    return c


from datetime import datetime, date
import dateutil.parser


def normalize_date(raw_date: Optional[str]) -> str:
    """
    Normalizes extracted date string to standard 'YYYY-MM-DD' ISO format.
    """
    if not raw_date or str(raw_date).strip().upper() in ["NONE", "NULL", "UNKNOWN", "", "N/A"]:
        return ""
    d_str = str(raw_date).strip()
    # Try direct parse
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y", "%d %b %Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            d_part = d_str[:10] if len(d_str) >= 10 and ("-" in d_str or "/" in d_str or "." in d_str) else d_str
            return datetime.strptime(d_part, fmt).date().isoformat()
        except Exception:
            continue
    try:
        return dateutil.parser.parse(d_str, fuzzy=True).date().isoformat()
    except Exception:
        return d_str


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
    currency: str = "INR"  # Default to Indian Rupees
    subtotal: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    payment_terms: Optional[str] = None
    line_items: List[ExtractedLineItem] = Field(default_factory=list)
    raw_text: Optional[str] = ""
    notes: Optional[str] = None


from typing import Tuple


def create_dual_ocr_views(image_bytes: bytes) -> Tuple[bytes, bytes]:
    """
    Creates two complementary visual representations for Gemini Vision:
    - View 1 (Color Enhanced): Preserves logos, colored badges, and stamps.
    - View 2 (High-Contrast Monochrome): De-noises, sharpens character strokes, and eliminates shadows.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img) or img
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        w, h = img.size
        min_dim = min(w, h)
        if min_dim < 1300:
            scale_factor = max(1.6, 1600.0 / max(1, min_dim))
            new_w = int(w * scale_factor)
            new_h = int(h * scale_factor)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # -------------------------------------------------------------
        # View 1: Color Enhanced & Sharpened
        # -------------------------------------------------------------
        color_img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
        color_img = ImageEnhance.Contrast(color_img).enhance(1.4)
        color_img = ImageEnhance.Sharpness(color_img).enhance(1.6)
        color_img = ImageOps.autocontrast(color_img, cutoff=1)
        
        c_io = io.BytesIO()
        color_img.save(c_io, format="JPEG", quality=95, optimize=True)
        color_bytes = c_io.getvalue()

        # -------------------------------------------------------------
        # View 2: High-Contrast Monochromatic Edge View (For blurry text)
        # -------------------------------------------------------------
        gray_img = ImageOps.grayscale(img)
        gray_img = ImageOps.autocontrast(gray_img, cutoff=2)
        gray_img = gray_img.filter(ImageFilter.UnsharpMask(radius=3, percent=220, threshold=1))
        gray_img = ImageEnhance.Contrast(gray_img).enhance(1.8)
        gray_img = ImageEnhance.Sharpness(gray_img).enhance(2.0)
        
        g_io = io.BytesIO()
        gray_img.save(g_io, format="JPEG", quality=95, optimize=True)
        mono_bytes = g_io.getvalue()

        return color_bytes, mono_bytes
    except Exception as e:
        print(f"  [OCRService] Dual-view creation fallback: {e}")
        return image_bytes, image_bytes


class OCRService:
    """
    OCR & Document Parsing Service using Multimodal LLMs (Gemini / Ollama Vision).
    Extracts one or multiple distinct invoices from a single uploaded document.
    Supports Dual-View visual fusion and automatic Pro model escalation for blurry images.
    """

    def __init__(self):
        self._vision_llm = None
        self._pro_vision_llm = None

    @property
    def vision_llm(self):
        if self._vision_llm is None:
            self._vision_llm = get_vision_llm(temperature=0.0)
        return self._vision_llm

    @property
    def pro_vision_llm(self):
        """High-reasoning Pro model fallback for blurry or degraded receipts."""
        if self._pro_vision_llm is None:
            try:
                # Try gemini-2.5-pro or gemini-1.5-pro
                pro_model = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")
                self._pro_vision_llm = get_vision_llm(model=pro_model, temperature=0.0)
            except Exception:
                self._pro_vision_llm = self.vision_llm
        return self._pro_vision_llm

    def _parse_multi_json_fallback(self, raw_text: str) -> List[ExtractedInvoiceData]:
        """
        Parses JSON response which can be either a list of invoices or an object containing an 'invoices' array.
        """
        try:
            cleaned = raw_text.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]

            data = json.loads(cleaned.strip())

            invoices_list = []
            if isinstance(data, list):
                invoices_list = data
            elif isinstance(data, dict):
                if "invoices" in data and isinstance(data["invoices"], list):
                    invoices_list = data["invoices"]
                else:
                    # Single invoice object
                    invoices_list = [data]

            results: List[ExtractedInvoiceData] = []
            for item in invoices_list:
                # Ensure currency normalization
                raw_curr = item.get("currency")
                norm_curr = normalize_currency(raw_curr, raw_text_context=raw_text)
                item["currency"] = norm_curr

                # Ensure date normalization
                item["invoice_date"] = normalize_date(item.get("invoice_date"))
                if item.get("due_date"):
                    item["due_date"] = normalize_date(item.get("due_date"))

                inv = ExtractedInvoiceData(**item)
                inv.currency = norm_curr
                results.append(inv)

            if results:
                return results

            # Fallback if empty array parsed
            return [ExtractedInvoiceData(invoice_number="INV-EMPTY", vendor_name="Unknown", currency="INR", raw_text=raw_text)]
        except Exception as e:
            print(f"  [OCRService] Multi-JSON parsing fallback warning: {e}")
            return [
                ExtractedInvoiceData(
                    invoice_number="INV-PARSE-ERR",
                    vendor_name="Unidentified Vendor",
                    currency="INR",
                    raw_text=raw_text,
                )
            ]

    def extract_all_invoices_from_image_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
    ) -> List[ExtractedInvoiceData]:
        """
        Extracts ALL invoices from an image file using Dual-View visual fusion (Color + High-Contrast Monochrome)
        and automatic Gemini Pro escalation for blurry receipts.
        """
        print(f"  [OCRService] Processing invoice image ({len(image_bytes)} bytes) with Dual-View fusion...")
        
        color_bytes, mono_bytes = create_dual_ocr_views(image_bytes)
        
        color_b64 = base64.b64encode(color_bytes).decode("utf-8")
        mono_b64 = base64.b64encode(mono_bytes).decode("utf-8")

        prompt = (
            "You are an expert forensic financial OCR vision system.\n"
            "You are provided with TWO complementary views of the same document:\n"
            "- View 1: Color Enhanced View (use for logos, colored headers, and stamps)\n"
            "- View 2: High-Contrast Monochromatic Edge View (use for reading blurry, faded, or low-contrast text and numbers)\n\n"
            "DEGRADED / BLURRY RECEIPT EXTRACTION INSTRUCTIONS:\n"
            "1. Cross-reference both views to transcribe obscured letters, dates, and numbers.\n"
            "2. Use mathematical consistency (e.g. quantity * unit_price = line_total; subtotal + tax = total_amount) to verify blurry numbers.\n"
            "3. If an invoice number or date is slightly blurry, use surrounding context, headers, and address lines rather than returning 'UNKNOWN'.\n"
            "4. DEFAULT CURRENCY: If no currency symbol or code is present, default to 'INR' (Indian Rupees).\n"
            "5. Extract verbatim 'invoice_number' and 'vendor_name' for each invoice.\n"
            "6. Format 'invoice_date' strictly as 'YYYY-MM-DD'.\n"
            "7. Extract numeric floats for 'total_amount', 'subtotal', and 'tax_amount'.\n"
            "8. Itemize all 'line_items' (description, quantity, unit_price, total_amount, category).\n\n"
            "Output MUST be valid JSON adhering strictly to this schema:\n"
            "{\n"
            '  "invoices": [\n'
            "    {\n"
            '      "invoice_number": "string",\n'
            '      "vendor_name": "string",\n'
            '      "invoice_date": "YYYY-MM-DD",\n'
            '      "currency": "INR",\n'
            '      "subtotal": 0.00,\n'
            '      "tax_amount": 0.00,\n'
            '      "total_amount": 0.00,\n'
            '      "payment_terms": "string or null",\n'
            '      "line_items": [\n'
            '        {"description": "string", "quantity": 1.0, "unit_price": 0.00, "total_amount": 0.00, "category": "string"}\n'
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "Return ONLY the valid JSON object."
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{color_b64}"},
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{mono_b64}"},
                },
            ]
        )

        try:
            print("  [OCRService] Invoking Vision LLM with Dual-View fusion at temperature=0.0...")
            response = self.vision_llm.invoke([message])
            content = response.content if hasattr(response, "content") else str(response)
            invoices = self._parse_multi_json_fallback(content)

            # Smart Fallback: If Flash failed on blurry image, escalate to Gemini Pro
            needs_fallback = any(
                inv.invoice_number in ["INV-EMPTY", "INV-PARSE-ERR", "UNKNOWN"]
                or (inv.total_amount == 0.0 and len(inv.line_items) == 0)
                for inv in invoices
            )
            if needs_fallback:
                print("  [OCRService] ⚠️ Flash OCR yielded low confidence on blurry image. Escalating to Gemini Pro vision reasoning...")
                try:
                    pro_response = self.pro_vision_llm.invoke([message])
                    pro_content = pro_response.content if hasattr(pro_response, "content") else str(pro_response)
                    pro_invoices = self._parse_multi_json_fallback(pro_content)
                    if pro_invoices and pro_invoices[0].invoice_number not in ["INV-EMPTY", "INV-PARSE-ERR"]:
                        invoices = pro_invoices
                        content = pro_content
                        print("  [OCRService] ✅ Gemini Pro successfully resolved blurry invoice extraction!")
                except Exception as pro_err:
                    print(f"  [OCRService] Gemini Pro fallback notice: {pro_err}")

            for idx, inv in enumerate(invoices, 1):
                inv.raw_text = content
                sym = get_currency_symbol(inv.currency)
                print(f"  [OCRService] Extracted Invoice {idx}/{len(invoices)}: Inv#='{inv.invoice_number}', Vendor='{inv.vendor_name}', Total={sym}{inv.total_amount:,.2f} ({inv.currency})")

            return invoices
        except Exception as e:
            print(f"  [OCRService] Vision LLM extraction error: {e}")
            return [
                ExtractedInvoiceData(
                    invoice_number="INV-ERR",
                    vendor_name="Unknown Vendor",
                    currency="INR",
                    raw_text=f"Extraction failed: {str(e)}",
                )
            ]

    def extract_all_invoices_from_pdf_bytes(self, pdf_bytes: bytes) -> List[ExtractedInvoiceData]:
        """
        Extracts ALL invoices from a PDF file (supporting multi-page PDFs with 1, 2, 3+ invoices).
        """
        print(f"  [OCRService] Parsing PDF document ({len(pdf_bytes)} bytes)...")
        pages_text: List[str] = []
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for idx, page in enumerate(pdf.pages[: settings.MAX_DOCUMENT_PAGES]):
                    page_txt = page.extract_text() or ""
                    if page_txt.strip():
                        pages_text.append(f"--- PAGE {idx+1} ---\n{page_txt}")
        except Exception as e:
            print(f"  [OCRService] pdfplumber error: {e}")

        extracted_text = "\n\n".join(pages_text) if pages_text else "Scanned PDF document without text layer."

        prompt = (
            "You are a strict financial OCR data extraction engine.\n"
            "Examine this PDF document text carefully. Note that this file may contain ONE single invoice or "
            "MULTIPLE (2 to 3 or more) distinct invoices/receipts spanning different pages or sections.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. IDENTIFY ALL INVOICES: If the document contains multiple distinct invoices (e.g. from different vendors or different invoice numbers), "
            "extract EACH one as a separate object in the 'invoices' array.\n"
            "2. CURRENCY HANDLING:\n"
            "   - Extract currency code: 'INR', 'USD', 'EUR', 'GBP', etc.\n"
            "   - Map symbols: '₹' or 'Rs' -> 'INR', '$' -> 'USD', '€' -> 'EUR', '£' -> 'GBP'.\n"
            "   - IF NO CURRENCY SYMBOL OR CODE IS FOUND ON THE INVOICE, YOU MUST DEFAULT TO 'INR' (Indian Rupees).\n"
            "3. Extract verbatim 'invoice_number' and 'vendor_name' for each invoice.\n"
            "4. Format 'invoice_date' as 'YYYY-MM-DD'.\n"
            "5. Extract numeric floats for 'total_amount', 'subtotal', and 'tax_amount'.\n"
            "6. Itemize all 'line_items' (description, quantity, unit_price, total_amount, category).\n\n"
            f"DOCUMENT CONTENT:\n```\n{extracted_text}\n```\n\n"
            "Output MUST be a valid JSON object adhering to this schema:\n"
            "{\n"
            '  "invoices": [\n'
            "    {\n"
            '      "invoice_number": "string",\n'
            '      "vendor_name": "string",\n'
            '      "invoice_date": "YYYY-MM-DD",\n'
            '      "currency": "INR",\n'
            '      "subtotal": 0.00,\n'
            '      "tax_amount": 0.00,\n'
            '      "total_amount": 0.00,\n'
            '      "payment_terms": "string or null",\n'
            '      "line_items": [\n'
            '        {"description": "string", "quantity": 1.0, "unit_price": 0.00, "total_amount": 0.00, "category": "string"}\n'
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "Return ONLY the valid JSON object."
        )

        try:
            print("  [OCRService] Invoking LLM parser for multi-invoice PDF at temperature=0.0...")
            base_llm = get_llm(temperature=0.0)
            response = base_llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            invoices = self._parse_multi_json_fallback(content)

            for idx, inv in enumerate(invoices, 1):
                inv.raw_text = extracted_text
                sym = get_currency_symbol(inv.currency)
                print(f"  [OCRService] Extracted Invoice {idx}/{len(invoices)} from PDF: Inv#='{inv.invoice_number}', Vendor='{inv.vendor_name}', Total={sym}{inv.total_amount:,.2f} ({inv.currency})")

            return invoices
        except Exception as e:
            print(f"  [OCRService] PDF text extraction error: {e}")
            return [
                ExtractedInvoiceData(
                    invoice_number="INV-PDF-ERR",
                    vendor_name="PDF Vendor",
                    currency="INR",
                    raw_text=extracted_text,
                )
            ]

    def extract_all_invoices(
        self,
        document_bytes: bytes,
        file_name: str,
        mime_type: str = "application/pdf",
    ) -> List[ExtractedInvoiceData]:
        """
        Universal multi-invoice extractor supporting both PDF and image formats.
        """
        if "pdf" in mime_type.lower() or file_name.lower().endswith(".pdf"):
            return self.extract_all_invoices_from_pdf_bytes(document_bytes)
        return self.extract_all_invoices_from_image_bytes(document_bytes, mime_type=mime_type)

    def extract_from_image_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
    ) -> ExtractedInvoiceData:
        """Backward-compatible single-invoice extraction."""
        invoices = self.extract_all_invoices_from_image_bytes(image_bytes, mime_type=mime_type)
        return invoices[0] if invoices else ExtractedInvoiceData(currency="INR")

    def extract_from_pdf_bytes(self, pdf_bytes: bytes) -> ExtractedInvoiceData:
        """Backward-compatible single-invoice extraction."""
        invoices = self.extract_all_invoices_from_pdf_bytes(pdf_bytes)
        return invoices[0] if invoices else ExtractedInvoiceData(currency="INR")


ocr_service = OCRService()
