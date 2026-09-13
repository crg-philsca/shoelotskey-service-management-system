"""
Gemini-based OCR extraction for Shoelotskey historical job order forms.
Preserves raw OCR JSON separately from structured field mapping.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

OCR_VERSION = "gemini-vision-v1"
SUPPORTED_IMAGE_EXT = {".jpeg", ".jpg", ".png"}
SUPPORTED_EXT = SUPPORTED_IMAGE_EXT | {".pdf"}

# Interactive Re-OCR cancel tokens (job_key → True when cancel requested).
_ocr_cancel_flags: Dict[str, bool] = {}


def request_ocr_cancel(job_key: str) -> None:
    if job_key:
        _ocr_cancel_flags[str(job_key)] = True


def clear_ocr_cancel(job_key: str) -> None:
    _ocr_cancel_flags.pop(str(job_key), None)


def is_ocr_cancelled(job_key: Optional[str]) -> bool:
    if not job_key:
        return False
    return bool(_ocr_cancel_flags.get(str(job_key)))


class OcrCancelled(Exception):
    """Raised when an interactive OCR job is cancelled by the reviewer."""

EXTRACTION_PROMPT = """You are extracting data from a Shoelotskey shoe service job order form image.
Return ONLY valid JSON (no markdown) with this exact structure:
{
  "order_id": string|null,
  "branch": string|null,
  "date_received": "YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD"|null,
  "original_estimated_release_date": "YYYY-MM-DD"|null,
  "claimed_date": "YYYY-MM-DD"|null,
  "customer_name": string|null,
  "contact_number": string|null,
  "staff_attendant": string|null,
  "priority": "regular"|"rush"|"premium"|null,
  "total_pairs": number|null,
  "grand_total": number|null,
  "original_grand_total": number|null,
  "downpayment": number|null,
  "balance": number|null,
  "discount": number|null,
  "other_charges": number|null,
  "payment_method": string|null,
  "gcash_reference": string|null,
  "pickup_delivery": string|null,
  "address": string|null,
  "courier": string|null,
  "delivery_notes": string|null,
  "special_instructions": string|null,
  "confidence_score": number between 0 and 1,
  "raw_text_summary": string,
  "items": [
    {
      "brand": string|null,
      "model": string|null,
      "color": string|null,
      "size": string|null,
      "material": string|null,
      "priority": string|null,
      "remarks": string|null,
      "item_price": number|null,
      "base_services": [string],
      "addon_services": [string],
      "conditions": [string]
    }
  ]
}
Rules:
- Use null for any field not clearly visible. Do NOT invent values.
- Do NOT output UNKNOWN, N/A, random hashes, or placeholder IDs as order_id.
- Brand shorten codes on paper: NB = New Balance, MK = Michael Kors, OT / Onitsuka = Onitsuka Tiger. Always store the full brand name.
- DATE & TIME on the paper form IS date_received. Examples: "8/15 1:08 PM" → "2025-08-15T13:08:00", "8/15 1134" → "2025-08-15T11:34:00". Always keep the written time when present. Do not invent August 15 unless that month/day is written on the form.
- order_id is the paper CONTROL NO when present (for example 082002).
- Item remarks/notes: capture handwritten notes on a row such as "no lace". Form-level notes such as "fully paid cash" go in special_instructions. Do not drop them.
- claimed_date / original_estimated_release_date: use null if nothing is written. Do not invent those dates; the system fills official business-rule dates later.
- Multiple Full Reglue (FR) pairs on one form are still one 25-day job, not 25 days per pair.
- Service codes may appear as BC, FR, MR, MRET, MRES, UY, CR, etc.
- Extract all visible pairs/items on the form as separate items, in row order.
- FREE is NOT a service name. Ignore "FREE" unless that row's price is literally written as FREE or 0.
- item_price MUST come from that same item row (the handwritten/printed amount on that line).
- If the price column writes an addition such as "401.25 + 128 =", item_price is the sum of those written amounts (529.25). Do not keep only one of the numbers. Do not invent catalog add-on prices.
- Do NOT copy the first item's price onto later items.
- Do NOT use grand total, downpayment, or balance as any item's item_price.
- If one service code (e.g. BC) is written beside a curly brace / bracket grouping several rows, apply it ONLY to those grouped rows. Do not copy it onto other items.
- A service written as "BC + MRET" on one row belongs only to that row (Basic Cleaning + Minor Retouch).
- FREE written on a specific row is that row only. Never assign FREE to a different item that has a handwritten price.
- Dates may appear as 8/16 or 8-16 without a year. Convert to YYYY-MM-DD using the form's year when visible; for this archive use 2025 for August–December and 2026 for January–February.
- claimed_date: look for handwritten margin notes such as "Claimed 8/20", "Claimed: 8/20", "claimed 8-20", "Date Claimed", often below the table or outside the grid. Use null if nothing is written.
- original_estimated_release_date: the expected date of release. Look for EST. RELEASE, Estimated Release, Expected Release, Expected Date, Release Date. Use null if that field is blank — do not invent a release date.
- downpayment: look specifically in the payment section for DP, Downpayment, Down Payment, Deposit, Amount Paid, Payment Received, including "DP - 700.00".
- balance: look for Balance, Bal, Remaining Balance, Amount Due, including "Bal - 725.00".
- payment_method may be written on the same line as DP (e.g. "DP - 700.00 cash").
- payment_method: only if explicitly written (Cash, GCash, Bank Transfer, Card, Maya, etc.). Do not infer a method just because an amount exists.
- If a payment amount is unreadable, use null — never default to 0.
- grand_total, downpayment, and balance are distinct fields. Do not mix them.
- When the form shows a subtotal then a discount (e.g. 650, then -97.50, then 552.50): set original_grand_total to the pre-discount amount (650), discount to 97.50, and grand_total to the final discounted amount (552.50). Never put the original subtotal into balance.
- raw_text_summary: brief plain-text dump of all visible text for audit.
"""

KNOWN_ADDONS = {
    "mret", "mr", "mres", "minor retouch", "minor reglue", "minor restoration",
    "retouch", "reglue", "deep cleaning", "sole whitening", "deodorizing",
}


def _get_client():
    from google import genai
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=api_key)


def _model_name() -> str:
    val = os.getenv("GEMINI_MODEL_NAME", "gemini-3.6-flash").strip()
    if not val or val in ("gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.5-flash"):
        return "gemini-3.6-flash"
    return val


def _fallback_models() -> List[str]:
    primary = _model_name()
    fallbacks = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
    seen = {primary}
    ordered = [primary]
    for m in fallbacks:
        if m not in seen:
            ordered.append(m)
            seen.add(m)
    return ordered


def _mime_for_path(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".png": "image/png",
    }.get(ext, "image/jpeg")


def _parse_json_response(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _prepare_image_for_ocr(image_bytes: bytes, mime_type: str, *, max_side: int = 1600) -> Tuple[bytes, str]:
    """Downscale large CamScanner images so Gemini/local OCR stay responsive."""
    try:
        from PIL import Image
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        if max(w, h) > max_side:
            scale = max_side / float(max(w, h))
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, mime_type


def _run_gemini_ocr(
    image_bytes: bytes,
    mime_type: str,
    *,
    interactive: bool = False,
    cancel_key: Optional[str] = None,
) -> Tuple[Dict[str, Any], float]:
    from google.genai import types
    import time
    import re

    client = _get_client()
    last_err = None
    models = _fallback_models()
    max_attempts = 1 if interactive else 4
    max_sleep = 6 if interactive else 35

    for model in models:
        for attempt in range(max_attempts):
            if is_ocr_cancelled(cancel_key):
                raise OcrCancelled("OCR cancelled by reviewer")
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=[
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                                types.Part.from_text(text=EXTRACTION_PROMPT),
                            ],
                        )
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                raw = response.text or "{}"
                data = _parse_json_response(raw)
                confidence = float(data.get("confidence_score") or 0.5)
                data["_raw_ocr_response"] = raw
                data["_ocr_model"] = model
                return data, confidence
            except OcrCancelled:
                raise
            except Exception as exc:
                last_err = exc
                msg = str(exc).lower()
                retry_after = 8 if interactive else 35
                m = re.search(r"retry in ([0-9.]+)s", msg)
                if m:
                    retry_after = max(int(float(m.group(1))) + 1, 5)
                if "503" in msg or "429" in msg or "unavailable" in msg or "quota" in msg or "rate" in msg:
                    if "quota" in msg and attempt >= (1 if interactive else 2):
                        break  # try next model
                    # Poll cancel while sleeping so Cancel OCR remains responsive.
                    wait_s = min(retry_after, max_sleep, 2 ** attempt * (3 if interactive else 5))
                    waited = 0.0
                    while waited < wait_s:
                        if is_ocr_cancelled(cancel_key):
                            raise OcrCancelled("OCR cancelled by reviewer")
                        step = min(0.5, wait_s - waited)
                        time.sleep(step)
                        waited += step
                    continue
                raise
    raise last_err  # type: ignore[misc]


def load_pdf_pages(pdf_path: Path, dpi: int = 150) -> List[Tuple[int, bytes]]:
    """Render each PDF page to JPEG bytes."""
    import fitz  # pymupdf
    from PIL import Image

    doc = fitz.open(str(pdf_path))
    pages: List[Tuple[int, bytes]] = []
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    for page_num in range(len(doc)):
        pix = doc[page_num].get_pixmap(matrix=matrix, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        pages.append((page_num + 1, buf.getvalue()))
    doc.close()
    return pages


def load_image_bytes(path: Path) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def extraction_is_usable(data: Optional[Dict[str, Any]]) -> bool:
    """True when OCR returned enough structured fields to review without a full retype."""
    if not isinstance(data, dict) or not data:
        return False
    if data.get("customer_name") or data.get("contact_number"):
        return True
    if data.get("grand_total") not in (None, "", 0, 0.0):
        return True
    if data.get("downpayment") not in (None, "", 0, 0.0):
        return True
    if data.get("balance") not in (None, "", 0, 0.0):
        return True
    if data.get("date_received") or data.get("branch"):
        return True
    for item in data.get("items") or []:
        if not isinstance(item, dict):
            continue
        if item.get("brand") or item.get("model"):
            return True
        if item.get("item_price") not in (None, ""):
            return True
        if item.get("base_services") or item.get("addon_services"):
            return True
    summary = str(data.get("raw_text_summary") or "").strip()
    return len(summary) >= 40


def extract_from_bytes(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    *,
    use_gemini: bool = True,
    use_local_fallback: bool = True,
    local_engine: str = "auto",
    interactive: bool = False,
    cancel_key: Optional[str] = None,
) -> Tuple[Dict[str, Any], float, str]:
    """
    Tiered OCR: Gemini (production primary) → optional local EasyOCR → Tesseract.
    Returns (extracted_data, confidence, engine_version).

    interactive=True (UI Re-run OCR):
      - downscales large scans
      - shorter Gemini retries / single primary model
      - prefers Tesseract over EasyOCR (EasyOCR first-load is very slow)
      - honors cancel_key between attempts
    """
    from historical.local_ocr import (
        extract_local_from_bytes,
        is_gemini_quota_exhausted,
        mark_gemini_quota_exhausted,
    )

    if is_ocr_cancelled(cancel_key):
        raise OcrCancelled("OCR cancelled by reviewer")

    if interactive:
        image_bytes, mime_type = _prepare_image_for_ocr(image_bytes, mime_type)
        if local_engine == "auto":
            from historical.local_ocr import easyocr_available
            local_engine = "easyocr" if easyocr_available() else "tesseract"

    gemini_stub: Optional[Tuple[Dict[str, Any], float, str]] = None
    if use_gemini and not is_gemini_quota_exhausted():
        try:
            data, confidence = _run_gemini_ocr(
                image_bytes,
                mime_type,
                interactive=interactive,
                cancel_key=cancel_key,
            )
            engine = data.get("_ocr_model", OCR_VERSION)
            if extraction_is_usable(data):
                return data, confidence, engine
            # Keep stub only if local fallback is disabled or returns lower quality.
            gemini_stub = (data, confidence, engine)
        except OcrCancelled:
            raise
        except Exception as exc:
            msg = str(exc).lower()
            if "429" in msg or "quota" in msg or "resource_exhausted" in msg:
                mark_gemini_quota_exhausted(300.0)  # 5-min cooldown — prevents tight fallback loops during batch runs

    if is_ocr_cancelled(cancel_key):
        raise OcrCancelled("OCR cancelled by reviewer")

    if use_local_fallback:
        data, confidence, engine = extract_local_from_bytes(
            image_bytes, engine=local_engine,
        )
        # For handwritten forms, Gemini partial extraction with recognized fields
        # should NOT be superseded by crude Tesseract noise.
        if gemini_stub is not None:
            g_data, g_conf, g_engine = gemini_stub
            g_has_entities = bool(
                g_data.get("customer_name")
                or g_data.get("contact_number")
                or g_data.get("grand_total")
                or (g_data.get("items") and len(g_data["items"]) > 0)
            )
            l_has_entities = bool(
                data.get("customer_name")
                or data.get("contact_number")
                or data.get("grand_total")
                or (data.get("items") and len(data["items"]) > 0)
            )
            if (g_has_entities and not l_has_entities) or g_conf >= confidence:
                return g_data, g_conf, g_engine

        if extraction_is_usable(data) or gemini_stub is None:
            return data, confidence, engine
        # Local also empty — return the Gemini stub for audit trail continuity.
        return gemini_stub

    if gemini_stub is not None:
        return gemini_stub

    empty = {"items": [], "confidence_score": 0.0, "raw_text_summary": ""}
    return empty, 0.0, "none"


def extract_from_bytes_legacy(image_bytes: bytes, mime_type: str = "image/jpeg") -> Tuple[Dict[str, Any], float]:
    """Backward-compatible wrapper returning only data + confidence."""
    data, confidence, _ = extract_from_bytes(image_bytes, mime_type)
    return data, confidence


def extract_from_file(
    file_path: Path,
    *,
    use_gemini: bool = True,
    use_local_fallback: bool = True,
    local_engine: str = "auto",
    interactive: bool = False,
    cancel_key: Optional[str] = None,
) -> List[Tuple[str, Dict[str, Any], float, str]]:
    """
    Extract OCR data from a source file.
    Returns list of (page_label, extracted_data, confidence, engine_version).
    """
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        results = []
        pages = load_pdf_pages(file_path, dpi=120 if interactive else 150)
        for page_num, page_bytes in pages:
            if is_ocr_cancelled(cancel_key):
                raise OcrCancelled("OCR cancelled by reviewer")
            data, conf, engine = extract_from_bytes(
                page_bytes, "image/jpeg",
                use_gemini=use_gemini, use_local_fallback=use_local_fallback,
                local_engine=local_engine,
                interactive=interactive,
                cancel_key=cancel_key,
            )
            label = f"{file_path.name}#page{page_num}"
            results.append((label, data, conf, engine))
            # Interactive review only needs the first page for job-order forms.
            if interactive:
                break
        return results

    if ext not in SUPPORTED_IMAGE_EXT:
        raise ValueError(f"Unsupported file type: {ext}")

    if is_ocr_cancelled(cancel_key):
        raise OcrCancelled("OCR cancelled by reviewer")

    data, conf, engine = extract_from_bytes(
        load_image_bytes(file_path), _mime_for_path(file_path),
        use_gemini=use_gemini, use_local_fallback=use_local_fallback,
        local_engine=local_engine,
        interactive=interactive,
        cancel_key=cancel_key,
    )
    return [(file_path.name, data, conf, engine)]


def parse_date(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    s = str(val).strip()
    # Normalize "8/15 1:08 PM" / "8/15 1:08PM" / "8-15 13:08"
    ampm = re.search(
        r"^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?[ T]+(\d{1,2}):(\d{2})\s*(AM|PM)?\b",
        s,
        re.IGNORECASE,
    )
    if ampm:
        month, day = int(ampm.group(1)), int(ampm.group(2))
        year_raw = ampm.group(3)
        hour, minute = int(ampm.group(4)), int(ampm.group(5))
        meridiem = (ampm.group(6) or "").upper()
        if year_raw:
            year = int(year_raw)
            if year < 100:
                year += 2000
        else:
            year = 2026 if month in (1, 2) else 2025
        if meridiem == "PM" and hour < 12:
            hour += 12
        if meridiem == "AM" and hour == 12:
            hour = 0
        try:
            return datetime(year, month, day, hour, minute)
        except ValueError:
            pass
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%m/%d/%y",
    ):
        try:
            return datetime.strptime(s[:19], fmt)
        except ValueError:
            continue
    md = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})", s)
    if md:
        month, day = int(md.group(1)), int(md.group(2))
        year = 2026 if month in (1, 2) else 2025
        try:
            return datetime(year, month, day)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


# Sentinel used only when OCR provided no DATE & TIME. Never treat as a real paper date.
UNVERIFIED_RECEIVED_SENTINEL = datetime(2025, 8, 15, 0, 0, 0)


def is_unverified_received_sentinel(value: Any) -> bool:
    """True for the placeholder midnight Aug 15 used when DATE & TIME was missing."""
    if value is None or value == "":
        return False
    if isinstance(value, datetime):
        dt = value.replace(tzinfo=None)
    else:
        dt = parse_date(value)
    if dt is None:
        return False
    return (
        dt.year == UNVERIFIED_RECEIVED_SENTINEL.year
        and dt.month == UNVERIFIED_RECEIVED_SENTINEL.month
        and dt.day == UNVERIFIED_RECEIVED_SENTINEL.day
        and dt.hour == 0
        and dt.minute == 0
        and dt.second == 0
    )


def derive_order_id(extracted: Dict[str, Any], file_hash: str) -> str:
    """
    Source-document / control-number hint only.

    The customer-facing Job Order ID is generated by order_numbering.resolve_historical_order_id
    as ORD-YYYY-MM-DD-NNN. This helper must not invent UNKNOWN-/hash-based final IDs.
    """
    from order_numbering import is_canonical_order_id, is_placeholder_order_id, source_document_ref

    oid = extracted.get("order_id")
    ref = source_document_ref(oid)
    if ref and is_canonical_order_id(ref):
        return ref
    if ref and not is_placeholder_order_id(ref):
        return ref
    # Intentionally unused file_hash: hash-based IDs are no longer customer-facing.
    _ = file_hash
    return ""


def sanitize_extracted_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Drop invented FREE/placeholder services and keep row-level price as-is (including null)."""
    if not isinstance(item, dict):
        return item
    invalid = {"free", "n/a", "na", "none", "null", "unknown", "price", "total"}

    def _clean(values):
        cleaned = []
        for val in values or []:
            text = str(val).strip()
            if not text or text.lower() in invalid:
                continue
            cleaned.append(text)
        return cleaned

    item["base_services"] = _clean(item.get("base_services"))
    item["addon_services"] = _clean(item.get("addon_services"))
    from historical.local_ocr_parser import canonical_brand_name
    if item.get("brand"):
        item["brand"] = canonical_brand_name(item.get("brand"))
    price = item.get("item_price")
    if isinstance(price, str) and price.strip().lower() in invalid:
        item["item_price"] = None
    return item


def service_type(name: str) -> str:
    lower = name.lower().strip()
    if any(a in lower for a in KNOWN_ADDONS):
        return "addon"
    return "base"


def map_conditions(conditions: Optional[List[str]]) -> Dict[str, bool]:
    result = {
        "scratches": False,
        "yellowing": False,
        "sole_separation": False,
        "deep_stains": False,
        "rips_holes": False,
        "worn_out": False,
    }
    if not conditions:
        return result
    for c in conditions:
        cl = str(c).lower().strip()
        if "scratch" in cl:
            result["scratches"] = True
        elif "yellow" in cl:
            result["yellowing"] = True
        elif "sole" in cl and "sep" in cl:
            result["sole_separation"] = True
        elif "stain" in cl:
            result["deep_stains"] = True
        elif "rip" in cl or "hole" in cl:
            result["rips_holes"] = True
        elif "worn" in cl:
            result["worn_out"] = True
    return result
