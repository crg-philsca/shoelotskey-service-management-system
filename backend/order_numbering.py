"""
Authoritative Shoelotskey Job Order ID generation.

Mirrors the live Job Order form rule in src/app/components/JobOrderForm.tsx:

    ORD-YYYY-MM-DD-NNN

where NNN is the next 3-digit sequence after the highest existing ID for that date.
Used by both live Job Order creation (fallback) and Historical OCR review.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable, Optional, Sequence, Set, Union

from sqlalchemy.orm import Session


def normalize_customer_name(value: Optional[str]) -> str:
    """Store names as ``First M. Last`` instead of all-caps/OCR casing."""
    if not value:
        return ""
    words = re.sub(r"\s+", " ", str(value).strip()).split(" ")
    normalized = []
    for word in words:
        parts = re.split(r"([-'])", word)
        fixed = []
        for part in parts:
            if part in {"-", "'"}:
                fixed.append(part)
            elif part:
                bare = part.rstrip(".")
                suffix = "." if len(bare) == 1 else ("." if part.endswith(".") else "")
                fixed.append(bare[:1].upper() + bare[1:].lower() + suffix)
        normalized.append("".join(fixed))
    return " ".join(normalized)

CANONICAL_ORDER_ID_RE = re.compile(r"^ORD-\d{4}-\d{2}-\d{2}-\d{3}$")
PLACEHOLDER_PREFIXES = (
    "UNKNOWN",
    "OCR-",
    "HIST-",
    "HIST-ETL",
    "IMPORT-",
    "HEALTH-",
)

DateLike = Union[datetime, date, str, None]


def is_canonical_order_id(value: Optional[str]) -> bool:
    if not value:
        return False
    return bool(CANONICAL_ORDER_ID_RE.fullmatch(str(value).strip()))


def is_placeholder_order_id(value: Optional[str]) -> bool:
    if not value or not str(value).strip():
        return True
    cleaned = str(value).strip()
    if is_canonical_order_id(cleaned):
        return False
    upper = cleaned.upper()
    if upper in {"UNKNOWN", "N/A", "NULL", "NONE", "N-A"}:
        return True
    return any(upper.startswith(p) for p in PLACEHOLDER_PREFIXES)


def parse_order_date(value: DateLike) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s[:19], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def format_order_id(dt: date, sequence: int) -> str:
    return f"ORD-{dt.year:04d}-{dt.month:02d}-{dt.day:02d}-{sequence:03d}"


def date_prefix(dt: date) -> str:
    return f"ORD-{dt.year:04d}-{dt.month:02d}-{dt.day:02d}-"


def sequence_from_order_id(order_id: str, prefix: str) -> int:
    """Same sequence extraction as JobOrderForm (parts[4] numeric portion)."""
    if not order_id or not str(order_id).startswith(prefix):
        return 0
    parts = str(order_id).split("-")
    seq_part = parts[4] if len(parts) > 4 else ""
    match = re.search(r"\d+", seq_part)
    if not match:
        return 0
    try:
        n = int(match.group(0))
    except ValueError:
        return 0
    return n if n > 0 else 0


def max_sequence_for_prefix(existing_ids: Iterable[str], prefix: str) -> int:
    seqs = [sequence_from_order_id(oid, prefix) for oid in existing_ids]
    seqs = [n for n in seqs if n > 0]
    return max(seqs) if seqs else 0


def next_canonical_order_id(
    dt: date,
    existing_ids: Sequence[str],
    reserved: Optional[Iterable[str]] = None,
) -> str:
    """
    Return ORD-YYYY-MM-DD-NNN continuing from the highest sequence for that date.
    Does not assign 001 when a higher sequence already exists.
    """
    prefix = date_prefix(dt)
    taken: Set[str] = {str(x) for x in existing_ids if x}
    if reserved:
        taken.update(str(x) for x in reserved if x)
    next_seq = max_sequence_for_prefix(taken, prefix) + 1
    candidate = format_order_id(dt, next_seq)
    while candidate in taken:
        next_seq += 1
        candidate = format_order_id(dt, next_seq)
    return candidate


def collect_order_ids_for_date(
    db: Session,
    dt: date,
    *,
    exclude_historical_order_id: Optional[int] = None,
) -> list:
    from models import HistoricalOrder, Order

    prefix = date_prefix(dt)
    live = [
        row[0]
        for row in db.query(Order.order_number)
        .filter(Order.order_number.like(f"{prefix}%"))
        .all()
        if row[0]
    ]
    hist_q = db.query(HistoricalOrder.order_id, HistoricalOrder.historical_order_id).filter(
        HistoricalOrder.order_id.like(f"{prefix}%")
    )
    historical = []
    for oid, hid in hist_q.all():
        if exclude_historical_order_id is not None and hid == exclude_historical_order_id:
            continue
        if oid:
            historical.append(oid)
    return live + historical


class OrderIdSuggestionCache:
    """Assign display-only ORD-YYYY-MM-DD-NNN values without a DB hit per queue row."""

    def __init__(self, db: Session):
        self.db = db
        self.existing_by_prefix: dict = {}
        self.reserved: list = []

    def suggest(self, date_value: DateLike) -> Optional[str]:
        dt = parse_order_date(date_value)
        if dt is None:
            return None
        prefix = date_prefix(dt)
        if prefix not in self.existing_by_prefix:
            self.existing_by_prefix[prefix] = set(collect_order_ids_for_date(self.db, dt))
        candidate = next_canonical_order_id(
            dt, list(self.existing_by_prefix[prefix]), self.reserved
        )
        self.reserved.append(candidate)
        self.existing_by_prefix[prefix].add(candidate)
        return candidate


def generate_canonical_order_id(
    db: Session,
    date_value: DateLike,
    *,
    exclude_historical_order_id: Optional[int] = None,
    reserved: Optional[Iterable[str]] = None,
) -> str:
    """
    Authoritative generator: look at live Job Orders and historical orders
    for the given date, then continue the sequence.
    """
    dt = parse_order_date(date_value)
    if dt is None:
        raise ValueError("A date is required to generate ORD-YYYY-MM-DD-NNN")
    existing = collect_order_ids_for_date(
        db, dt, exclude_historical_order_id=exclude_historical_order_id
    )
    return next_canonical_order_id(dt, existing, reserved)


def resolve_historical_order_id(
    db: Session,
    *,
    date_value: DateLike,
    extracted_order_id: Optional[str] = None,
    current_order_id: Optional[str] = None,
    exclude_historical_order_id: Optional[int] = None,
    reserved: Optional[Iterable[str]] = None,
) -> str:
    """
    Choose the customer-facing historical Order ID.

    Prefer an already-canonical extracted/current ID when it is unique.
    Otherwise generate the next ORD-YYYY-MM-DD-NNN for Date Received.
    """
    reserved_set = {str(x) for x in (reserved or []) if x}
    dt = parse_order_date(date_value)

    for candidate in (extracted_order_id, current_order_id):
        if is_placeholder_order_id(candidate):
            continue
        clash = _id_taken(
            db,
            candidate,
            exclude_historical_order_id=exclude_historical_order_id,
        )
        if not clash and candidate not in reserved_set:
            return str(candidate).strip()

    if dt is None:
        dt = date.today()
    return generate_canonical_order_id(
        db,
        dt,
        exclude_historical_order_id=exclude_historical_order_id,
        reserved=reserved_set,
    )


def _id_taken(
    db: Session,
    order_id: str,
    *,
    exclude_historical_order_id: Optional[int] = None,
) -> bool:
    from models import HistoricalOrder, Order

    if db.query(Order).filter(Order.order_number == order_id).first():
        return True
    q = db.query(HistoricalOrder).filter(HistoricalOrder.order_id == order_id)
    if exclude_historical_order_id is not None:
        q = q.filter(HistoricalOrder.historical_order_id != exclude_historical_order_id)
    return q.first() is not None


def source_document_ref(extracted_order_id: Optional[str]) -> Optional[str]:
    """Preserve the original paper/OCR control number separately from the canonical ID."""
    if not extracted_order_id:
        return None
    cleaned = re.sub(r"[^\w\-]", "", str(extracted_order_id).strip())[:50]
    if not cleaned:
        return None
    if cleaned.upper() in {"UNKNOWN", "N/A", "NULL", "NONE"}:
        return None
    return cleaned


def repair_historical_order_ids(db: Session) -> bool:
    """Repair legacy/missing IDs deterministically from each order's received date.

    IDs are allocated after live orders for the same date, so the database-wide
    unique constraint cannot be violated by historical records. Temporary IDs
    make the repair safe even when legacy rows currently contain duplicates.
    """
    from models import HistoricalOrder, Order

    orders = db.query(HistoricalOrder).order_by(
        HistoricalOrder.date_received.asc(),
        HistoricalOrder.historical_order_id.asc(),
    ).all()
    if not orders:
        return False

    live_ids = [row[0] for row in db.query(Order.order_number).all() if row[0]]
    live_by_prefix = {}
    for oid in live_ids:
        text = str(oid)
        if is_canonical_order_id(text):
            prefix = text.rsplit("-", 1)[0] + "-"
            live_by_prefix[prefix] = max(
                live_by_prefix.get(prefix, 0), sequence_from_order_id(text, prefix)
            )

    planned = []
    next_by_prefix = dict(live_by_prefix)
    for order in orders:
        dt = parse_order_date(order.date_received) or date.today()
        prefix = date_prefix(dt)
        next_by_prefix[prefix] = next_by_prefix.get(prefix, 0) + 1
        planned.append((order, format_order_id(dt, next_by_prefix[prefix])))

    changed = any(order.order_id != new_id for order, new_id in planned)
    names_changed = False
    for order in orders:
        customer = getattr(order, "customer", None)
        if customer:
            new_name = normalize_customer_name(customer.customer_name)
            if new_name and customer.customer_name != new_name:
                customer.customer_name = new_name
                names_changed = True
    if not changed and not names_changed:
        return False

    # Clear existing values first because order_id is UNIQUE.
    for index, (order, _new_id) in enumerate(planned):
        order.order_id = f"__repair__{order.historical_order_id}_{index}"
    db.flush()
    for order, new_id in planned:
        order.order_id = new_id
    db.flush()
    return True
