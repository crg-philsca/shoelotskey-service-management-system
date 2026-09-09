"""
Authoritative OCR / validation status vocabulary for historical records.

Legacy aliases are normalized on read so existing pilot data continues to work.
"""

PENDING_REVIEW = "PENDING_REVIEW"
VALIDATED = "VALIDATED"
REJECTED = "REJECTED"
CORRECTED = "CORRECTED"
OCR_FAILED = "OCR_FAILED"
DUPLICATE = "DUPLICATE"

# Legacy values still present in the database from earlier pilot runs
_LEGACY_PENDING = {"Pending", "Pending Review", "Needs Correction", PENDING_REVIEW}
_LEGACY_VALIDATED = {"Validated", "Corrected", VALIDATED, CORRECTED}
_LEGACY_REJECTED = {"Rejected", REJECTED}

PENDING_STATUSES = tuple(_LEGACY_PENDING)
VALIDATED_STATUSES = tuple(_LEGACY_VALIDATED)
REJECTED_STATUSES = tuple(_LEGACY_REJECTED)


def normalize_status(value: str | None) -> str:
    """Map any persisted label to the canonical vocabulary."""
    if not value:
        return PENDING_REVIEW
    v = value.strip()
    if v in _LEGACY_PENDING:
        return PENDING_REVIEW
    if v in _LEGACY_VALIDATED:
        return VALIDATED if v in ("Validated", VALIDATED) else CORRECTED
    if v in _LEGACY_REJECTED:
        return REJECTED
    if v == OCR_FAILED:
        return OCR_FAILED
    if v == DUPLICATE:
        return DUPLICATE
    return v


def is_pending_status(value: str | None) -> bool:
    return normalize_status(value) == PENDING_REVIEW


def is_validated_status(value: str | None) -> bool:
    return normalize_status(value) in (VALIDATED, CORRECTED)


def is_rejected_status(value: str | None) -> bool:
    return normalize_status(value) == REJECTED


def pending_filter_values() -> tuple[str, ...]:
    """All DB values that should appear in the OCR validation queue."""
    return PENDING_STATUSES


def validated_filter_values() -> tuple[str, ...]:
    return VALIDATED_STATUSES
