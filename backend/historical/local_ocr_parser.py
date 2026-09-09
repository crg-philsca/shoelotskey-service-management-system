"""
Heuristic field parser for raw OCR text from Shoelotskey job order forms.
Extracts ML-relevant fields only; uses null for anything not clearly present.
Maintains row-level price association and labeled payment-section amounts.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

SERVICE_CODE_PATTERN = re.compile(
    r"\b(BC\s*\+\s*MRET|BC\s*\+\s*MRES|BC\s*\+\s*UY|BC\s*\+\s*UNY|BC\s*\+\s*MR|MRET|MRES|UNY|UFR|MFR|2CR|3CR|BC|MR|FR|UY|CR)\b",
    re.IGNORECASE,
)
DATE_PATTERNS = [
    re.compile(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})"),
    re.compile(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})"),
    re.compile(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})"),
    re.compile(r"\b(\d{1,2})[-/](\d{1,2})\b"),
]
# Plain numbers plus peso-prefixed amounts. Used only next to a label or item row.
LABELED_MONEY_PATTERN = re.compile(
    r"(?:₱|PHP|P)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
CONDITION_KEYWORDS = {
    "scratches": "Scratches",
    "yellowing": "Yellowing",
    "sole separation": "Sole Separation",
    "deep stains": "Deep Stains",
    "rips": "Rips/Holes",
    "holes": "Rips/Holes",
    "worn out": "Worn Out",
}

KNOWN_BRANDS = {
    "nike", "adidas", "asics", "puma", "new balance", "converse", "vans",
    "onitsuka tiger", "onitsuka", "on cloud", "jordan", "reebok", "hoka",
    "salomon", "michael kors", "mk", "nb",
}

BRAND_ALIASES = {
    "nb": "New Balance",
    "mk": "Michael Kors",
    "ot": "Onitsuka Tiger",
    "new balance": "New Balance",
    "michael kors": "Michael Kors",
    "onitsuka tiger": "Onitsuka Tiger",
    "onitsuka": "Onitsuka Tiger",
    "on cloud": "On Cloud",
}

COLOR_WORDS = {
    "black", "white", "red", "blue", "green", "yellow", "brown", "gray", "grey",
    "navy", "beige", "pink", "purple", "orange", "cream", "gold", "silver",
}

INVALID_SERVICE_TOKENS = {
    "free", "n/a", "na", "none", "null", "unknown", "price", "total", "amount",
}

SERVICE_CODE_NAMES = {
    "BC": "Basic Cleaning",
    "MR": "Minor Reglue",
    "FR": "Full Reglue",
    "CR": "Color Renewal",
    "UNY": "Unyellowing",
    "UY": "Unyellowing",
    "MRET": "Minor Retouch",
    "MRES": "Minor Restoration",
    "2CR": "2 Colors",
    "3CR": "3 Colors",
    "UFR": "Undersole Full Reglue",
    "MFR": "Midsole Full Reglue",
}

# Catalog / OCR aliases that should roll up to the same display name in analytics.
SERVICE_CODE_ALIASES = {
    **SERVICE_CODE_NAMES,
    "BCN": "Basic Cleaning",
    "FRG": "Full Reglue",
    "MRG": "Minor Reglue",
    "CRN": "Color Renewal",
    "MRS": "Minor Restoration",
    "MRT": "Minor Retouch",
    "2CL": "2 Colors",
    "3CL": "3 Colors",
}

COMBO_SERVICE_SPLIT = {
    "BC+UY": ["BC", "UY"],
    "BC+MR": ["BC", "MR"],
    "BC+MRET": ["BC", "MRET"],
    "BC+MRES": ["BC", "MRES"],
    "UNY+BC": ["UNY", "BC"],
    "BC+UNY": ["BC", "UNY"],
}

BASE_CODES = {"BC", "MR", "FR", "CR"}
ADDON_CODES = {"UNY", "UY", "MRET", "MRES", "2CR", "3CR", "2CL", "3CL", "UFR", "MFR"}

DOWNPAYMENT_LABELS = [
    "DOWN PAYMENT", "DOWNPAYMENT", "DOWN-PAYMENT", "AMOUNT PAID",
    "PAYMENT RECEIVED", "AMT PAID", "DEPOSIT", "DP",
]
BALANCE_LABELS = [
    "REMAINING BALANCE", "AMOUNT DUE", "AMT DUE", "BALANCE", "BAL",
]
GRAND_TOTAL_LABELS = [
    "GRAND TOTAL", "TOTAL AMOUNT", "AMT TOTAL", "TOTAL",
]
DISCOUNT_LABELS = [
    "DISCOUNT", "DISC", "LESS", "DEDUCTION", "SENIOR DISCOUNT", "PWD DISCOUNT",
]
DISCOUNTED_TOTAL_LABELS = [
    "NET TOTAL", "NET AMOUNT", "AMOUNT PAYABLE", "FINAL TOTAL",
    "DISCOUNTED TOTAL", "DISCOUNTED GRAND TOTAL", "AFTER DISCOUNT",
]
ITEM_PRICE_LABELS = [
    "ITEM PRICE", "UNIT PRICE", "PRICE", "AMOUNT",
]
CLAIMED_DATE_LABELS = [
    "DATE CLAIMED:", "DATE CLAIMED", "CLAIM DATE:", "CLAIM DATE",
    "CLAIMED DATE:", "CLAIMED DATE", "CLAIMED:", "CLAIMED",
]
EXPECTED_RELEASE_LABELS = [
    "ORIGINAL ESTIMATED RELEASE:", "ESTIMATED RELEASE:", "ESTIMATED RELEASE",
    "EST. RELEASE:", "EST. RELEASE", "EST RELEASE:", "EST RELEASE",
    "EXPECTED RELEASE DATE:", "EXPECTED DATE OF RELEASE:",
    "EXPECTED RELEASE:", "EXPECTED RELEASE", "EXPECTED DATE:",
    "DATE OF RELEASE:", "RELEASE DATE:", "RELEASE DATE",
]


def _archive_year_for_month(month: int) -> int:
    """Historical paper archive: August 2025 through January 2026."""
    if month == 1:
        return 2026
    if month == 2:
        return 2026
    return 2025


def coerce_historical_archive_date(value) -> Optional[date]:
    """
    Keep month/day from the form, but pin the year to the archive window:
    Aug–Dec → 2025, January (and February if present) → 2026.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        d = value.date()
    elif isinstance(value, date):
        d = value
    else:
        raw = str(value).strip()[:10]
        try:
            d = datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            parsed = _parse_date_str(str(value))
            if not parsed:
                return None
            d = datetime.strptime(parsed, "%Y-%m-%d").date()
    year = _archive_year_for_month(d.month)
    try:
        return d.replace(year=year)
    except ValueError:
        return d.replace(year=year, day=28)


def _parse_date_str(raw: str) -> Optional[str]:
    raw = raw.strip()
    if not raw:
        return None
    for pat in DATE_PATTERNS:
        m = pat.search(raw)
        if not m:
            continue
        g = m.groups()
        try:
            if len(g) == 2:
                mo, d = int(g[0]), int(g[1])
            elif len(g[0]) == 4:
                _y, mo, d = int(g[0]), int(g[1]), int(g[2])
            elif len(g) >= 3 and len(g[2]) == 4:
                d, mo, _y = int(g[0]), int(g[1]), int(g[2])
            else:
                d, mo, y = int(g[0]), int(g[1]), int(g[2])
                _ = y
            y = _archive_year_for_month(mo)
            return datetime(y, mo, d).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_time_token(raw: str) -> Optional[str]:
    """Parse handwritten times such as 1134, 11:34, or 11:34AM into HH:MM."""
    text = (raw or "").strip().upper()
    if not text:
        return None
    m = re.search(r"\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b", text)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2))
        ampm = m.group(3)
        if ampm == "PM" and hour < 12:
            hour += 12
        if ampm == "AM" and hour == 12:
            hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
        return None
    compact_matches = [
        m.group(1) for m in re.finditer(r"\b(\d{3,4})\b", text)
        if not (1900 <= int(m.group(1)) <= 2100)
    ]
    if not compact_matches:
        return None
    digits = compact_matches[-1]
    if len(digits) == 3:
        hour, minute = int(digits[0]), int(digits[1:])
    else:
        hour, minute = int(digits[:2]), int(digits[2:])
    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return f"{hour:02d}:{minute:02d}"
    return None


def _time_after_labels(text: str, labels: List[str]) -> Optional[str]:
    snippet = _after_label(text, labels) or ""
    parsed = _parse_time_token(snippet)
    if parsed:
        return parsed
    upper = text.upper()
    for label in labels:
        idx = upper.find(label.upper())
        if idx == -1:
            continue
        parsed = _parse_time_token(text[idx: idx + len(label) + 48])
        if parsed:
            return parsed
    return None


def canonical_brand_name(raw: Optional[str]) -> Optional[str]:
    """Expand handwritten brand codes: NB → New Balance, MK → Michael Kors."""
    text = clean_shoe_token(raw)
    if not text:
        return None
    lower = re.sub(r"\s+", " ", text).strip().lower()
    if lower in BRAND_ALIASES:
        return BRAND_ALIASES[lower]
    keys = sorted(BRAND_ALIASES.keys(), key=len, reverse=True)
    for key in keys:
        pat = rf"^{re.escape(key)}$" if len(key) > 3 else rf"^{re.escape(key)}$"
        if re.match(pat, lower):
            return BRAND_ALIASES[key]
    titled = text.strip()
    return titled


def match_brand_in_text(text: str) -> Optional[str]:
    lower = (text or "").lower()
    keys = sorted(set(list(BRAND_ALIASES.keys()) + list(KNOWN_BRANDS)), key=len, reverse=True)
    for key in keys:
        pat = rf"\b{re.escape(key)}\b"
        if re.search(pat, lower):
            return BRAND_ALIASES.get(key) or canonical_brand_name(key)
    return None


def _parse_item_line_details(line: str, brand: Optional[str]) -> Dict[str, Optional[str]]:
    work = SERVICE_CODE_PATTERN.sub(" ", line)
    work = re.sub(r"(?:₱|PHP|\bP\b)?\s*\d[\d,]*(?:\.\d+)?", " ", work)
    work = re.sub(r"\b(free|bc|fr|mr|cr|uny|uy|mret|mres)\b", " ", work, flags=re.IGNORECASE)
    if brand:
        work = re.sub(re.escape(brand), " ", work, flags=re.IGNORECASE)
        for alias, full in BRAND_ALIASES.items():
            if full.lower() == brand.lower() or alias == brand.lower():
                work = re.sub(rf"\b{re.escape(alias)}\b", " ", work, flags=re.IGNORECASE)
        work = re.sub(r"\btiger\b", " ", work, flags=re.IGNORECASE)
    size = None
    sm = re.search(r"\bsize\s*[:\-]?\s*(\d{1,2}(?:\.\d)?)\b", work, flags=re.IGNORECASE)
    if sm:
        size = sm.group(1)
        work = work[:sm.start()] + " " + work[sm.end():]
    color_hits = []
    for word in sorted(COLOR_WORDS, key=len, reverse=True):
        pat = rf"\b{re.escape(word)}\b"
        if re.search(pat, work, flags=re.IGNORECASE):
            color_hits.append(word.title() if word != "grey" else "Grey")
            work = re.sub(pat, " ", work, flags=re.IGNORECASE)
    color = " ".join(dict.fromkeys(color_hits)) or None
    remarks = None
    note = re.search(r"\b(no\s+laces?|no\s+lace|missing\s+lace[s]?)\b", work, flags=re.IGNORECASE)
    if note:
        remarks = re.sub(r"\s+", " ", note.group(0)).strip()
        work = work[:note.start()] + " " + work[note.end():]
    model = clean_shoe_token(re.sub(r"[-–|,]+", " ", work))
    if model and _looks_like_color(model):
        if not color:
            color = model
        model = None
    if model and _looks_like_material(model):
        model = None
    return {"model": model, "color": color, "size": size, "remarks": remarks}


def _extract_form_notes(text: str) -> Optional[str]:
    notes = []
    if re.search(r"fully\s*paid", text or "", re.IGNORECASE):
        notes.append("Fully paid")
    return "; ".join(notes) or None


def _after_label(text: str, labels: List[str]) -> Optional[str]:
    upper = text.upper()
    for label in labels:
        idx = upper.find(label.upper())
        if idx == -1:
            continue
        snippet = text[idx + len(label): idx + len(label) + 120]
        snippet = re.split(r"[\n\r|]", snippet)[0].strip(" :.-")
        if snippet and len(snippet) > 1:
            return snippet[:100]
    return None


def _date_after_labels(text: str, labels: List[str]) -> Optional[str]:
    """Parse a date on the same line as a label, or on the following line (e.g. Claimed 8/20)."""
    parsed = _parse_date_str(_after_label(text, labels) or "")
    if parsed:
        return parsed
    upper = text.upper()
    for label in labels:
        idx = upper.find(label.upper())
        if idx == -1:
            continue
        window = text[idx: idx + len(label) + 48]
        parsed = _parse_date_str(window)
        if parsed:
            return parsed
    return None


# "claimed 8/25", "claimed Gucci 8/19", "Claimed: 8/20"
ITEM_CLAIMED_REMARK_PATTERN = re.compile(
    r"\bclaimed(?:\s+[A-Za-z][\w\-']*)?\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)",
    re.IGNORECASE,
)


def extract_item_claimed_date(remarks: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Pull a per-item claimed date out of handwritten remarks.
    Returns (iso_date, cleaned_remarks). Remarks stay as-is when no date is found.
    """
    text = str(remarks or "").strip()
    if not text:
        return None, None
    match = ITEM_CLAIMED_REMARK_PATTERN.search(text)
    if not match:
        return None, text
    iso = _parse_date_str(match.group(1))
    if not iso:
        return None, text
    cleaned = (text[: match.start()] + text[match.end() :]).strip(" ;,-")
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip() or None
    return iso, cleaned


def _parse_money_token(raw: str) -> Optional[float]:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "").replace("₱", "").replace("PHP", "").replace("P", "")
    s = s.strip()
    if not s:
        return None
    try:
        value = float(s)
    except ValueError:
        return None
    if value < 0 or value > 100000:
        return None
    return value


def _amount_after_labels(text: str, labels: List[str]) -> Optional[float]:
    """Find a money amount in the same region as a payment-section label."""
    upper = text.upper()
    for label in labels:
        start = 0
        label_u = label.upper()
        while True:
            idx = upper.find(label_u, start)
            if idx == -1:
                break
            # Require label as its own token so "DP" does not match inside other words.
            before = upper[idx - 1] if idx > 0 else " "
            after = upper[idx + len(label_u)] if idx + len(label_u) < len(upper) else " "
            if before.isalnum() or after.isalnum():
                start = idx + len(label_u)
                continue
            window = text[idx: idx + len(label) + 40]
            for m in LABELED_MONEY_PATTERN.finditer(window):
                amount = _parse_money_token(m.group(1))
                if amount is not None:
                    return amount
            start = idx + len(label_u)
    return None


def _find_priority(text: str) -> Optional[str]:
    lower = text.lower()
    if re.search(r"\brush\b", lower):
        return "rush"
    if re.search(r"\bpremium\b", lower):
        return "premium"
    if re.search(r"\bregular\b", lower):
        return "regular"
    return None


def _find_payment_method(text: str) -> Optional[str]:
    lower = text.lower()
    if re.search(r"\bgcash\b", lower):
        return "GCash"
    if re.search(r"\bmaya\b", lower):
        return "Maya"
    if re.search(r"\bbank\s*transfer\b|\btransfer\b", lower):
        return "Bank Transfer"
    if re.search(r"\bcard\b|\bvisa\b|\bmastercard\b", lower):
        return "Card"
    if re.search(r"\bcash\b", lower):
        return "Cash"
    return None


def resolve_service_price(name: str, catalog: Dict[str, float]) -> Optional[float]:
    raw = str(name or "").strip()
    if not raw:
        return None
    key = raw.lower()
    if key in catalog:
        return catalog[key]
    key = re.sub(r"\s*\([^)]*\)\s*", "", key).strip()
    if key in catalog:
        return catalog[key]
    upper = raw.upper().strip()
    full = SERVICE_CODE_NAMES.get(upper)
    if full and full.lower() in catalog:
        return catalog[full.lower()]
    return None


def compute_row_price(
    service_names: List[str],
    catalog: Dict[str, float],
    extracted_price: Any = None,
) -> Tuple[Optional[float], bool]:
    """
    Row total for review: prefer the handwritten amount; otherwise BC + add-on catalog prices.
    Pair example: Basic Cleaning 325 + Minor Retouch 125 = 450.
    FREE rows are 0, not a service name.
    """
    if isinstance(extracted_price, str) and extracted_price.strip().lower() in {"free", "n/a", "none"}:
        return 0.0, True
    extracted = _parse_money_token(extracted_price) if extracted_price not in (None, "") else None
    names = [str(s).strip() for s in (service_names or []) if str(s).strip()]
    billed = [n for n in names if n.lower() not in INVALID_SERVICE_TOKENS]
    is_free = any(n.lower() == "free" for n in names)
    # Complimentary when the form says FREE, or a billed row is written as 0 (e.g. "BC Free").
    if is_free and (extracted is None or extracted == 0):
        return 0.0, True
    if extracted is not None and extracted == 0 and billed:
        return 0.0, True
    if extracted is not None and extracted > 0:
        return extracted, False
    total = 0.0
    found = 0
    for n in billed:
        price = resolve_service_price(n, catalog or {})
        if price is None:
            continue
        total += price
        found += 1
    if found:
        return round(total, 2), False
    # Blank / unknown — do not treat empty rows as complimentary FREE.
    return None, False


# Same material list as JobOrderForm.tsx SHOE_MATERIALS (minus "Other").
KNOWN_MATERIALS = {
    "leather", "synthetic", "canvas", "mesh", "rubber", "textile",
    "suede", "knit", "patent leather", "patent", "denim", "nubuck",
}

# Same color list as JobOrderForm.tsx SHOE_COLORS, plus common combos from paper forms.
COLOR_WORDS = {
    "black", "white", "red", "blue", "green", "yellow", "brown", "grey", "gray",
    "navy", "beige", "pink", "purple", "orange", "cream", "ivory", "gold",
    "silver", "tan", "maroon", "burgundy", "teal", "olive", "multi",
}

_NAME_TO_CODE = {name.lower(): code for code, name in SERVICE_CODE_NAMES.items()}


def _looks_like_material(value: Optional[str]) -> bool:
    if not value:
        return False
    return str(value).strip().lower() in KNOWN_MATERIALS


def _looks_like_color(value: Optional[str]) -> bool:
    if not value:
        return False
    parts = re.split(r"[\/,&+]|(?:\s+and\s+)|(?:\s+)", str(value).strip().lower())
    parts = [p for p in parts if p]
    if not parts:
        return False
    return all(p in COLOR_WORDS for p in parts)


_EMPTY_FIELD_TOKENS = {".", "-", "—", "–", "n/a", "na", "none", "null", "nil", "unknown"}


def clean_shoe_token(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in _EMPTY_FIELD_TOKENS:
        return None
    if all(ch in ".-_/,\\| " for ch in text):
        return None
    return text


def classify_shoe_fields(
    model: Optional[str],
    color: Optional[str],
    material: Optional[str],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Map OCR tokens onto Brand/Model/Color/Material correctly.
    Paper forms often write Suede (material) or White/Blue (color) in the model slot.
    """
    model = clean_shoe_token(model)
    color = clean_shoe_token(color)
    material = clean_shoe_token(material)
    if model and _looks_like_material(model):
        if not material or material.lower() == model.lower():
            material = model
        model = None
    if model and _looks_like_color(model):
        if not color or color.lower() == model.lower():
            color = model
        model = None
    if color and _looks_like_material(color) and not material:
        material = color
        color = None
    if material and _looks_like_color(material) and not color:
        color = material
        material = None
    return model or None, color or None, material or None


def service_code_label(name: str) -> str:
    raw = str(name or "").strip()
    if not raw:
        return ""
    upper = raw.upper()
    if upper in {"UY", "UNY"}:
        return "UNY"
    if upper in SERVICE_CODE_NAMES:
        return upper
    mapped = _NAME_TO_CODE.get(raw.lower(), upper)
    if mapped == "UY":
        return "UNY"
    if mapped in {"2CL", "2CR"}:
        return "2CR"
    if mapped in {"3CL", "3CR"}:
        return "3CR"
    return mapped


def _format_catalog_amount(value: float) -> str:
    if abs(value - round(value)) < 0.001:
        return str(int(round(value)))
    return f"{value:.2f}"


CATALOG_MATCH_TOLERANCE = 10.0


def _clean_billed_names(service_names: List[str]) -> List[str]:
    names: List[str] = []
    for name in service_names or []:
        token = str(name).strip()
        if token and token.lower() not in INVALID_SERVICE_TOKENS:
            names.append(token)
    return names


def allocate_service_prices(
    service_names: List[str],
    catalog: Dict[str, float],
    row_total: Any = None,
    addends: Optional[List[float]] = None,
) -> List[Optional[float]]:
    """
    Pair each service with a written or catalog amount.
    Example: MR + UNY with 401.25 + 128 → [125, 401.25]
    because 128 is treated as catalog MR (125).
    """
    names = _clean_billed_names(service_names)
    if not names:
        return []
    catalog_vals = [resolve_service_price(n, catalog or {}) for n in names]
    addend_list = []
    for raw in addends or []:
        try:
            amount = float(raw)
        except (TypeError, ValueError):
            continue
        if amount > 0:
            addend_list.append(amount)
    assigned: List[Optional[float]] = [None] * len(names)
    used = set()
    for i, cat in enumerate(catalog_vals):
        if cat is None:
            continue
        for j, amount in enumerate(addend_list):
            if j in used:
                continue
            if abs(amount - cat) <= CATALOG_MATCH_TOLERANCE:
                assigned[i] = cat
                used.add(j)
                break
    for i in range(len(names)):
        if assigned[i] is not None:
            continue
        for j, amount in enumerate(addend_list):
            if j in used:
                continue
            assigned[i] = amount
            used.add(j)
            break
    if addend_list:
        return assigned

    total = _parse_money_token(row_total) if row_total not in (None, "") else None
    if total is not None and len(names) == 1:
        return [total]
    if (
        total is not None
        and all(v is not None for v in catalog_vals)
        and abs(sum(catalog_vals) - total) <= 0.05
    ):
        return catalog_vals
    if total is not None and len(names) >= 2:
        remaining = float(total)
        for i in range(len(names) - 1):
            cat = catalog_vals[i]
            if cat is not None:
                assigned[i] = cat
                remaining = round(remaining - cat, 2)
        assigned[-1] = remaining
        return assigned
    return catalog_vals


def format_price_breakdown(
    service_names: List[str],
    catalog: Dict[str, float],
    row_total: Any = None,
    addends: Optional[List[float]] = None,
    stored_prices: Optional[List[Any]] = None,
) -> Optional[str]:
    """e.g. BC(325)+MRET(125) or MR(125)+UNY(401.25)"""
    names = _clean_billed_names(service_names)
    if not names:
        return None
    prices: List[Optional[float]] = []
    stored = list(stored_prices or [])
    if stored and any(p not in (None, "", 0, 0.0) for p in stored):
        for idx, name in enumerate(names):
            raw = stored[idx] if idx < len(stored) else None
            try:
                amount = float(raw) if raw not in (None, "") else None
            except (TypeError, ValueError):
                amount = None
            prices.append(amount if amount and amount > 0 else resolve_service_price(name, catalog or {}))
        total = _parse_money_token(row_total) if row_total not in (None, "") else None
        stored_sum = sum(float(p) for p in prices if p is not None)
        if total is not None and stored_sum and abs(stored_sum - total) > 0.05:
            prices = allocate_service_prices(names, catalog, row_total, addends)
    else:
        prices = allocate_service_prices(names, catalog, row_total, addends)
    parts: List[str] = []
    for name, price in zip(names, prices):
        if price is None:
            price = resolve_service_price(name, catalog or {})
        if price is None:
            continue
        parts.append(f"{service_code_label(name)}({_format_catalog_amount(float(price))})")
    return "+".join(parts) if parts else None


def _strip_service_noise(name: str) -> str:
    text = str(name or "").strip()
    text = re.sub(r"\s*\(\d+(?:\.\d+)?\)\s*$", "", text)
    text = re.sub(r"\s*\(with basic cleaning\)\s*", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"[\s\-]+rush(?:\s*service)?$", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip(" -")


def canonical_service_display_name(name: str) -> str:
    """Map form codes (BC, FR, MRET) and aliases onto the full service name."""
    raw = _strip_service_noise(name)
    if not raw:
        return "Other"
    compact = re.sub(r"[\s\-]+", "", raw).upper()
    compact_core = re.sub(r"\d+$", "", compact)
    if compact in SERVICE_CODE_ALIASES:
        return SERVICE_CODE_ALIASES[compact]
    if compact_core in SERVICE_CODE_ALIASES:
        return SERVICE_CODE_ALIASES[compact_core]
    by_full_name = {value.lower(): value for value in SERVICE_CODE_ALIASES.values()}
    if raw.lower() in by_full_name:
        return by_full_name[raw.lower()]
    first = re.sub(r"[^A-Za-z0-9]+", "", raw.split()[0]).upper()
    first = re.sub(r"\d+$", "", first)
    if first in SERVICE_CODE_ALIASES:
        return SERVICE_CODE_ALIASES[first]
    return raw


def expand_service_names_for_analytics(name: str) -> List[str]:
    """Split combo codes and canonicalize so BC and Basic Cleaning count as one service."""
    raw = str(name or "").strip()
    if not raw:
        return ["Other"]
    compact = re.sub(r"[\s\-]+", "", raw).upper()
    combo = COMBO_SERVICE_SPLIT.get(compact)
    if combo:
        return [canonical_service_display_name(code) for code in combo]
    parts = [part.strip() for part in re.split(r"[+,/]|(?:\s+-\s+)", raw) if part.strip()]
    known_names = {value.lower() for value in SERVICE_CODE_ALIASES.values()}
    if len(parts) > 1:
        expanded = [canonical_service_display_name(part) for part in parts]
        if all(item.lower() in known_names for item in expanded):
            return expanded
    return [canonical_service_display_name(raw)]


def _normalize_service_token(token: str) -> Optional[str]:
    raw = (token or "").strip()
    if not raw:
        return None
    if raw.lower() in INVALID_SERVICE_TOKENS:
        return None
    upper = raw.upper()
    if upper in SERVICE_CODE_NAMES:
        return SERVICE_CODE_NAMES[upper]
    return raw


def _classify_service(name: str) -> str:
    code = service_code_label(name)
    if code in ADDON_CODES:
        return "addon"
    if code in BASE_CODES:
        return "base"
    lower = name.lower().strip()
    if any(phrase in lower for phrase in (
        "unyellowing",
        "minor retouch",
        "minor restoration",
        "2 colors",
        "3 colors",
        "undersole",
        "midsole",
    )):
        return "addon"
    return "base"


def _split_services(codes: List[str]) -> Tuple[List[str], List[str]]:
    base, addon = [], []
    for code in codes:
        name = _normalize_service_token(code)
        if not name:
            continue
        if _classify_service(name) == "addon" or code.upper() in ADDON_CODES:
            addon.append(name)
        else:
            base.append(name)
    return base, addon


def _find_service_codes(text: str) -> List[str]:
    codes = []
    seen = set()
    for m in SERVICE_CODE_PATTERN.finditer(text):
        raw = re.sub(r"\s+", "", m.group(1).upper())
        parts = COMBO_SERVICE_SPLIT.get(raw, [raw])
        for code in parts:
            if code not in seen:
                seen.add(code)
                codes.append(code)
    return codes


def _line_item_price(line: str) -> Optional[float]:
    """Price belonging to this row — last plausible amount on the line, not order totals."""
    if re.search(
        r"\b(grand\s*total|down\s*payment|downpayment|\bdp\b|balance|\bbal\b|deposit|amount\s*paid|amount\s*due)\b",
        line,
        re.IGNORECASE,
    ):
        return None
    amounts = []
    for m in LABELED_MONEY_PATTERN.finditer(line):
        amount = _parse_money_token(m.group(1))
        if amount is None:
            continue
        # Skip years and shoe sizes (8, 8.5, 10). Service prices on these forms are >= 50.
        token = m.group(1)
        if amount < 50:
            continue
        if 1900 <= amount <= 2100 and "." not in token:
            continue
        amounts.append(amount)
    if re.search(r"\d+(?:[.,]\d+)?\s*\+\s*\d+", line) and len(amounts) >= 2:
        return round(sum(amounts), 2)
    return amounts[-1] if amounts else None


def _extract_item_rows(text: str) -> List[Dict[str, Any]]:
    """
    Parse item rows and keep row-level price/service association.
    A service code written once above/beside a group of rows is applied only
    to following rows that have no service of their own (grouped handwriting).
    """
    items: List[Dict[str, Any]] = []
    pending_group_codes: List[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if len(line) < 2:
            continue
        if re.search(
            r"\b(client|customer|contact|control|order\s*no|job order|date|branch|staff|grand total|downpayment|down payment|\bdp\b|balance|payment)\b",
            line,
            re.IGNORECASE,
        ):
            continue

        codes = _find_service_codes(line)
        is_free_row = bool(re.search(r"\bfree\b", line, re.IGNORECASE))
        brand = match_brand_in_text(line)
        lower = line.lower()

        price = _line_item_price(line)
        looks_like_item = bool(
            brand or price is not None or is_free_row or re.search(r"\b(size|model|color)\b", lower)
        )

        if codes and not looks_like_item and price is None:
            # Service label written beside/above a group of upcoming rows.
            pending_group_codes = codes
            continue

        if not looks_like_item and not codes:
            continue

        row_codes = codes or list(pending_group_codes)
        base, addon = _split_services(row_codes)
        if is_free_row:
            # Keep BC/etc. on the row; FREE only means the price is complimentary (₱0).
            price = 0.0
        details = _parse_item_line_details(line, brand)
        remarks = details.get("remarks")
        if is_free_row:
            remarks = "FREE" if not remarks else f"FREE; {remarks}"
        items.append({
            "brand": brand,
            "model": details.get("model"),
            "color": details.get("color"),
            "size": details.get("size"),
            "material": None,
            "priority": None,
            "remarks": remarks,
            "item_price": price,
            "base_services": base,
            "addon_services": addon,
            "conditions": [],
            "is_free": is_free_row,
        })

    return items


def _estimate_confidence(text: str, extracted: Dict[str, Any]) -> float:
    if not text or len(text.strip()) < 20:
        return 0.05
    score = min(len(text.strip()) / 400.0, 0.35)
    if extracted.get("order_id"):
        score += 0.1
    if extracted.get("date_received"):
        score += 0.15
    if extracted.get("customer_name"):
        score += 0.1
    if extracted.get("items"):
        score += min(len(extracted["items"]) * 0.05, 0.2)
    services = sum(
        len(i.get("base_services") or []) + len(i.get("addon_services") or [])
        for i in (extracted.get("items") or [])
    )
    if services:
        score += min(services * 0.03, 0.15)
    if extracted.get("downpayment") is not None:
        score += 0.03
    if extracted.get("balance") is not None:
        score += 0.03
    return round(min(score, 0.75), 2)


def parse_payment_section(text: str) -> Dict[str, Optional[float]]:
    """Extract labeled payment-section amounts. Missing labels stay null."""
    return {
        "grand_total": _amount_after_labels(text, GRAND_TOTAL_LABELS),
        "downpayment": _amount_after_labels(text, DOWNPAYMENT_LABELS),
        "balance": _amount_after_labels(text, BALANCE_LABELS),
        "discount": _amount_after_labels(text, DISCOUNT_LABELS),
        "discounted_grand_total": _amount_after_labels(text, DISCOUNTED_TOTAL_LABELS),
    }


def _item_price_sum(items: List[Dict[str, Any]]) -> Optional[float]:
    total = 0.0
    found = 0
    for item in items or []:
        price = item.get("item_price")
        if price is None or price == "":
            continue
        try:
            total += float(price)
            found += 1
        except (TypeError, ValueError):
            continue
    return round(total, 2) if found else None


def _negative_discount_amounts(text: str) -> List[float]:
    """Catch handwritten discount lines like '- 97.50' or '(-97.50)'."""
    found: List[float] = []
    raw = text or ""
    for m in re.finditer(
        r"(?:^|[^\d])-\s*(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)",
        raw,
        flags=re.MULTILINE | re.IGNORECASE,
    ):
        # Do not treat payment lines (DP - 700 / Bal - 725) as discounts.
        line_start = raw.rfind("\n", 0, m.start()) + 1
        line_end = raw.find("\n", m.start())
        if line_end < 0:
            line_end = len(raw)
        line = raw[line_start:line_end].lower()
        if re.search(
            r"\b(dp|down\s*payment|downpayment|bal(?:ance)?|deposit|amt\s*due|amount\s*due|amount\s*paid|grand\s*total|total\s*amount)\b",
            line,
        ):
            continue
        try:
            amount = float(m.group(1).replace(",", ""))
        except (TypeError, ValueError):
            continue
        if 0 < amount < 100000:
            found.append(round(amount, 2))
    return found


def resolve_original_and_discounted_totals(
    text: str,
    payments: Dict[str, Any],
    items: List[Dict[str, Any]],
) -> Dict[str, Optional[float]]:
    """
    Paper forms often show:
      item sum / TOTAL 650
      -97.50 discount
      552.50 final
    Keep original_grand_total = pre-discount, grand_total = final (discounted).
    """
    item_sum = _item_price_sum(items)
    labeled_total = payments.get("grand_total")
    labeled_discount = payments.get("discount")
    labeled_net = payments.get("discounted_grand_total")
    negative_discounts = _negative_discount_amounts(text)

    discount = None
    try:
        if labeled_discount is not None and labeled_discount != "":
            discount = abs(float(labeled_discount))
    except (TypeError, ValueError):
        discount = None
    if discount is None and negative_discounts:
        # Prefer a discount that explains item_sum → a nearby final amount.
        discount = negative_discounts[0]

    original = None
    final = None
    try:
        labeled_total_f = float(labeled_total) if labeled_total not in (None, "") else None
    except (TypeError, ValueError):
        labeled_total_f = None
    try:
        labeled_net_f = float(labeled_net) if labeled_net not in (None, "") else None
    except (TypeError, ValueError):
        labeled_net_f = None

    if labeled_net_f is not None and labeled_total_f is not None and labeled_net_f < labeled_total_f:
        original = labeled_total_f
        final = labeled_net_f
    elif discount is not None and labeled_total_f is not None:
        # Labeled TOTAL may be either pre- or post-discount; use item sum when it matches.
        if item_sum is not None and abs(item_sum - labeled_total_f) <= 0.009:
            original = item_sum
            final = round(max(0.0, item_sum - discount), 2)
        elif item_sum is not None and abs(item_sum - (labeled_total_f + discount)) <= 0.009:
            original = item_sum
            final = labeled_total_f
        else:
            original = labeled_total_f
            final = round(max(0.0, labeled_total_f - discount), 2)
    elif item_sum is not None and discount is not None:
        original = item_sum
        final = round(max(0.0, item_sum - discount), 2)
    elif item_sum is not None and labeled_total_f is not None and labeled_total_f + 0.009 < item_sum:
        # OCR put the discounted amount on TOTAL while pairs still sum higher.
        original = item_sum
        final = labeled_total_f
        discount = round(item_sum - labeled_total_f, 2)
    elif labeled_total_f is not None:
        original = None
        final = labeled_total_f
    elif item_sum is not None:
        original = None
        final = item_sum

    return {
        "original_grand_total": original,
        "grand_total": final,
        "discount": discount,
    }


def payment_discrepancy(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare recorded source amounts to calculated checks.
    Never replaces recorded values — returns a warning payload only.
    """
    items = extracted.get("items") or []
    item_sum = _item_price_sum(items) or 0.0
    priced_items = 1 if _item_price_sum(items) is not None else 0

    original = extracted.get("original_grand_total")
    grand_total = extracted.get("grand_total")
    downpayment = extracted.get("downpayment")
    balance = extracted.get("balance")
    warnings: List[str] = []

    try:
        orig = float(original) if original is not None and original != "" else None
    except (TypeError, ValueError):
        orig = None
    try:
        gt = float(grand_total) if grand_total is not None and grand_total != "" else None
    except (TypeError, ValueError):
        gt = None
    try:
        dp = float(downpayment) if downpayment is not None and downpayment != "" else None
    except (TypeError, ValueError):
        dp = None
    try:
        bal = float(balance) if balance is not None and balance != "" else None
    except (TypeError, ValueError):
        bal = None

    compare_total = orig if orig is not None else gt
    if compare_total is not None and priced_items > 0 and abs(item_sum - compare_total) > 0.009:
        warnings.append(
            "Payment discrepancy detected. Please verify against the original document."
        )
    calculated_balance = None
    if gt is not None and dp is not None:
        calculated_balance = round(gt - dp, 2)
        if bal is not None and abs(calculated_balance - bal) > 0.009:
            if "Payment discrepancy detected. Please verify against the original document." not in warnings:
                warnings.append(
                    "Payment discrepancy detected. Please verify against the original document."
                )

    return {
        "item_sum": round(item_sum, 2) if priced_items else None,
        "calculated_balance": calculated_balance,
        "warnings": warnings,
        "has_discrepancy": bool(warnings),
    }


def parse_raw_ocr_text(text: str, engine: str) -> Tuple[Dict[str, Any], float]:
    """Convert raw OCR text into the standard extraction schema."""
    text = text or ""
    order_id = _after_label(text, ["CONTROL NO:", "CONTROL NO", "ORDER NO:", "JOB ORDER"])
    if order_id:
        order_id = re.sub(r"[^\w\-]", "", order_id.split()[0])[:50] or None
        if order_id and order_id.upper() in {"UNKNOWN", "N/A", "NULL", "NONE"}:
            order_id = None

    date_received = _date_after_labels(text, ["DATE & TIME:", "DATE RECEIVED:", "DATE:"])
    received_time = _time_after_labels(text, ["DATE & TIME:", "DATE RECEIVED:", "DATE:"])
    if date_received and received_time:
        date_received = f"{date_received}T{received_time}:00"
    est_release = _date_after_labels(text, EXPECTED_RELEASE_LABELS)
    claimed = _date_after_labels(text, CLAIMED_DATE_LABELS)

    customer = _after_label(text, ["CLIENT NAME:", "CUSTOMER NAME:", "CLIENT:"])
    contact = _after_label(text, ["CONTACT NO:", "CONTACT:", "PHONE:"])
    branch = _after_label(text, ["BRANCH:"])
    staff = _after_label(text, ["STAFF:", "ATTENDANT:", "PROCESSED BY:"])
    priority = _find_priority(text)
    payment_method = _find_payment_method(text) or "Cash"

    items = _extract_item_rows(text)
    service_codes = _find_service_codes(text)

    if not items:
        if service_codes:
            base, addon = _split_services(service_codes)
            items.append({
                "brand": None, "model": None, "color": None, "size": None,
                "material": None, "priority": priority, "remarks": None,
                "item_price": None, "base_services": base, "addon_services": addon,
                "conditions": [],
            })
        else:
            items.append({
                "brand": None, "model": None, "color": None, "size": None,
                "material": None, "priority": priority, "remarks": None,
                "item_price": None, "base_services": [], "addon_services": [],
                "conditions": [],
            })

    for item in items:
        if item.get("brand"):
            item["brand"] = canonical_brand_name(item.get("brand"))
    conditions_found = [
        label for kw, label in CONDITION_KEYWORDS.items() if kw in text.lower()
    ]
    if conditions_found and items:
        existing = items[0].get("conditions") or []
        items[0]["conditions"] = list(dict.fromkeys([*existing, *conditions_found]))

    form_notes = _extract_form_notes(text)

    payments = parse_payment_section(text)
    downpayment = payments["downpayment"]
    balance = payments["balance"]
    resolved = resolve_original_and_discounted_totals(text, payments, items)
    original_grand_total = resolved.get("original_grand_total")
    grand_total = resolved.get("grand_total")
    discount = resolved.get("discount")

    # If OCR mistook the original subtotal for BALANCE, drop that false balance.
    try:
        bal_f = float(balance) if balance not in (None, "") else None
    except (TypeError, ValueError):
        bal_f = None
    try:
        orig_f = float(original_grand_total) if original_grand_total not in (None, "") else None
    except (TypeError, ValueError):
        orig_f = None
    try:
        gt_f = float(grand_total) if grand_total not in (None, "") else None
    except (TypeError, ValueError):
        gt_f = None
    if (
        bal_f is not None
        and orig_f is not None
        and gt_f is not None
        and abs(bal_f - orig_f) <= 0.009
        and abs(bal_f - gt_f) > 0.009
        and downpayment in (None, "")
    ):
        balance = None

    extracted: Dict[str, Any] = {
        "order_id": order_id,
        "branch": branch,
        "date_received": date_received,
        "original_estimated_release_date": est_release,
        "claimed_date": claimed,
        "customer_name": customer,
        "contact_number": contact,
        "staff_attendant": staff,
        "priority": priority,
        "total_pairs": len(items) if items else None,
        "original_grand_total": original_grand_total,
        "grand_total": grand_total,
        "downpayment": downpayment,
        "balance": balance,
        "discount": discount,
        "other_charges": None,
        "payment_method": payment_method,
        "gcash_reference": None,
        "pickup_delivery": None,
        "address": None,
        "courier": None,
        "delivery_notes": None,
        "special_instructions": form_notes,
        "raw_text_summary": text[:4000],
        "items": items,
        "_ocr_engine": engine,
    }
    extracted.update(payment_discrepancy(extracted))
    confidence = _estimate_confidence(text, extracted)
    extracted["confidence_score"] = confidence
    return extracted, confidence
