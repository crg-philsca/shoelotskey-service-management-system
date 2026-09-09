from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import re

from db.database import get_db
from auth_utils import require_role
from historical.ocr_status import CORRECTED, REJECTED, VALIDATED, pending_filter_values, validated_filter_values
from models import HistoricalOrder, HistoricalImage, HistoricalItem, HistoricalItemService, User
from order_numbering import (
    is_canonical_order_id,
    is_placeholder_order_id,
    resolve_historical_order_id,
    source_document_ref,
)

# NOTE: This router is NOT currently include_router()'d — live routes live in main.py.
# Auth deps below are defense-in-depth if the router is mounted later.
router = APIRouter()


# ─── 1. Validation Queue ─────────────────────────────────────────────────────
# Returns records that need human review: OCR-pending images OR records
# with NULL ML-critical fields (completion_days, brand, service_name)

def _count_review_queue_total(db: Session) -> int:
    """
    Exact count of records that belong in the human-review queue.
    Must stay in sync with get_validation_queue filters (Source A + Source B).
    """
    pending_images = (
        db.query(HistoricalImage.historical_image_id)
        .join(HistoricalImage.order)
        .filter(HistoricalImage.ocr_status.in_(pending_filter_values()))
        .count()
    )
    from historical.ocr_status import validated_filter_values
    pending_order_ids = {
        row[0]
        for row in (
            db.query(HistoricalImage.historical_order_id)
            .filter(HistoricalImage.ocr_status.in_(pending_filter_values()))
            .all()
        )
        if row[0] is not None
    }
    incomplete_q = (
        db.query(HistoricalOrder.historical_order_id)
        .filter(
            HistoricalOrder.ocr_status.in_(validated_filter_values()),
            (HistoricalOrder.completion_days == None) |
            (HistoricalOrder.claimed_date == None),
        )
    )
    incomplete_extra = 0
    for (oid,) in incomplete_q.all():
        if oid not in pending_order_ids:
            incomplete_extra += 1
    return int(pending_images) + int(incomplete_extra)


@router.get("/queue")
def get_validation_queue(
    db: Session = Depends(get_db),
    limit: int = 20,
    current_user: User = Depends(require_role("admin")),
):
    """
    Returns records needing human review.
    Includes:
      1. Images with ocr_status == 'Pending'
      2. Orders with NULL ML-critical fields (completion_days, brand, etc.)

    Response shape:
      { "items": [...], "total": <exact pending count>, "returned": <len(items)> }
    """
    results = []
    total_pending = _count_review_queue_total(db)

    # ── Source A: OCR-pending images ──────────────────────────────────────────
    images = (
        db.query(HistoricalImage)
        .join(HistoricalImage.order)
        .filter(HistoricalImage.ocr_status.in_(pending_filter_values()))
        .order_by(
            HistoricalOrder.date_received.asc(),
            HistoricalImage.historical_image_id.asc(),
        )
        .limit(limit)
        .all()
    )
    for img in images:
        order = img.order
        if order:
            item = _build_queue_item(img, order, source="ocr_pending")
            if item:
                results.append(item)

    # ── Source B: already-validated records still missing ML fields ───────────
    from historical.ocr_status import validated_filter_values
    remaining_slots = max(0, limit - len(results))
    incomplete_orders = (
        db.query(HistoricalOrder)
        .filter(
            HistoricalOrder.ocr_status.in_(validated_filter_values()),
            (HistoricalOrder.completion_days == None) |
            (HistoricalOrder.claimed_date == None),
        )
        .order_by(HistoricalOrder.date_received.asc())
        .limit(remaining_slots)
        .all()
    ) if remaining_slots else []
    existing_ids = {r["order"]["historical_order_id"] for r in results if r.get("order")}
    for order in incomplete_orders:
        if order.historical_order_id in existing_ids:
            continue
        item = _build_queue_item(None, order, source="incomplete_fields")
        if item:
            results.append(item)

    assign_display_order_ids(db, results)
    sort_review_queue(results)
    return {
        "items": results,
        "total": total_pending,
        "returned": len(results),
    }

def latest_raw_ocr(order) -> Dict[str, Any]:
    trail = order.audit_trail or []
    if isinstance(trail, dict):
        trail = [trail]
    for entry in reversed(trail):
        if not isinstance(entry, dict):
            continue
        raw = entry.get("raw_ocr")
        if isinstance(raw, dict) and raw:
            return raw
    return {}


def stored_source_document_ref(order) -> Optional[str]:
    trail = order.audit_trail or []
    if isinstance(trail, dict):
        trail = [trail]
    for entry in reversed(trail):
        if not isinstance(entry, dict):
            continue
        # Manual Control No edits are optional and must not replace the OCR paper ref.
        if entry.get("action") == "control_no":
            continue
        ref = entry.get("source_document_ref")
        if ref:
            return str(ref)
        raw = entry.get("raw_ocr") or {}
        if isinstance(raw, dict) and raw.get("order_id"):
            return source_document_ref(raw.get("order_id"))
    return source_document_ref(order.order_id) if is_placeholder_order_id(order.order_id) else None


def stored_control_no(order) -> tuple[bool, Optional[str]]:
    """Latest reviewer Control No override. (found, value) — value may be '' when cleared."""
    trail = order.audit_trail or []
    if isinstance(trail, dict):
        trail = [trail]
    for entry in reversed(trail):
        if not isinstance(entry, dict) or entry.get("action") != "control_no":
            continue
        if "control_no" in entry:
            value = entry.get("control_no")
            return True, "" if value in (None, "") else str(value).strip()
        # Legacy writes stored the value under source_document_ref only when non-empty.
        if "source_document_ref" in entry:
            ref = entry.get("source_document_ref")
            return True, "" if not ref else str(ref).strip()
        return True, ""
    return False, None


def stored_rush_fee(order) -> Optional[float]:
    """Latest reviewer-edited rush fee (₱100 / ₱150, etc.)."""
    trail = order.audit_trail or []
    if isinstance(trail, dict):
        trail = [trail]
    for entry in reversed(trail):
        if not isinstance(entry, dict) or entry.get("action") != "rush_fee":
            continue
        raw = entry.get("rush_fee")
        if raw in (None, ""):
            return None
        try:
            amount = float(raw)
        except (TypeError, ValueError):
            return None
        if amount < 0:
            return None
        return amount
    return None


def load_service_price_map(db: Session) -> Dict[str, float]:
    """Live catalog prices keyed by service name and form codes (BC, MRET, ...)."""
    from models import Service
    from historical.local_ocr_parser import SERVICE_CODE_ALIASES

    prices: Dict[str, float] = {}
    try:
        rows = db.query(Service.service_name, Service.base_price).all()
    except Exception:
        rows = []
    for name, price in rows:
        if not name or price is None:
            continue
        try:
            val = float(price)
        except (TypeError, ValueError):
            continue
        if val <= 0:
            continue
        prices[str(name).strip().lower()] = val
    for code, full in SERVICE_CODE_ALIASES.items():
        full_key = full.lower()
        if full_key in prices:
            prices[code.lower()] = prices[full_key]
    return prices


MAX_REASONABLE_COMPLETION_DAYS = 60


def _expand_service_name(name: str) -> str:
    from historical.local_ocr_parser import canonical_service_display_name
    return canonical_service_display_name(name)


def official_duration_for_historical_order(order) -> int:
    from ml.business_rules import MIN_DURATION_DAYS, calculate_official_release_days

    items = []
    for item in (getattr(order, "items", None) or []):
        base, addons = [], []
        for svc in (getattr(item, "services", None) or []):
            full = _expand_service_name(getattr(svc, "service_name", "") or "")
            if not full or full.lower() in {"free", "n/a", "none"}:
                continue
            if (getattr(svc, "service_type", None) or "base") == "addon":
                addons.append(full)
            else:
                base.append(full)
        items.append({"baseService": base, "addOns": addons})
    days = calculate_official_release_days({
        "items": items,
        "priorityLevel": getattr(order, "priority", None) or "regular",
    })
    if days <= 0:
        days = 10
    return max(MIN_DURATION_DAYS, days)


def normalize_historical_timeline(order) -> Dict[str, Any]:
    """
    Historical paper orders were already completed.
    Date Received is the order date; expected/claimed cannot be earlier.
    Completion days is claimed minus received, not elapsed time since 2024.
    """
    from datetime import timedelta

    from historical.local_ocr_parser import coerce_historical_archive_date

    received = coerce_historical_archive_date(getattr(order, "date_received", None))
    expected = coerce_historical_archive_date(getattr(order, "original_estimated_release_date", None))
    claimed = coerce_historical_archive_date(getattr(order, "claimed_date", None))
    duration = official_duration_for_historical_order(order)
    stored_days = getattr(order, "completion_days", None)
    try:
        stored_days = int(stored_days) if stored_days is not None else None
    except (TypeError, ValueError):
        stored_days = None

    days = stored_days
    if received:
        ready = received + timedelta(days=duration)
        if expected is None or expected < received:
            expected = ready
        if claimed is None or claimed < received:
            claimed = expected if expected >= received else ready
        days = (claimed - received).days
        # Recap leftover archive spans (e.g. 717 days), negative dates, and
        # doubled combo sums (FR 25 + MRES 25 = 50). Keep a modest user-edited
        # span that is only slightly longer than the official duration.
        doubled_combo = duration > 0 and days > duration and days >= duration * 2
        if days < 0 or days > MAX_REASONABLE_COMPLETION_DAYS or doubled_combo:
            expected = ready
            claimed = ready
            days = duration
    elif stored_days is not None and (stored_days < 0 or stored_days > MAX_REASONABLE_COMPLETION_DAYS):
        days = duration

    return {
        "date_received": received,
        "expected_release": expected,
        "claimed_date": claimed,
        "completion_days": days,
    }


def _iso_date(value) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)[:10]


def _iso_datetime(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.hour or value.minute or value.second:
            return value.strftime("%Y-%m-%dT%H:%M:%S")
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    return text or None


def serialize_historical_order(order, service_prices: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    from historical.local_ocr_parser import (
        ADDON_CODES,
        _classify_service,
        canonical_brand_name,
        classify_shoe_fields,
        clean_shoe_token,
        coerce_historical_archive_date,
        compute_row_price,
        extract_item_claimed_date,
        format_price_breakdown,
    )

    catalog = service_prices or {}
    timeline = normalize_historical_timeline(order)
    items_out = []
    for item in (getattr(order, "items", None) or []):
        raw_names = [s.service_name for s in (item.services or []) if getattr(s, "service_name", None)]
        base_s, addon_s = [], []
        for name in raw_names:
            token = str(name).strip()
            if token.lower() in {"free", "n/a", "none", "null"}:
                continue
            if _classify_service(token) == "addon" or token.upper() in ADDON_CODES:
                addon_s.append(token)
            else:
                base_s.append(token)
        item_price, is_free = compute_row_price(raw_names, catalog, getattr(item, "item_price", None))
        model, color, material = classify_shoe_fields(
            item.model, item.color, getattr(item, "material", None)
        )
        remarks_raw = getattr(item, "remarks", None)
        remarks_is_free = str(remarks_raw or "").strip().upper() == "FREE"
        is_free_row = bool(is_free) or remarks_is_free
        stored_claimed = _iso_date(coerce_historical_archive_date(getattr(item, "claimed_date", None)))
        parsed_claimed, cleaned_remarks = extract_item_claimed_date(None if remarks_is_free else remarks_raw)
        item_claimed = stored_claimed or parsed_claimed
        remarks_out = None if remarks_is_free else clean_shoe_token(
            cleaned_remarks if item_claimed and cleaned_remarks is not None else remarks_raw
        )
        billed = base_s + addon_s
        stored_prices = []
        for token in billed:
            match = next(
                (
                    s for s in (item.services or [])
                    if str(getattr(s, "service_name", "")).strip() == token
                    and getattr(s, "price", None) not in (None, 0, 0.0)
                ),
                None,
            )
            stored_prices.append(float(match.price) if match is not None else None)
        breakdown = None if (is_free_row or not item_price) else format_price_breakdown(
            billed, catalog, row_total=item_price, stored_prices=stored_prices
        )
        services_out = []
        allocated = None
        if not (is_free_row or not item_price):
            from historical.local_ocr_parser import allocate_service_prices
            allocated = allocate_service_prices(billed, catalog, item_price)
        for idx, token in enumerate(billed):
            from historical.local_ocr_parser import resolve_service_price, service_code_label, _format_catalog_amount
            stored = stored_prices[idx] if idx < len(stored_prices) else None
            price = stored if stored else (allocated[idx] if allocated and idx < len(allocated) else resolve_service_price(token, catalog))
            code = service_code_label(token)
            label = f"{code}({_format_catalog_amount(price)})" if price is not None else code
            services_out.append({
                "service_name": token,
                "service_type": "addon" if token in addon_s else "base",
                "price": float(price) if price is not None else 0,
                "display_label": label,
            })
        items_out.append({
            "historical_item_id": item.historical_item_id,
            "brand": canonical_brand_name(item.brand) or item.brand,
            "model": model,
            "color": color,
            "size": clean_shoe_token(item.size),
            "material": material,
            "priority": item.priority,
            "remarks": remarks_out,
            "claimed_date": item_claimed,
            "item_price": 0.0 if is_free_row else item_price,
            "is_free": is_free_row,
            "price_breakdown": breakdown,
            "services": services_out,
        })

    customer = getattr(order, "customer", None)
    img = getattr(order, "image", None)
    image_filename = getattr(img, "image_filename", None) if img is not None else None
    return {
        "historical_order_id": order.historical_order_id,
        "order_id": order.order_id,
        "customer_name": customer.customer_name if customer else "",
        "contact_number": customer.contact_number if customer else "",
        "branch": order.branch,
        "date_received": _iso_date(timeline["date_received"]) or (order.date_received.isoformat() if order.date_received else None),
        "original_estimated_release_date": _iso_date(timeline["expected_release"]),
        "claimed_date": _iso_date(timeline["claimed_date"]),
        "completion_days": timeline["completion_days"],
        "total_pairs": order.total_pairs,
        "original_grand_total": float(order.original_grand_total) if getattr(order, "original_grand_total", None) not in (None, "") else None,
        "grand_total": float(order.grand_total or 0),
        "discount": (
            round(float(order.original_grand_total) - float(order.grand_total or 0), 2)
            if getattr(order, "original_grand_total", None) not in (None, "")
            and order.grand_total is not None
            and float(order.original_grand_total) > float(order.grand_total or 0)
            else None
        ),
        "downpayment": float(order.downpayment or 0) if order.downpayment not in (None, 0, 0.0) else 0,
        "balance": float(order.balance or 0) if order.balance not in (None, 0, 0.0) else 0,
        "priority": order.priority,
        "payment_method": order.payment_method or "Cash",
        "sync_status": order.sync_status,
        "ocr_status": order.ocr_status,
        "status": order.ocr_status or "Validated",
        "items": items_out,
        "image": {
            "image_filename": image_filename,
            "image_path": getattr(img, "image_path", None),
            "ocr_status": getattr(img, "ocr_status", None),
        } if image_filename else None,
    }


def apply_normalized_timeline(order) -> Dict[str, Any]:
    """Write corrected dates/completion onto the ORM object (validate/save)."""
    timeline = normalize_historical_timeline(order)
    if timeline["date_received"]:
        prev = getattr(order, "date_received", None)
        tod = datetime.min.time()
        if isinstance(prev, datetime) and (prev.hour or prev.minute or prev.second):
            tod = prev.time()
        order.date_received = datetime.combine(timeline["date_received"], tod)
    if timeline["expected_release"]:
        order.original_estimated_release_date = datetime.combine(timeline["expected_release"], datetime.min.time())
    if timeline["claimed_date"]:
        order.claimed_date = datetime.combine(timeline["claimed_date"], datetime.min.time())
    order.completion_days = timeline["completion_days"]
    return timeline


def apply_explicit_completion_days(
    order,
    completion_days,
    claimed_date=None,
    expected_release=None,
) -> None:
    """Keep a user-edited completion span after automatic timeline overlay."""
    from datetime import timedelta

    try:
        days = int(completion_days)
    except (TypeError, ValueError):
        return
    if days < 0:
        return

    received = getattr(order, "date_received", None)
    order.completion_days = days
    if received is None:
        return

    if isinstance(received, datetime):
        received_dt = received.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        received_dt = datetime.combine(received, datetime.min.time())
    ready = received_dt + timedelta(days=days)

    def _as_dt(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.replace(hour=0, minute=0, second=0, microsecond=0)
        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time())
        return None

    claimed_dt = _as_dt(claimed_date)
    expected_dt = _as_dt(expected_release)
    order.claimed_date = claimed_dt if claimed_dt is not None and claimed_dt >= received_dt else ready
    if expected_dt is not None and expected_dt >= received_dt:
        order.original_estimated_release_date = expected_dt
    order.completion_days = days


def _as_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if hasattr(value, "date") and callable(value.date):
        try:
            return value.date()
        except Exception:
            return None
    return None


def persist_normalized_timeline_if_stale(order) -> bool:
    """Persist overlay dates only when stored values are clearly corrupt.

    Do not rewrite intentional user edits from Historical Records (e.g. a
    completion span shorter than the official FR duration).
    """
    received = _as_date(getattr(order, "date_received", None))
    expected = _as_date(getattr(order, "original_estimated_release_date", None))
    claimed = _as_date(getattr(order, "claimed_date", None))
    stored_days = getattr(order, "completion_days", None)
    try:
        stored_days = int(stored_days) if stored_days is not None else None
    except (TypeError, ValueError):
        stored_days = None

    corrupt = False
    if received is None:
        return False
    if claimed is not None and claimed < received:
        corrupt = True
    if expected is not None and expected < received:
        corrupt = True
    if stored_days is not None and (stored_days < 0 or stored_days > MAX_REASONABLE_COMPLETION_DAYS):
        corrupt = True
    if claimed is not None and stored_days is not None:
        span = (claimed - received).days
        if span >= 0 and abs(span - stored_days) > 1 and span > MAX_REASONABLE_COMPLETION_DAYS:
            corrupt = True
    # Extreme leftover archive spans (e.g. 700+ days) still get repaired.
    if claimed is not None and (claimed - received).days > MAX_REASONABLE_COMPLETION_DAYS:
        corrupt = True

    if not corrupt:
        return False
    apply_normalized_timeline(order)
    return True


def _money_or_none(val) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _prefer_extracted_money(stored, *candidates) -> Optional[float]:
    """Prefer an explicit OCR/source amount over a stored default of 0."""
    for candidate in candidates:
        parsed = _money_or_none(candidate)
        if parsed is not None:
            return parsed
    stored_val = _money_or_none(stored)
    if stored_val is not None and stored_val != 0:
        return stored_val
    return None


def enrich_review_fields(order) -> Dict[str, Any]:
    """
    Overlay structured OCR JSON already stored on the order.
    Do NOT re-parse raw text here — that is too slow for a 700+ item queue load.
    """
    raw = latest_raw_ocr(order)
    items = raw.get("items") if isinstance(raw.get("items"), list) else []
    return {
        "grand_total": _prefer_extracted_money(order.grand_total, raw.get("grand_total")),
        "original_grand_total": _prefer_extracted_money(
            getattr(order, "original_grand_total", None),
            raw.get("original_grand_total"),
        ),
        "discount": _money_or_none(raw.get("discount")),
        "downpayment": _prefer_extracted_money(order.downpayment, raw.get("downpayment")),
        "balance": _prefer_extracted_money(order.balance, raw.get("balance")),
        "payment_method": order.payment_method or raw.get("payment_method") or None,
        "date_received": raw.get("date_received"),
        "customer_name": raw.get("customer_name"),
        "contact_number": raw.get("contact_number"),
        "parsed_items": items,
    }


def apply_canonical_id_on_validate(
    order,
    db: Session,
    submitted_id: Optional[str] = None,
    reserved: Optional[List[str]] = None,
) -> str:
    """Persist ORD-YYYY-MM-DD-NNN on validate. Preserve the original document ref in audit_trail."""
    from historical.local_ocr_parser import coerce_historical_archive_date

    old_id = order.order_id
    corrected = coerce_historical_archive_date(order.date_received)
    if corrected:
        prev = order.date_received
        tod = prev.time() if isinstance(prev, datetime) and (prev.hour or prev.minute or prev.second) else datetime.min.time()
        order.date_received = datetime.combine(corrected, tod)
    resolved = resolve_historical_order_id(
        db,
        date_value=order.date_received,
        extracted_order_id=submitted_id if is_canonical_order_id(submitted_id) else None,
        current_order_id=submitted_id if is_canonical_order_id(submitted_id) else order.order_id,
        exclude_historical_order_id=order.historical_order_id,
        reserved=reserved,
    )
    if resolved != old_id:
        trail = list(order.audit_trail or [])
        paper_ref = stored_source_document_ref(order) or source_document_ref(old_id)
        trail.append({
            "timestamp": str(datetime.now()),
            "action": "canonical_order_id",
            "previous_order_id": old_id,
            "source_document_ref": paper_ref,
            "order_id": resolved,
        })
        order.audit_trail = trail
        order.order_id = resolved
    apply_normalized_timeline(order)
    return order.order_id


def _scan_sort_key(filename: str) -> tuple:
    """
    Stable CamScanner / PDF page order within a batch.
    '…15.00_12.jpeg' → (15.00, 12); bare PDFs sort after numbered photos of same batch.
    """
    name = str(filename or "")
    lower = name.lower()
    batch = re.search(r"(\d{1,2}\.\d{2})", name)
    batch_key = batch.group(1) if batch else "99.99"
    page = re.search(r"_(\d+)(?:\.\w+)?$", name)
    if page:
        page_num = int(page.group(1))
    elif "#page" in lower:
        m = re.search(r"#page(\d+)", lower)
        page_num = int(m.group(1)) if m else 0
    elif lower.endswith(".pdf"):
        page_num = 10_000  # whole PDF batches after photo pages
    else:
        page_num = 0
    return (batch_key, page_num, lower)


def sort_review_queue(results: List[Dict[str, Any]]) -> None:
    """
    Chronological review order starting mid-August archive:
    paper date → scan batch/page → image id.
    Uses sort_date (DB date), not the blanked display date, so refreshing
    does not reshuffle the queue when unverified Aug-15 placeholders are hidden.
    """
    def key(item):
        order = (item or {}).get("order") or {}
        sort_date = str(
            (item or {}).get("sort_date")
            or order.get("date_received")
            or "9999-12-31"
        )[:10]
        filename = str((item or {}).get("image_filename") or "")
        image_id = int((item or {}).get("historical_image_id") or 0)
        batch_key, page_num, lower = _scan_sort_key(filename)
        return (sort_date, batch_key, page_num, lower, image_id)

    results.sort(key=key)


def assign_display_order_ids(db: Session, results: List[Dict[str, Any]]) -> None:
    """
    Overlay ORD-YYYY-MM-DD-NNN for the review screen only.
    Paper control numbers (e.g. 082002) and placeholders move into Control No.
    Two column-only queries — never persist here. Validate & Save assigns the real ID.
    """
    from collections import defaultdict

    from models import HistoricalOrder, Order
    from order_numbering import (
        date_prefix,
        is_canonical_order_id,
        next_canonical_order_id,
        parse_order_date,
        source_document_ref,
    )

    live_ids = [
        row[0]
        for row in db.query(Order.order_number).filter(Order.order_number.like("ORD-%")).all()
        if row[0]
    ]
    hist_ids = [
        row[0]
        for row in db.query(HistoricalOrder.order_id).filter(HistoricalOrder.order_id.like("ORD-%")).all()
        if row[0]
    ]
    existing_by_prefix: dict = defaultdict(set)
    for oid in live_ids + hist_ids:
        parts = str(oid).split("-")
        if len(parts) >= 5:
            existing_by_prefix["-".join(parts[:4]) + "-"].add(str(oid))

    reserved: List[str] = []
    for item in results:
        order = item.get("order") or {}
        current_id = order.get("order_id")
        persisted = order.get("persisted_order_id") or current_id
        if is_canonical_order_id(current_id):
            # Keep Control No optional — do not force OCR / paper ref into the field.
            continue
        paper_ref = (
            item.get("source_document_ref")
            or source_document_ref(persisted)
            or source_document_ref(current_id)
        )
        if paper_ref:
            item["source_document_ref"] = paper_ref
        dt = parse_order_date(order.get("date_received"))
        if dt is None:
            continue
        prefix = date_prefix(dt)
        suggested = next_canonical_order_id(dt, list(existing_by_prefix[prefix]), reserved)
        reserved.append(suggested)
        existing_by_prefix[prefix].add(suggested)
        order["order_id"] = suggested


def _build_queue_item(img, order, source: str, db: Session = None, reserved: Optional[List[str]] = None, id_cache=None, service_prices=None):
    """Build a standardised queue item for the frontend review UI."""
    if order is None:
        return None
    try:
        return _build_queue_item_unsafe(
            img, order, source, db=db, reserved=reserved, id_cache=id_cache, service_prices=service_prices
        )
    except Exception as exc:
        print(f"[QUEUE] Skipped historical_order_id={getattr(order, 'historical_order_id', None)}: {exc}")
        return {
            "historical_image_id": img.historical_image_id if img else None,
            "image_filename": img.image_filename if img else None,
            "image_path": img.image_path if img else None,
            "ocr_confidence": img.ocr_confidence if img else 1.0,
            "source": source,
            "missing_fields": ["queue_build_error"],
            "source_document_ref": getattr(order, "order_id", None),
            "payment_warnings": [],
            "order": {
                "historical_order_id": order.historical_order_id,
                "order_id": order.order_id,
                "persisted_order_id": order.order_id,
                "customer": {
                    "name": getattr(getattr(order, "customer", None), "customer_name", None),
                    "contact": getattr(getattr(order, "customer", None), "contact_number", None),
                },
                "date_received": str(order.date_received) if order.date_received else None,
                "expected_release_date": str(order.original_estimated_release_date) if order.original_estimated_release_date else None,
                "claimed_date": str(order.claimed_date) if order.claimed_date else None,
                "completion_days": order.completion_days,
                "priority": order.priority,
                "branch": order.branch,
                "grand_total": float(order.grand_total) if order.grand_total is not None else None,
                "downpayment": float(order.downpayment) if order.downpayment not in (None, 0, 0.0) else None,
                "balance": float(order.balance) if order.balance not in (None, 0, 0.0) else None,
                "payment_method": order.payment_method or "Cash",
                "items": [],
            },
        }


def _money_col(val) -> Optional[float]:
    parsed = _money_or_none(val)
    if parsed is None or parsed == 0:
        return None
    return parsed


def _build_queue_item_unsafe(img, order, source: str, db: Session = None, reserved: Optional[List[str]] = None, id_cache=None, service_prices=None):
    """Fast queue serializer. Does not read audit_trail JSON."""
    from historical.local_ocr_parser import (
        ADDON_CODES,
        _classify_service,
        canonical_brand_name,
        classify_shoe_fields,
        clean_shoe_token,
        coerce_historical_archive_date,
        compute_row_price,
        format_price_breakdown,
    )

    if service_prices is None and db is not None:
        service_prices = load_service_price_map(db)
    catalog = service_prices or {}

    missing_fields = []
    if not order.priority:
        missing_fields.append("priority")

    items_data = []
    for i in sorted(
        (order.items or []),
        key=lambda row: (getattr(row, "historical_item_id", None) or 0),
    ):
        if not i.brand:
            missing_fields.append(f"pair_{i.historical_item_id}_brand")
        conditions_list = []
        if getattr(i, 'scratches', False): conditions_list.append("Scratches")
        if getattr(i, 'yellowing', False): conditions_list.append("Yellowing")
        if getattr(i, 'sole_separation', False): conditions_list.append("Sole Separation")
        if getattr(i, 'deep_stains', False): conditions_list.append("Deep Stains")
        if getattr(i, 'rips_holes', False): conditions_list.append("Rips/Holes")
        if getattr(i, 'worn_out', False): conditions_list.append("Worn Out")

        raw_names = [s.service_name for s in (i.services or []) if s.service_name]
        base_s, addon_s = [], []
        for name in raw_names:
            token = str(name).strip()
            if token.lower() in {"free", "n/a", "none", "null"}:
                continue
            if _classify_service(token) == "addon" or token.upper() in ADDON_CODES:
                addon_s.append(token)
            else:
                base_s.append(token)

        remarks_raw = getattr(i, "remarks", None)
        remarks_text = str(remarks_raw or "").strip()
        remarks_is_free = remarks_text.upper() == "FREE" or remarks_text.upper().startswith("FREE;")
        from historical.local_ocr_parser import extract_item_claimed_date
        stored_claimed = _iso_date(coerce_historical_archive_date(getattr(i, "claimed_date", None)))
        remark_for_claim = remarks_text
        if remarks_is_free and remarks_text.upper().startswith("FREE"):
            remark_for_claim = remarks_text[5:].lstrip(" ;")
        parsed_claimed, cleaned_remarks = extract_item_claimed_date(
            None if remarks_text.upper() == "FREE" else remark_for_claim
        )
        item_claimed = stored_claimed or parsed_claimed
        remarks_display = None if remarks_text.upper() == "FREE" else clean_shoe_token(
            cleaned_remarks if item_claimed and cleaned_remarks is not None else (
                remarks_text[5:].lstrip(" ;") if remarks_is_free and remarks_text.upper().startswith("FREE") else remarks_raw
            )
        )
        item_price, is_free = compute_row_price(
            raw_names,
            catalog,
            getattr(i, "item_price", None) if not remarks_is_free else 0,
        )
        is_free_row = bool(is_free) or remarks_is_free
        if is_free_row:
            item_price = 0.0
        if item_price is None and not is_free_row:
            missing_fields.append(f"pair_{i.historical_item_id}_item_price")
        model, color, material = classify_shoe_fields(
            i.model,
            i.color,
            getattr(i, "material", None),
        )
        billed_names = base_s + addon_s
        stored_prices = []
        for token in billed_names:
            match = next(
                (
                    s for s in (i.services or [])
                    if str(getattr(s, "service_name", "")).strip() == token
                    and getattr(s, "price", None) not in (None, 0, 0.0)
                ),
                None,
            )
            stored_prices.append(float(match.price) if match is not None else None)
        breakdown = None if (is_free_row or not item_price) else format_price_breakdown(
            billed_names, catalog, row_total=item_price, stored_prices=stored_prices
        )
        services_out = []
        if not (is_free_row or not item_price):
            from historical.local_ocr_parser import allocate_service_prices, resolve_service_price, service_code_label, _format_catalog_amount
            allocated = allocate_service_prices(billed_names, catalog, item_price)
            for idx, token in enumerate(billed_names):
                price = allocated[idx] if allocated and idx < len(allocated) else resolve_service_price(token, catalog)
                code = service_code_label(token)
                label = f"{code}({_format_catalog_amount(price)})" if price is not None else code
                services_out.append({
                    "service_name": token,
                    "service_type": "addon" if token in addon_s else "base",
                    "price": float(price) if price is not None else 0,
                    "display_label": label,
                })

        items_data.append({
            "historical_item_id": i.historical_item_id,
            "model": model,
            "brand": canonical_brand_name(i.brand) or i.brand,
            "color": color,
            "size": clean_shoe_token(i.size),
            "material": material,
            "priority": i.priority,
            "remarks": remarks_display,
            "claimed_date": item_claimed,
            "base_services": base_s,
            "addon_services": addon_s,
            "conditions": conditions_list,
            "item_price": 0.0 if is_free_row else item_price,
            "is_free": is_free_row,
            "price_breakdown": breakdown if not is_free_row else None,
            "services": services_out,
        })

    dp = _money_col(order.downpayment)
    bal = _money_col(order.balance)
    gt = _money_or_none(order.grand_total)
    if gt == 0:
        gt = None
    raw_ocr = latest_raw_ocr(order)
    if not isinstance(raw_ocr, dict):
        raw_ocr = {}
    original_gt = _prefer_extracted_money(
        getattr(order, "original_grand_total", None),
        raw_ocr.get("original_grand_total"),
    )
    discount_amt = _money_or_none(raw_ocr.get("discount"))
    if (
        discount_amt is None
        and original_gt is not None
        and gt is not None
        and original_gt > gt
    ):
        discount_amt = round(original_gt - gt, 2)
    if dp is None:
        missing_fields.append("downpayment")
    if bal is None:
        missing_fields.append("balance")
    if gt is None:
        missing_fields.append("grand_total")

    suggested_id = order.order_id
    customer_name = None
    customer_contact = None
    if order.customer:
        customer_name = getattr(order.customer, "customer_name", None)
        customer_contact = getattr(order.customer, "contact_number", None)

    received_raw = getattr(order, "date_received", None)
    timeline = normalize_historical_timeline(order)
    received = timeline.get("date_received") or coerce_historical_archive_date(received_raw)
    expected = timeline.get("expected_release")
    claimed = timeline.get("claimed_date")
    raw_ocr = latest_raw_ocr(order) or {}
    raw_received = raw_ocr.get("date_received") if isinstance(raw_ocr, dict) else None

    from historical.ocr_engine import is_unverified_received_sentinel, parse_date as parse_ocr_date

    trail = order.audit_trail or []
    if isinstance(trail, dict):
        trail = [trail]
    date_unverified_flag = False
    for entry in reversed(trail if isinstance(trail, list) else []):
        if not isinstance(entry, dict):
            continue
        if "date_received_unverified" in entry:
            date_unverified_flag = bool(entry.get("date_received_unverified"))
            break

    raw_dt = parse_ocr_date(raw_received) if raw_received else None
    date_str: Optional[str] = None
    expected_str: Optional[str] = None
    claimed_str: Optional[str] = None

    # Prefer paper DATE & TIME from OCR (includes clock) over DB placeholder midnight.
    if raw_dt is not None:
        date_str = _iso_datetime(raw_dt)
        received = coerce_historical_archive_date(raw_dt) or received
        date_unverified_flag = False
        expected_str = _iso_date(expected)
        claimed_str = _iso_date(claimed)
    elif isinstance(received_raw, datetime) and (received_raw.hour or received_raw.minute):
        date_str = _iso_datetime(received_raw)
        date_unverified_flag = False
        expected_str = _iso_date(expected)
        claimed_str = _iso_date(claimed)
    elif date_unverified_flag or (
        is_unverified_received_sentinel(received_raw)
        and not raw_received
        and not any(
            getattr(i, "brand", None) or getattr(i, "item_price", None) is not None
            for i in (order.items or [])
        )
    ):
        # Hide the fake Aug 15 midnight default used when OCR never read DATE & TIME.
        date_str = None
        expected_str = None
        claimed_str = None
        date_unverified_flag = True
        if "date_received" not in missing_fields:
            missing_fields.append("date_received")
    else:
        date_str = _iso_date(received)
        expected_str = _iso_date(expected)
        claimed_str = _iso_date(claimed)

    completion_days = timeline.get("completion_days")
    if date_unverified_flag:
        completion_days = getattr(order, "completion_days", None)
    elif completion_days is None:
        completion_days = getattr(order, "completion_days", None)
        if received and claimed:
            span = (claimed - received).days
            if span >= 0:
                completion_days = span

    persisted_id = getattr(order, "order_id", None)
    paper_ref = stored_source_document_ref(order)
    if not paper_ref and persisted_id and not is_canonical_order_id(persisted_id):
        paper_ref = source_document_ref(persisted_id)
    if not paper_ref and isinstance(raw_ocr, dict):
        paper_ref = source_document_ref(raw_ocr.get("order_id"))
    # Control No is optional paper-form data; OCR tracking id stays on source_document_ref only.
    control_found, control_override = stored_control_no(order)
    if control_found:
        control_no = control_override or None
    else:
        control_no = None
    rush_fee = stored_rush_fee(order)
    if rush_fee is None and str(order.priority or "").lower() == "rush":
        rush_fee = 150.0

    # Always prefer a display ORD- id; keep paper control separately.
    if not is_canonical_order_id(suggested_id) and id_cache is not None:
        generated = id_cache.suggest(order.date_received)
        if generated:
            suggested_id = generated

    note_bits = []
    for row in items_data:
        remark = row.get("remarks")
        if remark:
            note_bits.append(str(remark))
    form_notes = raw_ocr.get("special_instructions") if isinstance(raw_ocr, dict) else None
    order_notes = form_notes or ("; ".join(dict.fromkeys(note_bits)) or None)
    raw_text_summary = ""
    if isinstance(raw_ocr, dict):
        raw_text_summary = str(raw_ocr.get("raw_text_summary") or "").strip()
    ocr_empty = (not items_data) or all(
        not row.get("brand") and row.get("item_price") in (None, "", 0) and not (row.get("base_services") or row.get("addon_services"))
        for row in items_data
    )

    return {
        "historical_image_id": img.historical_image_id if img else None,
        "image_filename": img.image_filename if img else None,
        "image_path": img.image_path if img else None,
        "ocr_confidence": img.ocr_confidence if img else 1.0,
        "source": source,
        "missing_fields": missing_fields,
        "source_document_ref": paper_ref,
        "payment_warnings": [],
        "ocr_empty": ocr_empty,
        "raw_text_summary": raw_text_summary or None,
        "date_received_unverified": date_unverified_flag,
        # Stable chronological key for queue sorting (DB date, never blanked for display).
        "sort_date": _iso_date(coerce_historical_archive_date(received_raw) or received_raw),
        "order": {
            "historical_order_id": order.historical_order_id,
            "order_id": suggested_id,
            "persisted_order_id": order.order_id,
            "control_no": control_no,
            "notes": order_notes,
            "customer": {
                "name": customer_name,
                "contact": customer_contact,
            },
            "date_received": date_str,
            "expected_release_date": expected_str,
            "claimed_date": claimed_str,
            "completion_days": completion_days,
            "priority": order.priority,
            "rush_fee": rush_fee,
            "branch": order.branch,
            "original_grand_total": original_gt,
            "discount": discount_amt,
            "discount_type": (raw_ocr.get("discount_type") if isinstance(raw_ocr, dict) else None) or (
                "amount" if discount_amt else None
            ),
            "discount_percent": _money_or_none(raw_ocr.get("discount_percent")) if isinstance(raw_ocr, dict) else None,
            "grand_total": gt,
            "downpayment": dp,
            "balance": bal,
            "payment_method": order.payment_method or "Cash",
            "items": items_data,
        },
    }


# ─── 2. Validate / Approve / Reject ──────────────────────────────────────────

def apply_order_corrections(order, corrections, db: Session, assign_canonical_id: bool = True):
    if not corrections:
        return
    items = list(order.items or [])
    for field, value in corrections.items():
        if field == "items":
            from models import HistoricalItem, HistoricalItemService
            from historical.local_ocr_parser import allocate_service_prices, coerce_historical_archive_date

            incoming = [row for row in (value or []) if isinstance(row, dict)]
            kept_ids = set()

            def _apply_item_fields(db_item, item_data):
                for item_field in ["brand", "model", "color", "size", "material", "item_price", "priority", "remarks", "claimed_date"]:
                    if item_field not in item_data:
                        continue
                    val = item_data[item_field]
                    if item_field == "claimed_date":
                        if val in ("", None):
                            val = None
                        else:
                            parsed = coerce_historical_archive_date(val)
                            val = datetime.combine(parsed, datetime.min.time()) if parsed else None
                        setattr(db_item, item_field, val)
                        continue
                    if item_field == "item_price" and val == "":
                        val = None
                    elif item_field == "item_price" and (
                        item_data.get("is_free") is True
                        or (isinstance(val, str) and val.strip().lower() == "free")
                    ):
                        val = 0.0
                        existing = (db_item.remarks or "").strip()
                        if not existing:
                            db_item.remarks = "FREE"
                        elif "FREE" not in existing.upper():
                            db_item.remarks = f"FREE; {existing}"
                    elif item_field == "item_price" and val is not None:
                        try:
                            if isinstance(val, str) and "+" in val:
                                parts = [
                                    float(part.replace("=", "").replace(",", "").replace("₱", "").strip())
                                    for part in val.split("+")
                                    if part.replace("=", "").replace(",", "").replace("₱", "").strip()
                                ]
                                val = round(sum(parts), 2) if parts else None
                            else:
                                val = float(val)
                        except (TypeError, ValueError):
                            val = None
                    setattr(db_item, item_field, val)

                if "base_services" in item_data or "addon_services" in item_data:
                    for s in list(db_item.services):
                        db.delete(s)

                    base_list = item_data.get("base_services", []) or []
                    addon_list = item_data.get("addon_services", []) or []
                    billed_names = []
                    for raw_name in list(base_list) + list(addon_list):
                        name = str(raw_name).strip()
                        if name and name.lower() not in {"free", "n/a", "none"}:
                            billed_names.append(name)
                    incoming_prices = item_data.get("service_prices") or {}
                    price_map = {}
                    if isinstance(incoming_prices, dict):
                        for key, raw_price in incoming_prices.items():
                            try:
                                amount = float(raw_price)
                            except (TypeError, ValueError):
                                continue
                            if amount >= 0:
                                price_map[str(key).strip()] = amount

                    def _group_price(raw):
                        if raw in (None, ""):
                            return None
                        try:
                            return float(raw)
                        except (TypeError, ValueError):
                            return None

                    base_amount = _group_price(item_data.get("base_service_price"))
                    addon_amount = _group_price(item_data.get("addon_service_price"))
                    if base_amount is not None:
                        first_base = next((str(b).strip() for b in base_list if str(b).strip()), None)
                        if first_base:
                            price_map[first_base] = base_amount
                    if addon_amount is not None:
                        first_addon = next((str(a).strip() for a in addon_list if str(a).strip()), None)
                        if first_addon:
                            price_map[first_addon] = addon_amount
                    if not price_map and not item_data.get("prices_manual") and not item_data.get("is_free"):
                        catalog = load_service_price_map(db)
                        addends = item_data.get("price_addends")
                        allocated = allocate_service_prices(
                            billed_names,
                            catalog,
                            item_data.get("item_price"),
                            addends if isinstance(addends, list) else None,
                        )
                        price_map = {
                            name: amount
                            for name, amount in zip(billed_names, allocated)
                            if amount is not None
                        }
                    for b in base_list:
                        name = str(b).strip()
                        if name and name.lower() not in {"free", "n/a", "none"}:
                            db.add(HistoricalItemService(
                                historical_item_id=db_item.historical_item_id,
                                service_name=name,
                                service_type="base",
                                price=price_map.get(name, 0) or 0,
                            ))
                    for a in addon_list:
                        name = str(a).strip()
                        if name and name.lower() not in {"free", "n/a", "none"}:
                            db.add(HistoricalItemService(
                                historical_item_id=db_item.historical_item_id,
                                service_name=name,
                                service_type="addon",
                                price=price_map.get(name, 0) or 0,
                            ))

                if "conditions" in item_data:
                    cond_list = [str(c).lower().strip() for c in (item_data["conditions"] or [])]
                    db_item.scratches = "scratches" in cond_list
                    db_item.yellowing = "yellowing" in cond_list
                    db_item.sole_separation = "sole separation" in cond_list
                    db_item.deep_stains = "deep stains" in cond_list
                    db_item.rips_holes = ("rips/holes" in cond_list or "rips / holes" in cond_list)
                    db_item.worn_out = "worn out" in cond_list

            for idx, item_data in enumerate(incoming):
                item_id = item_data.get("historical_item_id")
                db_item = None
                if item_id:
                    db_item = next((i for i in items if i.historical_item_id == item_id), None)
                if db_item is None and idx < len(items):
                    # Prefer unused existing rows when editing without ids
                    candidate = items[idx]
                    if candidate.historical_item_id not in kept_ids:
                        db_item = candidate
                if db_item is None:
                    db_item = HistoricalItem(historical_order_id=order.historical_order_id)
                    db.add(db_item)
                    db.flush()
                    items.append(db_item)

                _apply_item_fields(db_item, item_data)
                kept_ids.add(db_item.historical_item_id)

            for old_item in list(items):
                if old_item.historical_item_id not in kept_ids:
                    db.delete(old_item)

        elif field == "customer":
            if order.customer and isinstance(value, dict):
                name = value.get("name") or value.get("customer_name")
                contact = value.get("contact") or value.get("contact_number")
                if name:
                    if hasattr(order.customer, "customer_name"):
                        order.customer.customer_name = name
                    elif hasattr(order.customer, "name"):
                        order.customer.name = name
                if contact is not None:
                    if hasattr(order.customer, "contact_number"):
                        order.customer.contact_number = contact
        elif field == "order_id":
            continue
        elif field == "control_no":
            cleaned = ""
            if value not in (None, ""):
                cleaned = source_document_ref(value) or str(value).strip()
            trail = list(order.audit_trail or [])
            trail.append({
                "timestamp": str(datetime.now()),
                "action": "control_no",
                "control_no": cleaned,
            })
            order.audit_trail = trail
            try:
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(order, "audit_trail")
            except Exception:
                pass
            continue
        elif field == "rush_fee":
            amount = _money_or_none(value)
            trail = list(order.audit_trail or [])
            trail.append({
                "timestamp": str(datetime.now()),
                "action": "rush_fee",
                "rush_fee": amount,
            })
            order.audit_trail = trail
            try:
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(order, "audit_trail")
            except Exception:
                pass
            continue
        elif field in ("source_document_ref", "persisted_order_id", "historical_order_id", "audit_trail", "notes"):
            continue
        elif field in ("date_received", "claimed_date", "original_estimated_release_date", "expected_release_date"):
            target = "original_estimated_release_date" if field == "expected_release_date" else field
            if value in ("", None):
                if field != "date_received":
                    setattr(order, target, None)
                continue
            try:
                from historical.ocr_engine import parse_date as parse_ocr_date
                from historical.local_ocr_parser import coerce_historical_archive_date
                parsed = parse_ocr_date(value)
                if parsed is None:
                    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00").replace(" ", "T")).replace(tzinfo=None)
                corrected = coerce_historical_archive_date(parsed)
                if corrected:
                    tod = parsed.time() if (parsed.hour or parsed.minute or parsed.second) else datetime.min.time()
                    parsed = datetime.combine(corrected, tod)
                setattr(order, target, parsed)
                if field == "date_received":
                    trail = list(order.audit_trail or [])
                    trail.append({
                        "timestamp": str(datetime.now()),
                        "action": "date_received_corrected",
                        "date_received_unverified": False,
                        "date_received": parsed.isoformat(sep="T", timespec="minutes"),
                    })
                    order.audit_trail = trail
                    try:
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(order, "audit_trail")
                    except Exception:
                        pass
            except Exception:
                pass
        elif field in ("grand_total", "original_grand_total", "downpayment", "balance"):
            setattr(order, field, _money_or_none(value))
        elif field in ("discount", "discount_type", "discount_percent", "discount_value"):
            # Persisted on the OCR audit blob below (no dedicated columns).
            continue
        elif hasattr(order, field):
            if value == "":
                value = None
            setattr(order, field, value)

    submitted_id = corrections.get("order_id")
    if assign_canonical_id:
        apply_canonical_id_on_validate(order, db, submitted_id=submitted_id)
    apply_normalized_timeline(order)

    # Keep balance coherent with the final (discounted) grand total when both sides are present.
    final_total = _money_or_none(getattr(order, "grand_total", None))
    down = _money_or_none(getattr(order, "downpayment", None))
    if final_total is not None:
        final_total = max(0.0, float(final_total))
        order.grand_total = final_total
    if final_total is not None and down is not None:
        down = max(0.0, float(down))
        if down > final_total:
            down = final_total
            order.downpayment = down
        if corrections.get("balance") in (None, ""):
            order.balance = round(max(0.0, final_total - down), 2)
        else:
            bal = _money_or_none(getattr(order, "balance", None))
            if bal is not None and bal < 0:
                order.balance = 0
    elif final_total is not None:
        bal = _money_or_none(getattr(order, "balance", None))
        if bal is not None and bal < 0:
            order.balance = 0

    # Keep discount metadata on the latest OCR audit entry for queue round-trips.
    discount_amt = _money_or_none(corrections.get("discount"))
    if discount_amt is None:
        orig = _money_or_none(getattr(order, "original_grand_total", None))
        if orig is not None and final_total is not None and orig > final_total:
            discount_amt = round(orig - final_total, 2)
    if any(
        corrections.get(k) not in (None, "")
        for k in ("discount", "discount_type", "discount_percent", "discount_value", "original_grand_total")
    ):
        trail_raw = list(order.audit_trail or [])
        patch = {
            "discount": discount_amt,
            "discount_type": corrections.get("discount_type") or "amount",
            "discount_percent": _money_or_none(corrections.get("discount_percent")),
            "discount_value": corrections.get("discount_value"),
            "original_grand_total": _money_or_none(getattr(order, "original_grand_total", None)),
            "grand_total": final_total,
        }
        if trail_raw and isinstance(trail_raw[-1], dict):
            raw = dict(trail_raw[-1].get("raw_ocr") or {})
            raw.update({k: v for k, v in patch.items() if v is not None})
            trail_raw[-1] = {**trail_raw[-1], "raw_ocr": raw}
            order.audit_trail = trail_raw
            try:
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(order, "audit_trail")
            except Exception:
                pass

    trail = list(order.audit_trail or [])
    trail.append({"timestamp": str(datetime.now()), "changes": "Applied manual corrections"})
    if corrections.get("original_grand_total") not in (None, "") or corrections.get("discount") not in (None, ""):
        trail.append({
            "timestamp": str(datetime.now()),
            "action": "discount_totals",
            "original_grand_total": _money_or_none(getattr(order, "original_grand_total", None)),
            "grand_total": _money_or_none(getattr(order, "grand_total", None)),
            "discount": discount_amt,
            "discount_type": corrections.get("discount_type"),
            "discount_percent": _money_or_none(corrections.get("discount_percent")),
        })
    order.audit_trail = trail
    try:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(order, "audit_trail")
    except Exception:
        pass


def apply_queue_review_action(action: str, img, order, corrections, db: Session) -> str:
    """
    approve  = finalize and leave the review queue
    reject   = flag and leave the review queue
    save/correct = persist edits and stay PENDING_REVIEW
    """
    action = str(action or "").strip().lower()
    if action == "reject":
        if img is not None:
            img.ocr_status = REJECTED
            img.processed_at = datetime.now()
        if order is not None:
            order.ocr_status = REJECTED
        return REJECTED
    if action == "approve":
        if order is not None:
            if corrections:
                apply_order_corrections(order, corrections, db, assign_canonical_id=True)
            else:
                apply_canonical_id_on_validate(order, db)
            order.ocr_status = VALIDATED
            order.sync_status = "synced"
        if img is not None:
            img.ocr_status = VALIDATED
            img.processed_at = datetime.now()
        return VALIDATED
    if action in ("correct", "save", "draft"):
        if order is not None and corrections:
            apply_order_corrections(order, corrections, db, assign_canonical_id=False)
        return "saved"
    raise HTTPException(status_code=400, detail="Invalid review action.")


@router.post("/validate/{historical_image_id}")
def approve_historical_item(
    historical_image_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Approves, corrects, or rejects an OCR extraction."""
    img = db.query(HistoricalImage).filter(HistoricalImage.historical_image_id == historical_image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    result = apply_queue_review_action(
        payload.get("action"),
        img,
        img.order,
        payload.get("corrections") or {},
        db,
    )
    db.commit()
    return {"status": "success", "new_status": img.ocr_status, "action": result}


@router.post("/reocr/{historical_image_id}")
def reocr_historical_image(
    historical_image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Re-run OCR for a single queue image and merge results into the linked order.
    Interactive path: faster Gemini retries, skip EasyOCR cold-start, supports cancel.
    """
    from pathlib import Path
    from historical.ocr_engine import (
        OcrCancelled,
        clear_ocr_cancel,
        extract_from_file,
        extraction_is_usable,
        request_ocr_cancel,
    )
    from historical_ocr_import import apply_extraction_to_order

    img = db.query(HistoricalImage).filter(HistoricalImage.historical_image_id == historical_image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    order = img.order
    if order is None:
        raise HTTPException(status_code=404, detail="Linked historical order not found")

    path = Path(img.image_path) if img.image_path else None
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Source image file is missing on disk")

    cancel_key = f"reocr-{historical_image_id}"
    clear_ocr_cancel(cancel_key)
    try:
        page_results = extract_from_file(
            path,
            interactive=True,
            cancel_key=cancel_key,
            local_engine="tesseract",
        )
    except OcrCancelled:
        clear_ocr_cancel(cancel_key)
        raise HTTPException(status_code=409, detail="OCR cancelled")
    except Exception as exc:
        clear_ocr_cancel(cancel_key)
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    finally:
        clear_ocr_cancel(cancel_key)

    if not page_results:
        raise HTTPException(status_code=500, detail="OCR returned no pages")

    _, extracted, confidence, engine = page_results[0]
    apply_extraction_to_order(db, order, extracted, engine, confidence)
    img.ocr_confidence = confidence
    img.ocr_version = engine
    img.processed_at = datetime.now()
    db.commit()
    db.refresh(order)
    db.refresh(img)

    rebuilt = _build_queue_item(img, order, source="ocr_pending", db=db)
    return {
        "status": "success",
        "usable": extraction_is_usable(extracted),
        "engine": engine,
        "confidence": confidence,
        "item": rebuilt,
    }


@router.post("/reocr/{historical_image_id}/cancel")
def cancel_reocr_historical_image(
    historical_image_id: int,
    current_user: User = Depends(require_role("admin")),
):
    """Signal an in-flight interactive Re-OCR job to stop between attempts."""
    from historical.ocr_engine import request_ocr_cancel
    request_ocr_cancel(f"reocr-{historical_image_id}")
    return {"status": "cancelling", "historical_image_id": historical_image_id}

@router.post("/validate-order/{historical_order_id}")
def validate_order_record(
    historical_order_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Approve or correct a record that has missing fields but no associated image
    (i.e., manually entered or bulk-imported records).
    """
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == historical_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = apply_queue_review_action(
        payload.get("action"),
        getattr(order, "image", None),
        order,
        payload.get("corrections") or {},
        db,
    )
    db.commit()
    return {"status": "success", "historical_order_id": historical_order_id, "action": result}


# ─── 3. Stats Endpoint (for ML Training tab) ─────────────────────────────────

@router.get("/stats")
def get_historical_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Returns counts that the ML Training and Records tabs can display live.
    """
    total = db.query(HistoricalOrder).count()
    validated = db.query(HistoricalOrder).filter(
        HistoricalOrder.claimed_date.isnot(None),
        HistoricalOrder.completion_days.isnot(None),
    ).count()
    missing_fields = db.query(HistoricalOrder).filter(
        (HistoricalOrder.completion_days == None) |
        (HistoricalOrder.claimed_date == None)
    ).count()
    pending_ocr = db.query(HistoricalImage).filter(
        HistoricalImage.ocr_status.in_(pending_filter_values())
    ).count()
    pending_review = _count_review_queue_total(db)
    return {
        "total": total,
        "validated": validated,
        "missing_fields": missing_fields,
        "pending_ocr": pending_ocr,
        "pending_review": pending_review,
        "ready_for_training": validated,
    }


# ─── 4. Bulk JSON Import ──────────────────────────────────────────────────────

@router.post("/bulk-import")
def bulk_import_records(
    payload: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Accepts a JSON array of historical job orders extracted by an AI tool.
    Each record is validated against business rules and inserted with
    sync_status='pending' for human review.

    Business rules enforced:
    - Order date must be between Aug 15 2025 and Jan 31 2026
    - Claimed date cannot be before order date
    - Completion days cannot be negative
    - Completion days cannot be negative
    """
    BUSINESS_START = date(2025, 8, 15)
    BUSINESS_END = date(2026, 1, 31)

    inserted = 0
    skipped = 0
    errors = []

    for idx, record in enumerate(payload):
        try:
            # ── Parse dates ───────────────────────────────────────────────────
            def parse_date(val) -> Optional[date]:
                if not val:
                    return None
                if isinstance(val, date):
                    return val
                try:
                    return datetime.fromisoformat(str(val).strip()).date()
                except Exception:
                    return None

            order_date = parse_date(record.get("date_received") or record.get("order_date"))
            expected_release = parse_date(record.get("original_estimated_release_date"))
            claimed = parse_date(record.get("claimed_date"))
            completed = parse_date(record.get("completed_date") or record.get("actual_completion_date"))

            # ── Business rule: date range ──────────────────────────────────────
            if order_date and (order_date < BUSINESS_START or order_date > BUSINESS_END):
                errors.append({
                    "index": idx,
                    "order_id": record.get("order_id"),
                    "error": f"Order date {order_date} is outside the valid business range (Aug 15 2025 – Jan 31 2026). Skipped."
                })
                skipped += 1
                continue

            # ── Business rule: claimed date fallback ───────────────────────────
            claimed_date_source = "actual"

            # ── Business rule: completion days ─────────────────────────────────
            completion_days = None
            if completed and order_date:
                completion_days = (completed - order_date).days
            elif claimed and order_date:
                completion_days = (claimed - order_date).days

            if completion_days is not None and completion_days < 0:
                errors.append({
                    "index": idx,
                    "order_id": record.get("order_id"),
                    "error": "Completion days is negative. Check dates."
                })
                completion_days = None  # store as NULL rather than skip

            # ── Check for duplicate order_id ──────────────────────────────────
            order_id = str(record.get("order_id") or "")
            if order_id:
                existing = db.query(HistoricalOrder).filter(HistoricalOrder.order_id == order_id).first()
                if existing:
                    errors.append({"index": idx, "order_id": order_id, "error": "Duplicate order_id. Skipped."})
                    skipped += 1
                    continue

            # ── Create HistoricalOrder ─────────────────────────────────────────
            new_order = HistoricalOrder(
                order_id=order_id or f"IMPORT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{idx}",
                branch=record.get("branch", "Villamor"),
                date_received=order_date,
                original_estimated_release_date=expected_release,
                claimed_date=claimed,
                completion_days=completion_days,
                grand_total=float(record.get("grand_total") or record.get("total") or 0),
                downpayment=float(record.get("downpayment") or record.get("amount_paid") or 0),
                total_pairs=int(record.get("total_pairs") or record.get("number_of_pairs") or 1),
                priority=str(record.get("priority") or "regular").lower(),
                sync_status="pending",
                status="completed",
                audit_trail=[{
                    "timestamp": str(datetime.now()),
                    "action": "bulk_import",
                    "claimed_date_source": claimed_date_source,
                    "import_confidence": record.get("confidence_score"),
                }],
            )
            db.add(new_order)
            db.flush()  # get the ID

            # ── Create HistoricalCustomer ──────────────────────────────────────
            customer_data = record.get("customer") or {}
            if isinstance(customer_data, str):
                customer_data = {"name": customer_data}
            cust_name = customer_data.get("name") or record.get("customer_name", "")
            cust_contact = customer_data.get("contact") or customer_data.get("contact_number") or record.get("contact_number", "")
            if cust_name:
                db.add(HistoricalCustomer(
                    historical_order_id=new_order.historical_order_id,
                    name=cust_name,
                    contact_number=cust_contact,
                ))

            # ── Create HistoricalItems + Services ─────────────────────────────
            shoes = record.get("shoes") or record.get("items") or record.get("pairs") or []
            for shoe in shoes:
                if isinstance(shoe, str):
                    continue
                new_item = HistoricalItem(
                    historical_order_id=new_order.historical_order_id,
                    brand=shoe.get("brand", ""),
                    model=shoe.get("model", ""),
                    color=shoe.get("color", ""),
                    size=str(shoe.get("size", "")),
                    material=shoe.get("material") or shoe.get("shoe_type", ""),
                    priority=str(shoe.get("priority") or record.get("priority") or "regular").lower(),
                    remarks=shoe.get("remarks", ""),
                )
                db.add(new_item)
                db.flush()

                services = shoe.get("services") or []
                KNOWN_ADDONS = {'mret', 'mr', 'mres', 'minor retouch', 'minor reglue', 'minor restoration', 'retouch', 'reglue'}
                for svc in services:
                    if isinstance(svc, str):
                        s_name = svc
                        s_name_lower = s_name.lower().strip()
                        s_type = "addon" if any(a in s_name_lower for a in KNOWN_ADDONS) else "base"
                        db.add(HistoricalItemService(
                            historical_item_id=new_item.historical_item_id,
                            service_name=s_name,
                            service_type=s_type,
                            price=0,
                        ))
                    elif isinstance(svc, dict):
                        s_name = svc.get("service_name") or svc.get("name", "")
                        # If OCR didn't provide a valid type, or provided 'base' incorrectly, we override it if it's a known add-on
                        s_type = svc.get("service_type", "base")
                        s_name_lower = s_name.lower().strip()
                        if any(a in s_name_lower for a in KNOWN_ADDONS):
                            s_type = "addon"
                        db.add(HistoricalItemService(
                            historical_item_id=new_item.historical_item_id,
                            service_name=s_name,
                            service_type=s_type,
                            price=float(svc.get("price", 0)),
                        ))

            inserted += 1

        except Exception as e:
            errors.append({"index": idx, "order_id": record.get("order_id"), "error": str(e)})
            skipped += 1

    db.commit()
    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors,
    }


