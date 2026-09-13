#!/usr/bin/env python3
"""
Idempotent batch ingestion for Shoelotskey historical job order form archives.

Discovers all supported source files recursively, runs OCR, registers records in
historical_images + historical_orders in PENDING_REVIEW state, and writes a manifest.

Safe to re-run: skips files already registered by content hash or stable source path.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure backend package imports resolve when run as script
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy.orm import Session

from db.database import SessionLocal, ensure_sqlite_schema_and_defaults, engine, is_sqlite
from historical.ocr_engine import (
    OCR_VERSION,
    SUPPORTED_EXT,
    derive_order_id,
    extract_from_file,
    map_conditions,
    parse_date,
    sanitize_extracted_item,
    service_type,
)
from historical.local_ocr_parser import payment_discrepancy
from order_numbering import (
    resolve_historical_order_id,
    source_document_ref,
)
from historical.ocr_status import DUPLICATE, OCR_FAILED, PENDING_REVIEW
from models import (
    Customer,
    EtlImportHistory,
    HistoricalImage,
    HistoricalItem,
    HistoricalItemService,
    HistoricalOrder,
)

DEFAULT_SOURCE = BACKEND_DIR / "historical_data" / "source" / "Digital Job Order Forms"
OUTPUT_DIR = BACKEND_DIR / "historical_data" / "output"
MANIFEST_PATH = OUTPUT_DIR / "image_index.csv"
REPORT_PATH = OUTPUT_DIR / "image_processing_report.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def discover_files(source_dir: Path, images_only: bool = False) -> List[Path]:
    files: List[Path] = []
    for root, _, filenames in os.walk(source_dir):
        for name in sorted(filenames):
            p = Path(root) / name
            ext = p.suffix.lower()
            if ext in SUPPORTED_EXT:
                if images_only and ext == ".pdf":
                    continue
                files.append(p)
    # Process standalone images before multi-page PDF batches
    return sorted(files, key=lambda p: (p.suffix.lower() == ".pdf", str(p).lower()))


def rel_source_path(path: Path, source_dir: Path) -> str:
    try:
        return str(path.relative_to(source_dir)).replace("\\", "/")
    except ValueError:
        return str(path)


def find_existing_image(db: Session, file_hash: str, rel_path: str) -> Optional[HistoricalImage]:
    by_hash = db.query(HistoricalImage).filter(HistoricalImage.image_hash == file_hash).first()
    if by_hash:
        return by_hash
    return (
        db.query(HistoricalImage)
        .filter(HistoricalImage.image_path.like(f"%{rel_path.replace('/', os.sep)}%"))
        .first()
    )


def ensure_unique_order_id(db: Session, base_id: str) -> str:
    """Kept for callers; new OCR records use resolve_historical_order_id instead."""
    candidate = base_id
    suffix = 1
    while db.query(HistoricalOrder).filter(HistoricalOrder.order_id == candidate).first():
        candidate = f"{base_id}-{suffix}"
        suffix += 1
    return candidate


def _as_money(val: Any) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def get_or_create_customer(db: Session, name: str, contact: str) -> Customer:
    name = (name or "Unknown Customer").strip() or "Unknown Customer"
    contact = (contact or "N/A").strip() or "N/A"
    existing = (
        db.query(Customer)
        .filter(
            Customer.customer_name.ilike(name),
            Customer.contact_number == contact,
        )
        .first()
    )
    if existing:
        return existing
    cust = Customer(customer_name=name, contact_number=contact)
    db.add(cust)
    db.flush()
    return cust


def create_order_from_extraction(
    db: Session,
    extracted: Dict[str, Any],
    file_hash: str,
    source_label: str,
) -> HistoricalOrder:
    extracted_oid = extracted.get("order_id") or derive_order_id(extracted, file_hash)
    source_ref = source_document_ref(extracted_oid)
    date_received = parse_date(extracted.get("date_received"))
    expected = parse_date(extracted.get("original_estimated_release_date"))
    claimed = parse_date(extracted.get("claimed_date"))
    # date_received is NOT NULL. Use archive-start midnight only as an unverified
    # placeholder when OCR did not read DATE & TIME — never treat it as real paper data.
    from historical.ocr_engine import UNVERIFIED_RECEIVED_SENTINEL

    date_unverified = date_received is None and expected is None and claimed is None
    persist_date = date_received or expected or claimed or UNVERIFIED_RECEIVED_SENTINEL
    order_id = resolve_historical_order_id(
        db,
        date_value=date_received or persist_date,
        extracted_order_id=extracted_oid,
    )
    customer = get_or_create_customer(
        db,
        extracted.get("customer_name") or "Unknown Customer",
        extracted.get("contact_number") or "N/A",
    )

    completion_days = None
    if claimed and persist_date:
        completion_days = (claimed.date() - persist_date.date()).days
        if completion_days < 0:
            completion_days = None

    grand_total = _as_money(extracted.get("grand_total"))
    downpayment = _as_money(extracted.get("downpayment"))
    balance = _as_money(extracted.get("balance"))
    original_grand_total = _as_money(extracted.get("original_grand_total"))
    # grand_total column is NOT NULL; 0 is a DB placeholder only when OCR found nothing.
    persist_total = grand_total if grand_total is not None else 0.0

    items = [sanitize_extracted_item(i) for i in (extracted.get("items") or []) if isinstance(i, dict)]
    total_pairs = extracted.get("total_pairs") or max(len(items), 1)
    discrepancy = payment_discrepancy({
        "items": items,
        "original_grand_total": original_grand_total,
        "grand_total": grand_total,
        "downpayment": downpayment,
        "balance": balance,
    })

    order = HistoricalOrder(
        order_id=order_id,
        customer_id=customer.customer_id,
        branch=extracted.get("branch") or "Villamor",
        date_received=persist_date,
        original_estimated_release_date=expected,
        claimed_date=claimed,
        completion_days=completion_days,
        total_pairs=int(total_pairs),
        grand_total=persist_total,
        original_grand_total=original_grand_total,
        downpayment=downpayment,
        balance=balance,
        priority=(extracted.get("priority") or "regular").lower(),
        payment_method=extracted.get("payment_method"),
        sync_status="pending",
        ocr_status=PENDING_REVIEW,
        audit_trail=[
            {
                "timestamp": str(datetime.now()),
                "action": "ocr_ingestion",
                "source_label": source_label,
                "source_document_ref": source_ref,
                "file_hash": file_hash,
                "payment_warnings": discrepancy.get("warnings") or [],
                "date_received_unverified": date_unverified,
                "raw_ocr": extracted,
            }
        ],
    )
    db.add(order)
    db.flush()

    for item_data in items:
        if not isinstance(item_data, dict):
            continue
        cond = map_conditions(item_data.get("conditions"))
        item = HistoricalItem(
            historical_order_id=order.historical_order_id,
            brand=item_data.get("brand"),
            model=item_data.get("model"),
            color=item_data.get("color"),
            size=str(item_data.get("size") or "") or None,
            material=item_data.get("material"),
            priority=(item_data.get("priority") or order.priority or "regular").lower(),
            remarks=item_data.get("remarks"),
            item_price=item_data.get("item_price"),
            scratches=cond["scratches"] or None,
            yellowing=cond["yellowing"] or None,
            sole_separation=cond["sole_separation"] or None,
            deep_stains=cond["deep_stains"] or None,
            rips_holes=cond["rips_holes"] or None,
            worn_out=cond["worn_out"] or None,
        )
        db.add(item)
        db.flush()

        for svc in item_data.get("base_services") or []:
            if str(svc).strip():
                db.add(
                    HistoricalItemService(
                        historical_item_id=item.historical_item_id,
                        service_name=str(svc).strip(),
                        service_type="base",
                        price=0,
                    )
                )
        for svc in item_data.get("addon_services") or []:
            if str(svc).strip():
                db.add(
                    HistoricalItemService(
                        historical_item_id=item.historical_item_id,
                        service_name=str(svc).strip(),
                        service_type="addon",
                        price=0,
                    )
                )

    if not items:
        placeholder = HistoricalItem(
            historical_order_id=order.historical_order_id,
            brand=None,
            model=None,
            remarks=f"OCR produced no items for {source_label}",
        )
        db.add(placeholder)

    return order


def register_image(
    db: Session,
    order: HistoricalOrder,
    filename: str,
    abs_path: str,
    file_hash: str,
    confidence: float,
    status: str,
) -> HistoricalImage:
    img = HistoricalImage(
        historical_order_id=order.historical_order_id,
        image_filename=filename,
        image_path=abs_path,
        image_hash=file_hash,
        ocr_confidence=confidence,
        ocr_status=status,
        ocr_version=OCR_VERSION,
        processed_at=datetime.now(),
    )
    db.add(img)
    db.flush()
    return img


def normalize_legacy_statuses(db: Session) -> int:
    """One-time normalization of legacy pilot status strings."""
    mapping = {
        "Pending": PENDING_REVIEW,
        "Pending Review": PENDING_REVIEW,
        "Needs Correction": PENDING_REVIEW,
        "Validated": "VALIDATED",
        "Rejected": "REJECTED",
        "Corrected": "CORRECTED",
    }
    updated = 0
    for old, new in mapping.items():
        for img in db.query(HistoricalImage).filter(HistoricalImage.ocr_status == old).all():
            img.ocr_status = new
            updated += 1
        for order in db.query(HistoricalOrder).filter(HistoricalOrder.ocr_status == old).all():
            order.ocr_status = new
            updated += 1
    db.commit()
    return updated


def write_manifest(rows: List[Dict[str, Any]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    fieldnames: List[str] = []
    seen = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)
    with open(MANIFEST_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def apply_extraction_to_order(
    db: Session,
    order: HistoricalOrder,
    extracted: Dict[str, Any],
    engine: str,
    confidence: float,
) -> None:
    """Merge OCR extraction into an existing order without inventing values."""
    from order_numbering import is_placeholder_order_id

    if extracted.get("grand_total") is not None and extracted.get("grand_total") != "":
        money = _as_money(extracted["grand_total"])
        if money is not None:
            order.grand_total = money
    if extracted.get("downpayment") is not None and extracted.get("downpayment") != "":
        order.downpayment = _as_money(extracted["downpayment"])
    if extracted.get("balance") is not None and extracted.get("balance") != "":
        order.balance = _as_money(extracted["balance"])
    dr_val = extracted.get("date_received")
    needs_reorder_id = False
    if dr_val:
        from order_numbering import parse_order_date, date_prefix
        parsed_dr = parse_order_date(dr_val)
        if parsed_dr:
            prefix = date_prefix(parsed_dr)
            if is_placeholder_order_id(order.order_id) or not str(order.order_id).startswith(prefix):
                needs_reorder_id = True

    if needs_reorder_id:
        order.order_id = resolve_historical_order_id(
            db,
            date_value=dr_val or order.date_received,
            extracted_order_id=extracted.get("order_id"),
            current_order_id=None,
            exclude_historical_order_id=order.historical_order_id,
        )
    if extracted.get("branch"):
        order.branch = extracted["branch"]
    if extracted.get("priority"):
        order.priority = str(extracted["priority"]).lower()
    if extracted.get("payment_method"):
        order.payment_method = extracted["payment_method"]

    dr = parse_date(extracted.get("date_received"))
    if dr:
        order.date_received = dr
        # Clear unverified flag when DATE & TIME is actually read.
        trail = list(order.audit_trail or [])
        trail.append({
            "timestamp": str(datetime.now()),
            "action": "date_received_from_ocr",
            "date_received_unverified": False,
            "date_received": dr.isoformat(sep="T", timespec="seconds"),
        })
        order.audit_trail = trail
        try:
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(order, "audit_trail")
        except Exception:
            pass
    er = parse_date(extracted.get("original_estimated_release_date"))
    if er:
        order.original_estimated_release_date = er
    cd = parse_date(extracted.get("claimed_date"))
    if cd:
        order.claimed_date = cd
        if order.date_received:
            days = (cd.date() - order.date_received.date()).days
            if days >= 0:
                order.completion_days = days

    if extracted.get("customer_name"):
        cust = get_or_create_customer(
            db,
            extracted["customer_name"],
            extracted.get("contact_number") or "N/A",
        )
        order.customer_id = cust.customer_id

    items_data = [
        sanitize_extracted_item(i) for i in (extracted.get("items") or []) if isinstance(i, dict)
    ]

    def _item_row_useful(row: Dict[str, Any]) -> bool:
        if row.get("brand"):
            return True
        if row.get("base_services") or row.get("addon_services"):
            return True
        if row.get("item_price") is not None and (row.get("model") or row.get("remarks")):
            return True
        return False

    existing_items = list(order.items or [])
    only_placeholders = bool(existing_items) and all(
        (not i.brand)
        and (i.item_price is None)
        and str(i.remarks or "").lower().startswith("ocr produced no items")
        for i in existing_items
    )
    useful_rows = [i for i in items_data if _item_row_useful(i)]
    existing_has_brands = any(getattr(i, "brand", None) for i in existing_items)
    if useful_rows and (only_placeholders or not existing_has_brands):
        for existing_item in existing_items:
            db.delete(existing_item)
        db.flush()
        for item_data in useful_rows:
            if not isinstance(item_data, dict):
                continue
            cond = map_conditions(item_data.get("conditions"))
            item = HistoricalItem(
                historical_order_id=order.historical_order_id,
                brand=item_data.get("brand"),
                model=item_data.get("model"),
                color=item_data.get("color"),
                size=str(item_data.get("size") or "") or None,
                material=item_data.get("material"),
                priority=(item_data.get("priority") or order.priority or "regular").lower(),
                remarks=item_data.get("remarks"),
                item_price=item_data.get("item_price"),
                scratches=cond["scratches"] or None,
                yellowing=cond["yellowing"] or None,
                sole_separation=cond["sole_separation"] or None,
                deep_stains=cond["deep_stains"] or None,
                rips_holes=cond["rips_holes"] or None,
                worn_out=cond["worn_out"] or None,
            )
            db.add(item)
            db.flush()
            for svc in item_data.get("base_services") or []:
                if str(svc).strip():
                    db.add(HistoricalItemService(
                        historical_item_id=item.historical_item_id,
                        service_name=str(svc).strip(),
                        service_type="base",
                        price=0,
                    ))
            for svc in item_data.get("addon_services") or []:
                if str(svc).strip():
                    db.add(HistoricalItemService(
                        historical_item_id=item.historical_item_id,
                        service_name=str(svc).strip(),
                        service_type="addon",
                        price=0,
                    ))

    if extracted.get("total_pairs"):
        order.total_pairs = int(extracted["total_pairs"])

    trail = list(order.audit_trail or [])
    trail.append({
        "timestamp": str(datetime.now()),
        "action": "ocr_extraction",
        "engine": engine,
        "confidence": confidence,
        "source_document_ref": source_document_ref(extracted.get("order_id")),
        "raw_ocr": {k: v for k, v in extracted.items() if not k.startswith("_")},
    })
    order.audit_trail = trail
    try:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(order, "audit_trail")
    except Exception:
        pass


def _log(msg: str) -> None:
    print(msg, flush=True)


def retry_zero_confidence_ocr(
    db: Session,
    limit: Optional[int] = None,
    *,
    local_fallback: bool = False,
    use_gemini: bool = True,
    local_engine: str = "auto",
) -> Dict[str, int]:
    """Re-run OCR for registered images with zero confidence."""
    from historical.local_ocr import (
        EASYOCR_VERSION,
        TESSERACT_VERSION,
        paddleocr_available,
    )

    stats: Dict[str, int] = Counter()
    stats["paddleocr_available"] = int(paddleocr_available())

    q = (
        db.query(HistoricalImage)
        .filter(
            (HistoricalImage.ocr_confidence == None) | (HistoricalImage.ocr_confidence == 0)  # noqa: E711
        )
        .filter(HistoricalImage.ocr_status.in_([PENDING_REVIEW, "Pending", "Pending Review"]))
    )
    images = q.limit(limit).all() if limit else q.all()
    mode = "local-fallback" if local_fallback else "gemini-first"
    print(f"OCR retry queue ({mode}): {len(images)} images with zero confidence", flush=True)

    for idx, img in enumerate(images, 1):
        if (img.ocr_confidence or 0) > 0:
            stats["skipped_existing_ocr"] += 1
            continue
        path = Path(img.image_path)
        if not path.exists():
            stats["missing_source"] += 1
            continue
        try:
            page_results = extract_from_file(
                path,
                use_gemini=use_gemini and not local_fallback,
                use_local_fallback=local_fallback or True,
                local_engine=local_engine,
            )
            _, extracted, confidence, engine = page_results[0]
            order = img.order
            if order:
                apply_extraction_to_order(db, order, extracted, engine, confidence)
            img.ocr_confidence = confidence
            img.ocr_version = engine
            img.processed_at = datetime.now()
            db.commit()

            if "gemini" in engine.lower():
                stats["gemini"] += 1
            elif engine == EASYOCR_VERSION:
                stats["easyocr"] += 1
            elif engine == TESSERACT_VERSION:
                stats["tesseract"] += 1
            else:
                stats["none"] += 1
            stats["ocr_processed"] += 1

            if idx % 10 == 0 or idx == len(images):
                print(f"  [{idx}/{len(images)}] engine={engine} conf={confidence:.2f} {img.image_filename}", flush=True)
        except Exception as exc:
            db.rollback()
            stats["ocr_failed"] += 1
            if idx % 25 == 0:
                print(f"  FAIL {img.image_filename}: {exc}")
    return dict(stats)


def collect_ocr_stats(db: Session) -> Dict[str, Any]:
    """Summarize OCR engine usage across historical_images."""
    from ml.historical_ml_engine import is_ml_eligible_order

    images = db.query(HistoricalImage).all()
    stats: Dict[str, Any] = Counter()
    stats["total_sources_registered"] = 722
    stats["historical_images"] = len(images)
    stats["historical_orders"] = db.query(HistoricalOrder).count()

    for img in images:
        conf = img.ocr_confidence or 0
        ver = (img.ocr_version or "").lower()
        if conf <= 0:
            stats["zero_confidence"] += 1
        else:
            stats["with_ocr_confidence"] += 1
        if conf > 0 and "gemini" in ver:
            stats["gemini"] += 1
        elif conf > 0 and "easyocr" in ver:
            stats["easyocr"] += 1
        elif conf > 0 and "tesseract" in ver:
            stats["tesseract"] += 1
        elif conf > 0:
            stats["other_engine"] += 1

    stats["pending_review"] = db.query(HistoricalImage).filter(
        HistoricalImage.ocr_status.in_([PENDING_REVIEW, "Pending", "Pending Review"])
    ).count()
    stats["validated"] = db.query(HistoricalImage).filter(
        HistoricalImage.ocr_status.in_(["VALIDATED", "Validated", "CORRECTED", "Corrected"])
    ).count()
    stats["rejected"] = db.query(HistoricalImage).filter(
        HistoricalImage.ocr_status.in_(["REJECTED", "Rejected"])
    ).count()
    stats["ml_eligible"] = sum(
        1 for o in db.query(HistoricalOrder).all() if is_ml_eligible_order(o)
    )
    return dict(stats)


def run_ingestion(
    source_dir: Path,
    *,
    limit: Optional[int] = None,
    skip_ocr: bool = False,
    images_only: bool = False,
    ocr_retry: bool = False,
    normalize: bool = True,
    imported_by: str = "historical_ocr_import.py",
) -> Dict[str, Any]:
    if is_sqlite and engine is not None:
        ensure_sqlite_schema_and_defaults(engine)

    started = datetime.now()
    db = SessionLocal()
    etl = EtlImportHistory(
        filename=str(source_dir),
        import_started=started,
        status="running",
        imported_by=imported_by,
    )
    db.add(etl)
    db.commit()

    stats: Dict[str, Any] = Counter()
    manifest_rows: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []

    try:
        if normalize:
            stats["legacy_status_normalized"] = normalize_legacy_statuses(db)

        all_files = discover_files(source_dir, images_only=images_only)
        stats["discovered_total"] = len(all_files)
        ext_counter = Counter(p.suffix.lower() for p in all_files)
        stats["discovered_jpeg"] = ext_counter.get(".jpeg", 0) + ext_counter.get(".jpg", 0)
        stats["discovered_jpg"] = ext_counter.get(".jpg", 0)
        stats["discovered_png"] = ext_counter.get(".png", 0)
        stats["discovered_pdf"] = ext_counter.get(".pdf", 0)

        to_process = all_files[:limit] if limit else all_files
        print(f"Discovered {len(all_files)} supported files; processing {len(to_process)}...")

        for idx, file_path in enumerate(to_process, 1):
            rel = rel_source_path(file_path, source_dir)
            row: Dict[str, Any] = {
                "source_path": rel,
                "filename": file_path.name,
                "extension": file_path.suffix.lower(),
                "processed_at": str(datetime.now()),
            }
            try:
                file_hash = sha256_file(file_path)
                row["source_hash"] = file_hash

                existing = find_existing_image(db, file_hash, rel)
                if existing and not (ocr_retry and (existing.ocr_confidence or 0) == 0 and not skip_ocr):
                    stats["duplicates_skipped"] += 1
                    row.update(
                        {
                            "ocr_status": DUPLICATE,
                            "validation_status": existing.ocr_status,
                            "historical_image_id": existing.historical_image_id,
                            "error": "",
                        }
                    )
                    manifest_rows.append(row)
                    if idx % 25 == 0:
                        print(f"  [{idx}/{len(to_process)}] skipped duplicate {file_path.name}")
                    continue

                if existing and ocr_retry and (existing.ocr_confidence or 0) == 0 and not skip_ocr:
                    try:
                        page_results = extract_from_file(file_path)
                        page_label, extracted, confidence, engine = page_results[0]
                        order = existing.order
                        if order:
                            order.grand_total = float(extracted.get("grand_total") or order.grand_total or 0)
                            order.branch = extracted.get("branch") or order.branch
                            dr = parse_date(extracted.get("date_received"))
                            if dr:
                                order.date_received = dr
                            trail = order.audit_trail or []
                            trail.append({"timestamp": str(datetime.now()), "action": "ocr_retry", "raw_ocr": extracted})
                            order.audit_trail = trail
                        existing.ocr_confidence = confidence
                        existing.processed_at = datetime.now()
                        db.commit()
                        stats["ocr_processed"] += 1
                        row.update({"ocr_status": PENDING_REVIEW, "historical_image_id": existing.historical_image_id, "ocr_confidence": confidence})
                        manifest_rows.append(row)
                        if idx % 10 == 0:
                            print(f"  [{idx}/{len(to_process)}] OCR retry ok confidence={confidence:.2f}")
                        continue
                    except Exception as ocr_exc:
                        errors.append({"source_path": rel, "error": str(ocr_exc)})
                        stats["ocr_failed"] += 1
                        continue

                abs_path = str(file_path.resolve())

                if skip_ocr:
                    extracted = {"items": [], "confidence_score": 0.0}
                    confidence = 0.0
                    page_results = [(file_path.name, extracted, confidence, "none")]
                else:
                    try:
                        page_results = extract_from_file(file_path)
                    except Exception as ocr_exc:
                        stats["ocr_failed"] += 1
                        extracted = {
                            "items": [],
                            "confidence_score": 0.0,
                            "raw_text_summary": f"OCR failed: {ocr_exc}",
                        }
                        confidence = 0.0
                        page_results = [(file_path.name, extracted, confidence, "none")]
                        errors.append({"source_path": rel, "error": str(ocr_exc)})

                for page_label, extracted, confidence, engine in page_results:
                    page_hash = file_hash if len(page_results) == 1 else hashlib.sha256(
                        f"{file_hash}:{page_label}".encode()
                    ).hexdigest()

                    if find_existing_image(db, page_hash, page_label):
                        stats["duplicates_skipped"] += 1
                        continue

                    order = create_order_from_extraction(db, extracted, page_hash, page_label)
                    img = register_image(
                        db,
                        order,
                        page_label if page_label != file_path.name else file_path.name,
                        abs_path,
                        page_hash,
                        confidence,
                        PENDING_REVIEW,
                    )
                    db.commit()
                    stats["ocr_processed"] += 1
                    stats["registered"] += 1
                    row.update(
                        {
                            "ocr_status": PENDING_REVIEW,
                            "validation_status": PENDING_REVIEW,
                            "historical_image_id": img.historical_image_id,
                            "historical_order_id": order.historical_order_id,
                            "order_id": order.order_id,
                            "ocr_confidence": confidence,
                            "error": "",
                        }
                    )
                    manifest_rows.append(dict(row))

                if idx % 10 == 0 or idx == len(to_process):
                    print(
                        f"  [{idx}/{len(to_process)}] processed={stats['ocr_processed']} "
                        f"dup={stats['duplicates_skipped']} fail={stats['ocr_failed']}"
                    )

            except Exception as exc:
                db.rollback()
                stats["ocr_failed"] += 1
                err_msg = str(exc)
                errors.append({"source_path": rel, "error": err_msg})
                row.update({"ocr_status": OCR_FAILED, "error": err_msg})
                manifest_rows.append(row)
                print(f"  FAIL {rel}: {err_msg}")

        # Final DB counts
        stats["historical_images"] = db.query(HistoricalImage).count()
        stats["historical_orders"] = db.query(HistoricalOrder).count()
        stats["pending_review_images"] = (
            db.query(HistoricalImage)
            .filter(HistoricalImage.ocr_status.in_([PENDING_REVIEW, "Pending", "Pending Review"]))
            .count()
        )
        stats["validated_images"] = (
            db.query(HistoricalImage)
            .filter(HistoricalImage.ocr_status.in_(["VALIDATED", "Validated", "CORRECTED", "Corrected"]))
            .count()
        )
        stats["rejected_images"] = (
            db.query(HistoricalImage)
            .filter(HistoricalImage.ocr_status.in_(["REJECTED", "Rejected"]))
            .count()
        )
        stats["pending_review_orders"] = (
            db.query(HistoricalOrder)
            .filter(HistoricalOrder.ocr_status.in_([PENDING_REVIEW, "Pending", "Pending Review"]))
            .count()
        )

        from ml.historical_ml_engine import is_ml_eligible_order

        all_orders = db.query(HistoricalOrder).all()
        stats["ml_eligible"] = sum(1 for o in all_orders if is_ml_eligible_order(o))

        write_manifest(manifest_rows)
        finished = datetime.now()
        report = {
            "run_started": str(started),
            "run_finished": str(finished),
            "duration_seconds": (finished - started).total_seconds(),
            "stats": dict(stats),
            "errors": errors,
        }
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        etl.records_read = stats["discovered_total"]
        etl.records_imported = stats["registered"]
        etl.duplicates_removed = stats["duplicates_skipped"]
        etl.invalid_records = stats["ocr_failed"]
        etl.import_finished = finished
        etl.duration_seconds = report["duration_seconds"]
        etl.status = "completed"
        db.commit()

        return report

    except Exception as exc:
        etl.status = "failed"
        etl.error_message = str(exc)
        etl.import_finished = datetime.now()
        db.commit()
        raise
    finally:
        try:
            if manifest_rows:
                write_manifest(manifest_rows)
        except Exception:
            pass
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Shoelotskey historical OCR batch ingestion")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Root directory to scan recursively",
    )
    parser.add_argument("--limit", type=int, default=None, help="Process at most N files (for testing)")
    parser.add_argument("--skip-ocr", action="store_true", help="Register files without OCR (discovery test only)")
    parser.add_argument("--images-only", action="store_true", help="Skip PDF source files")
    parser.add_argument("--ocr-retry", action="store_true", help="Re-OCR registered images with zero confidence")
    parser.add_argument(
        "--local-fallback",
        action="store_true",
        help="Use local OCR (EasyOCR/Tesseract) instead of Gemini for zero-confidence records",
    )
    parser.add_argument(
        "--engine",
        choices=["auto", "easyocr", "tesseract"],
        default="auto",
        help="Local OCR engine preference (auto = EasyOCR then Tesseract)",
    )
    parser.add_argument("--no-normalize", action="store_true", help="Skip legacy status normalization")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Source directory not found: {args.source}")
        sys.exit(1)

    if args.ocr_retry or args.local_fallback:
        db = SessionLocal()
        try:
            stats = retry_zero_confidence_ocr(
                db,
                limit=args.limit,
                local_fallback=args.local_fallback or not args.ocr_retry,
                use_gemini=not args.local_fallback,
                local_engine=args.engine,
            )
            summary = collect_ocr_stats(db)
            print("\n=== OCR RETRY COMPLETE ===")
            print(json.dumps(stats, indent=2))
            print("\n=== DATABASE SUMMARY ===")
            print(json.dumps(summary, indent=2))
        finally:
            db.close()
        return

    print(f"Starting ingestion from: {args.source}")
    t0 = time.time()
    report = run_ingestion(
        args.source,
        limit=args.limit,
        skip_ocr=args.skip_ocr,
        images_only=args.images_only,
        ocr_retry=args.ocr_retry,
        normalize=not args.no_normalize,
    )
    print("\n=== INGESTION COMPLETE ===")
    print(json.dumps(report["stats"], indent=2))
    print(f"Report: {REPORT_PATH}")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Elapsed: {time.time() - t0:.1f}s")
    if report.get("errors"):
        print(f"Errors: {len(report['errors'])}")


if __name__ == "__main__":
    # Unbuffered stdout so batch OCR progress is visible immediately in Agent/terminal
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    main()
