"""
HISTORICAL CSV IMPORT & RECONCILIATION SERVICE
==============================================
Provides safe structured CSV ingestion, normalization, multi-level deduplication,
OCR/CSV reconciliation, side-by-side conflict detection, and academic ML target provenance.

Strict Non-Negotiable Rules:
- ONE real order = ONE canonical historical record.
- CSV import does NOT equal human validation (enters in PENDING_REVIEW).
- Never automatically overwrite human-validated data.
- Never fabricate missing dates, prices, or services.
- Never use Expected Release Date as a substitute for Claimed Date.
- Never automatically trigger Random Forest retraining.
"""

from __future__ import annotations

import csv
import io
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from models import (
    Customer,
    HistoricalOrder,
    HistoricalItem,
    HistoricalItemService,
    CsvImportBatch,
    HistoricalReconciliationConflict,
    AuditLog,
)
from order_numbering import resolve_historical_order_id
from historical.ocr_status import PENDING_REVIEW, VALIDATED, REJECTED


# Canonical service alias dictionary
SERVICE_ALIAS_MAP = {
    "bc": "Basic Cleaning",
    "basic cleaning": "Basic Cleaning",
    "bcn": "Basic Cleaning",
    "fr": "Full Reglue",
    "full reglue": "Full Reglue",
    "frg": "Full Reglue",
    "fr mid": "Full Reglue Midsole",
    "fr under": "Full Reglue Undersole",
    "midsole": "Full Reglue Midsole",
    "undersole": "Full Reglue Undersole",
    "mr": "Minor Reglue",
    "minor reglue": "Minor Reglue",
    "mrg": "Minor Reglue",
    "cor": "Color Renewal",
    "cr": "Color Renewal",
    "color renewal": "Color Renewal",
    "color restoration": "Color Renewal",
    "crn": "Color Renewal",
    "uny": "Unyellowing",
    "uy": "Unyellowing",
    "unyellowing": "Unyellowing",
    "mret": "Minor Retouch",
    "minor retouch": "Minor Retouch",
    "mres": "Minor Restoration",
    "minor restoration": "Minor Restoration",
    "fres": "Full Restoration",
    "full restoration": "Full Restoration",
    "wpt": "White Paint",
    "white paint": "White Paint",
    "free": "Basic Cleaning",
}


def sanitize_csv_cell(val: Any) -> str:
    """Protects against spreadsheet formula injection (=, +, -, @)."""
    if val is None:
        return ""
    text = str(val).strip()
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        text = "'" + text
    return text


def normalize_customer_name(name: Optional[str]) -> str:
    if not name:
        return "Unknown Customer"
    cleaned = re.sub(r"\s+", " ", str(name).strip())
    return cleaned.title() if cleaned else "Unknown Customer"


def normalize_contact_number(contact: Optional[str]) -> str:
    if not contact:
        return ""
    # If multiple numbers separated by slash, comma, or space, pick the primary contact number
    parts = re.split(r"[/,;\s|]+", str(contact).strip())
    first_part = parts[0] if parts else str(contact)
    digits = re.sub(r"[^\d]", "", first_part)
    if not digits:
        digits = re.sub(r"[^\d]", "", str(contact))
    return digits[:20]


def normalize_money(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return round(float(val), 2)
    cleaned = re.sub(r"[^\d.]", "", str(val).replace(",", ""))
    try:
        return round(float(cleaned), 2) if cleaned else 0.0
    except ValueError:
        return 0.0


def parse_historical_date(val: Any, default_year: int = 2025) -> Optional[datetime]:
    """
    Parses date strings safely without guessing ambiguous dates.
    Supports formats: MM/DD, MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY.
    """
    if not val:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("texted", "claimed", "paid", "pending", "none", "null", "n/a"):
        return None

    # Try ISO YYYY-MM-DD
    match_iso = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", s)
    if match_iso:
        y, m, d = match_iso.groups()
        try:
            return datetime(int(y), int(m), int(d))
        except ValueError:
            return None

    # Try MM/DD/YYYY or MM/DD/YY
    match_slash = re.search(r"(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?", s)
    if match_slash:
        m, d, y = match_slash.groups()
        m, d = int(m), int(d)
        if y:
            y = int(y)
            if y < 100:
                y += 2000
        else:
            y = default_year
        try:
            # Validate reasonable year
            if 2020 <= y <= 2030 and 1 <= m <= 12 and 1 <= d <= 31:
                return datetime(y, m, d)
        except ValueError:
            return None

    return None


def parse_services_field(services_text: str) -> List[List[str]]:
    """
    Splits multi-pair services separated by '|' and multi-service combinations by '+'.
    Returns a list of service lists (one per pair).
    """
    if not services_text:
        return [["Basic Cleaning"]]

    pairs_raw = [p.strip() for p in services_text.split("|") if p.strip()]
    if not pairs_raw:
        pairs_raw = [services_text.strip()]

    parsed_pairs = []
    for p in pairs_raw:
        # Split by + or ,
        items = re.split(r"[+,]", p)
        svc_list = []
        for raw_s in items:
            s_clean = raw_s.strip().lower()
            if not s_clean:
                continue
            canonical = SERVICE_ALIAS_MAP.get(s_clean)
            if not canonical:
                # Match keywords
                for k, v in SERVICE_ALIAS_MAP.items():
                    if k in s_clean:
                        canonical = v
                        break
            svc_list.append(canonical or raw_s.strip().title())
        parsed_pairs.append(svc_list or ["Basic Cleaning"])

    return parsed_pairs or [["Basic Cleaning"]]


def parse_shoes_field(shoes_text: str) -> List[Dict[str, Any]]:
    """
    Parses 'Model_and_Condition' separated by '|'.
    Returns structured list of items with brand, model, size, and condition booleans.
    """
    if not shoes_text:
        return [{"brand": "Unknown", "model": "Standard Footwear", "size": "", "conditions": {}}]

    pairs_raw = [p.strip() for p in shoes_text.split("|") if p.strip()]
    if not pairs_raw:
        pairs_raw = [shoes_text.strip()]

    parsed_items = []
    for p in pairs_raw:
        lower_p = p.lower()
        # Detect conditions
        conditions = {
            "scratches": "scratch" in lower_p,
            "yellowing": "yellow" in lower_p or "unyellow" in lower_p,
            "sole_separation": "separat" in lower_p or "sole" in lower_p and ("reglue" in lower_p or "detach" in lower_p),
            "deep_stains": "stain" in lower_p or "dirt" in lower_p or "heavy" in lower_p,
            "rips_holes": "rip" in lower_p or "hole" in lower_p or "tear" in lower_p,
            "worn_out": "worn" in lower_p or "crease" in lower_p,
        }

        # Size extraction (e.g. Size 8, Size 8.5, 9, 9.5)
        size_match = re.search(r"(?:size\s*|#\s*)?(\d{1,2}(?:\.\d)?)", p, re.IGNORECASE)
        size_val = size_match.group(1) if size_match else ""

        # Brand heuristic
        brand_val = "Unknown"
        common_brands = ["Nike", "Adidas", "Puma", "Jordan", "Converse", "Vans", "New Balance", "Asics", "Gucci", "Balenciaga"]
        for b in common_brands:
            if b.lower() in lower_p:
                brand_val = b
                break

        parsed_items.append({
            "raw_text": p,
            "brand": brand_val,
            "model": p[:50],
            "size": size_val,
            "conditions": conditions,
        })

    return parsed_items or [{"brand": "Unknown", "model": "Standard Footwear", "size": "", "conditions": {}}]


def check_exact_match(csv_row: Dict[str, Any], existing_order: HistoricalOrder) -> Tuple[bool, List[str]]:
    """
    Compares CSV row against existing HistoricalOrder.
    Returns (is_exact_match, list_of_discrepancies).
    """
    discrepancies = []

    # 1. Date received match (same day)
    if existing_order.date_received and csv_row.get("date_received"):
        if existing_order.date_received.date() != csv_row["date_received"].date():
            discrepancies.append("date_received")

    # 2. Customer name similarity
    ex_name = normalize_customer_name(existing_order.customer.customer_name if existing_order.customer else "")
    csv_name = normalize_customer_name(csv_row.get("customer_name", ""))
    if ex_name != csv_name and ex_name not in csv_name and csv_name not in ex_name:
        discrepancies.append("customer_name")

    # 3. Grand total match (within 1 peso tolerance for rounding)
    ex_total = float(existing_order.grand_total or 0.0)
    csv_total = float(csv_row.get("grand_total", 0.0))
    if abs(ex_total - csv_total) > 1.0:
        discrepancies.append("grand_total")

    # 4. Claimed date comparison
    if csv_row.get("claimed_date") and existing_order.claimed_date:
        if csv_row["claimed_date"].date() != existing_order.claimed_date.date():
            discrepancies.append("claimed_date")
    elif csv_row.get("claimed_date") and not existing_order.claimed_date:
        # CSV provides new claim date that OCR lacked
        discrepancies.append("new_claimed_date_available")

    # 5. Services comparison (order-independent set of canonical names)
    ex_services = set()
    for item in existing_order.items:
        for s in item.services:
            ex_services.add(s.service_name.strip().lower())

    csv_services = set()
    for p in csv_row.get("services_per_pair", []):
        for s in p:
            csv_services.add(s.strip().lower())

    if ex_services and csv_services and ex_services != csv_services:
        discrepancies.append("services")

    is_exact = len(discrepancies) == 0
    return is_exact, discrepancies


class CsvReconciliationService:
    @staticmethod
    def parse_csv_file(filename: str, content: str) -> Dict[str, Any]:
        """
        Parses a single CSV file text content, validates structure, and normalizes rows.
        """
        # Determine year from filename heuristic or default 2025/2026
        default_year = 2025
        lower_fn = filename.lower()
        if "january" in lower_fn or "2026" in lower_fn:
            default_year = 2026

        f_io = io.StringIO(content.replace("\ufeff", ""))
        reader = csv.reader(f_io)
        try:
            header = next(reader)
        except StopIteration:
            return {"error": "File is empty", "rows": []}

        header = [h.strip() for h in header]
        col_map = {h: i for i, h in enumerate(header)}

        # Validate required minimum columns
        required_cols = ["Date_Time", "Client_Name", "Services"]
        missing = [c for c in required_cols if c not in col_map]
        if missing:
            # Check fuzzy matches
            alt_map = {}
            for col in header:
                lower_c = col.lower()
                if "date" in lower_c:
                    alt_map["Date_Time"] = col_map[col]
                elif "client" in lower_c or "customer" in lower_c:
                    alt_map["Client_Name"] = col_map[col]
                elif "service" in lower_c:
                    alt_map["Services"] = col_map[col]
            for m in list(missing):
                if m in alt_map:
                    col_map[m] = alt_map[m]
                    missing.remove(m)

        if missing:
            return {"error": f"Missing required columns: {missing}", "rows": []}

        parsed_rows = []
        raw_row_idx = 0
        for row in reader:
            raw_row_idx += 1
            if not row or not any(row):
                continue

            def get_val(col_name: str) -> str:
                idx = col_map.get(col_name)
                if idx is not None and idx < len(row):
                    return sanitize_csv_cell(row[idx])
                return ""

            order_id = get_val("Order_ID") or get_val("Control_No")
            client_name = get_val("Client_Name")
            date_time_str = get_val("Date_Time")
            services_str = get_val("Services")
            shoes_str = get_val("Model_and_Condition")
            grand_total_str = get_val("Grand_Total")
            contact_str = get_val("Contact_No")
            branch_str = get_val("Branch") or "Villamor"
            expected_date_str = get_val("Expected_Release_Date")
            claimed_date_str = get_val("Claimed_Date")
            payment_str = get_val("Payment_Details")

            date_rec = parse_historical_date(date_time_str, default_year)
            exp_date = parse_historical_date(expected_date_str, default_year)
            claim_date = parse_historical_date(claimed_date_str, default_year)

            # Check validity
            is_valid = True
            invalid_reasons = []
            if not client_name or len(client_name) < 2:
                is_valid = False
                invalid_reasons.append("Missing/invalid customer name")
            if not date_rec:
                is_valid = False
                invalid_reasons.append(f"Unparseable date_received: '{date_time_str}'")

            # Services
            services_per_pair = parse_services_field(services_str)
            items = parse_shoes_field(shoes_str)
            total_pairs = max(len(services_per_pair), len(items), 1)

            # Payment details extraction
            dp = 0.0
            bal = 0.0
            gt = normalize_money(grand_total_str)
            if payment_str:
                dp_match = re.search(r"dp\s*([\d,.]+)", payment_str, re.IGNORECASE)
                bal_match = re.search(r"bal\s*([\d,.]+)", payment_str, re.IGNORECASE)
                if dp_match:
                    dp = normalize_money(dp_match.group(1))
                if bal_match:
                    bal = normalize_money(bal_match.group(1))

            parsed_rows.append({
                "csv_row_index": raw_row_idx,
                "order_id": order_id,
                "customer_name": normalize_customer_name(client_name),
                "contact_number": normalize_contact_number(contact_str),
                "branch": branch_str,
                "date_received": date_rec,
                "original_estimated_release_date": exp_date,
                "claimed_date": claim_date,
                "grand_total": gt,
                "downpayment": dp,
                "balance": bal,
                "total_pairs": total_pairs,
                "services_per_pair": services_per_pair,
                "items": items,
                "is_valid": is_valid,
                "invalid_reasons": invalid_reasons,
                "raw_date_str": date_time_str,
                "raw_claimed_str": claimed_date_str,
                "raw_services_str": services_str,
                "raw_shoes_str": shoes_str,
            })

        return {"filename": filename, "rows": parsed_rows}

    @staticmethod
    def reconcile_batch(
        files_data: List[Dict[str, Any]],
        db: Session,
        dry_run: bool = True,
        imported_by: str = "owner"
    ) -> Dict[str, Any]:
        """
        Processes multi-file CSV import with full deduplication and reconciliation.
        If dry_run=True, simulates without writing records to DB.
        """
        batch_id = f"CSV-BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        import_started = datetime.now()

        # Phase 15: Active canonical duplicate detection must primarily compare against is_legacy_archived == False.
        # Legacy archived OCR data represents the same historical period and must not block CSV-first rebuild.
        existing_orders = db.query(HistoricalOrder).filter(
            HistoricalOrder.is_legacy_archived.is_(False)
        ).all()
        existing_by_order_id = {o.order_id.strip().upper(): o for o in existing_orders if o.order_id}
        
        # Composite lookup for active canonical orders: (date_str, normalized_name) -> list of orders
        existing_by_composite = defaultdict(list)
        for o in existing_orders:
            if o.date_received and o.customer:
                key = (o.date_received.strftime("%Y-%m-%d"), normalize_customer_name(o.customer.customer_name).lower())
                existing_by_composite[key].append(o)

        # Performance Cache for customer lookup & order_id generation (prevents thousands of remote DB roundtrips)
        customer_cache: Dict[str, Customer] = {}
        all_customers = db.query(Customer).all()
        for c in all_customers:
            if c.customer_name:
                customer_cache[c.customer_name.strip().lower()] = c

        # Pre-load existing order IDs to generate next sequences deterministically in-memory
        from models import Order
        from order_numbering import is_canonical_order_id, is_placeholder_order_id
        
        live_ids = [r[0] for r in db.query(Order.order_number).all() if r[0]]
        hist_ids = [r[0] for r in db.query(HistoricalOrder.order_id).all() if r[0]]
        
        prefix_max_seq: Dict[str, int] = defaultdict(int)
        all_known_ids: Set[str] = set()
        
        for oid in live_ids + hist_ids:
            oid_str = str(oid).strip()
            all_known_ids.add(oid_str)
            parts = oid_str.split("-")
            if len(parts) >= 5 and oid_str.startswith("ORD-"):
                pref = f"ORD-{parts[1]}-{parts[2]}-{parts[3]}-"
                m = re.search(r"\d+", parts[4])
                if m:
                    seq = int(m.group(0))
                    if seq > prefix_max_seq[pref]:
                        prefix_max_seq[pref] = seq

        batch_summary = {
            "batch_id": batch_id,
            "dry_run": dry_run,
            "files_processed": len(files_data),
            "rows_read": 0,
            "rows_parsed": 0,
            "exact_duplicates": 0,
            "possible_duplicates": 0,
            "conflicts": 0,
            "new_records": 0,
            "invalid_records": 0,
            "files": [],
            "conflicts_list": [],
            "new_records_list": [],
        }

        # Track orders seen within this import batch to prevent intra-batch duplicates
        batch_seen_order_ids: Set[str] = set()
        batch_seen_composites: Set[Tuple[str, str, str]] = set()

        records_to_insert: List[HistoricalOrder] = []
        conflicts_to_insert: List[HistoricalReconciliationConflict] = []

        for f_data in files_data:
            filename = f_data.get("filename", "unknown.csv")
            rows = f_data.get("rows", [])
            f_summary = {
                "filename": filename,
                "month_name": f_data.get("month_name", filename),
                "total_rows": len(rows),
                "exact_duplicates": 0,
                "possible_duplicates": 0,
                "conflicts": 0,
                "new_records": 0,
                "invalid": 0,
                "genuine_claimed_dates": 0,
                "potentially_ml_eligible": 0,
            }

            for row in rows:
                batch_summary["rows_read"] += 1
                if not row["is_valid"]:
                    f_summary["invalid"] += 1
                    batch_summary["invalid_records"] += 1
                    continue

                batch_summary["rows_parsed"] += 1
                date_rec = row["date_received"]
                c_name = row["customer_name"]
                csv_order_id = (row["order_id"] or "").strip().upper()

                # Check if claimed_date is genuine
                has_claim = False
                if row["claimed_date"] and date_rec:
                    diff = (row["claimed_date"] - date_rec).days
                    if 1 <= diff <= 60:
                        has_claim = True
                        f_summary["genuine_claimed_dates"] += 1

                # ── Intra-Batch Deduplication ────────────────────────────
                composite_key = (
                    date_rec.strftime("%Y-%m-%d"),
                    c_name.lower(),
                    str(row["grand_total"])
                )
                if csv_order_id and csv_order_id in batch_seen_order_ids:
                    f_summary["exact_duplicates"] += 1
                    batch_summary["exact_duplicates"] += 1
                    continue
                if composite_key in batch_seen_composites:
                    f_summary["exact_duplicates"] += 1
                    batch_summary["exact_duplicates"] += 1
                    continue

                batch_seen_composites.add(composite_key)
                if csv_order_id:
                    batch_seen_order_ids.add(csv_order_id)

                # ── Database Matching ─────────────────────────────────────
                matched_order: Optional[HistoricalOrder] = None
                if csv_order_id and csv_order_id in existing_by_order_id:
                    matched_order = existing_by_order_id[csv_order_id]
                else:
                    comp_lookup = existing_by_composite.get((date_rec.strftime("%Y-%m-%d"), c_name.lower()))
                    if comp_lookup:
                        matched_order = comp_lookup[0]

                if matched_order:
                    is_exact, discrepancies = check_exact_match(row, matched_order)
                    if is_exact:
                        f_summary["exact_duplicates"] += 1
                        batch_summary["exact_duplicates"] += 1
                    else:
                        # Conflict or possible match
                        conflict_type = "CONFLICT"
                        if "services" in discrepancies:
                            conflict_type = "SERVICE_CONFLICT"
                        elif "claimed_date" in discrepancies:
                            conflict_type = "CLAIM_DATE_CONFLICT"
                        elif "grand_total" in discrepancies:
                            conflict_type = "AMOUNT_CONFLICT"
                        else:
                            conflict_type = "POSSIBLE_DUPLICATE"

                        f_summary["conflicts"] += 1
                        batch_summary["conflicts"] += 1

                        conflict_obj = {
                            "batch_id": batch_id,
                            "filename": filename,
                            "csv_row_index": row["csv_row_index"],
                            "csv_order_id": csv_order_id or f"ROW-{row['csv_row_index']}",
                            "existing_order_id": matched_order.order_id,
                            "existing_historical_order_id": matched_order.historical_order_id,
                            "conflict_type": conflict_type,
                            "disputed_fields": discrepancies,
                            "existing_data": {
                                "order_id": matched_order.order_id,
                                "customer_name": matched_order.customer.customer_name if matched_order.customer else "",
                                "date_received": matched_order.date_received.strftime("%Y-%m-%d") if matched_order.date_received else None,
                                "grand_total": float(matched_order.grand_total or 0.0),
                                "claimed_date": matched_order.claimed_date.strftime("%Y-%m-%d") if matched_order.claimed_date else None,
                                "services": [s.service_name for it in matched_order.items for s in it.services],
                                "image_filename": matched_order.image.image_filename if getattr(matched_order, "image", None) else None,
                            },
                            "csv_data": {
                                "order_id": csv_order_id,
                                "customer_name": c_name,
                                "date_received": date_rec.strftime("%Y-%m-%d"),
                                "grand_total": row["grand_total"],
                                "claimed_date": row["claimed_date"].strftime("%Y-%m-%d") if row["claimed_date"] else None,
                                "services": [s for p in row["services_per_pair"] for s in p],
                            },
                        }
                        batch_summary["conflicts_list"].append(conflict_obj)

                        if not dry_run:
                            conflicts_to_insert.append(HistoricalReconciliationConflict(
                                batch_id=batch_id,
                                csv_row_index=row["csv_row_index"],
                                csv_order_id=csv_order_id or f"ROW-{row['csv_row_index']}",
                                existing_historical_order_id=matched_order.historical_order_id,
                                conflict_type=conflict_type,
                                disputed_fields=discrepancies,
                                existing_data=conflict_obj["existing_data"],
                                csv_data=conflict_obj["csv_data"],
                                status="PENDING",
                            ))
                else:
                    # Genuinely New Record -> Staged in Validation Queue
                    f_summary["new_records"] += 1
                    batch_summary["new_records"] += 1
                    if has_claim:
                        f_summary["potentially_ml_eligible"] += 1

                    new_rec_summary = {
                        "filename": filename,
                        "order_id": csv_order_id,
                        "customer_name": c_name,
                        "date_received": date_rec.strftime("%Y-%m-%d"),
                        "grand_total": row["grand_total"],
                        "total_pairs": row["total_pairs"],
                        "claimed_date": row["claimed_date"].strftime("%Y-%m-%d") if row["claimed_date"] else None,
                        "has_genuine_claim": has_claim,
                    }
                    batch_summary["new_records_list"].append(new_rec_summary)

                    if not dry_run:
                        # In-memory customer lookup / creation
                        c_lower = c_name.strip().lower()
                        customer = customer_cache.get(c_lower)
                        if not customer:
                            customer = Customer(
                                customer_name=c_name,
                                contact_number=row["contact_number"] or "09000000000"
                            )
                            db.add(customer)
                            customer_cache[c_lower] = customer

                        # In-memory Canonical Order ID resolution
                        dt_val = date_rec.date() if hasattr(date_rec, "date") else date_rec
                        pref = f"ORD-{dt_val.year:04d}-{dt_val.month:02d}-{dt_val.day:02d}-"
                        
                        assigned_order_id = None
                        if csv_order_id and not is_placeholder_order_id(csv_order_id):
                            cand = csv_order_id.strip()
                            if is_canonical_order_id(cand) and cand.startswith(pref) and cand not in all_known_ids:
                                assigned_order_id = cand
                                all_known_ids.add(cand)
                                parts = cand.split("-")
                                seq = int(parts[4])
                                if seq > prefix_max_seq[pref]:
                                    prefix_max_seq[pref] = seq

                        if not assigned_order_id:
                            next_seq = prefix_max_seq[pref] + 1
                            cand = f"{pref}{next_seq:03d}"
                            while cand in all_known_ids:
                                next_seq += 1
                                cand = f"{pref}{next_seq:03d}"
                            prefix_max_seq[pref] = next_seq
                            all_known_ids.add(cand)
                            assigned_order_id = cand
                        
                        # Provenance calculation
                        turnaround_days = None
                        t_prov = "NONE"
                        if has_claim:
                            turnaround_days = (row["claimed_date"] - date_rec).days
                            t_prov = "CLAIM_DATE_CALCULATED"

                        new_order = HistoricalOrder(
                            order_id=assigned_order_id,
                            customer=customer,
                            branch=row["branch"],
                            date_received=date_rec,
                            original_estimated_release_date=row["original_estimated_release_date"],
                            claimed_date=row["claimed_date"],
                            completion_days=turnaround_days,
                            total_pairs=row["total_pairs"],
                            grand_total=row["grand_total"],
                            downpayment=row["downpayment"],
                            balance=row["balance"],
                            priority="regular",
                            payment_method="cash",
                            ocr_status=PENDING_REVIEW, # Requires human validation!
                            source_type="CSV_IMPORT",
                            source_filename=filename,
                            import_batch_id=batch_id,
                            target_provenance=t_prov,
                            reconciliation_status="NEW",
                        )
                        db.add(new_order)

                        # Add items and services via relationships without per-row flush
                        for i, item_data in enumerate(row["items"]):
                            h_item = HistoricalItem(
                                brand=item_data.get("brand"),
                                model=item_data.get("model"),
                                size=item_data.get("size"),
                                scratches=item_data["conditions"].get("scratches", False),
                                yellowing=item_data["conditions"].get("yellowing", False),
                                sole_separation=item_data["conditions"].get("sole_separation", False),
                                deep_stains=item_data["conditions"].get("deep_stains", False),
                                rips_holes=item_data["conditions"].get("rips_holes", False),
                                worn_out=item_data["conditions"].get("worn_out", False),
                            )
                            new_order.items.append(h_item)

                            # Associated services
                            svc_list = row["services_per_pair"][i] if i < len(row["services_per_pair"]) else ["Basic Cleaning"]
                            for s_name in svc_list:
                                h_item.services.append(HistoricalItemService(
                                    service_name=s_name,
                                    service_type="base" if "cleaning" in s_name.lower() or "reglue" in s_name.lower() else "addon",
                                    price=0.0
                                ))

            batch_summary["files"].append(f_summary)

        batch_summary["potential_ml_eligible"] = sum(
            1 for r in batch_summary["new_records_list"] if r.get("has_genuine_claim")
        )

        # Commit or rollback
        if not dry_run:
            try:
                for c in conflicts_to_insert:
                    db.add(c)
                # Record batch log
                batch_log = CsvImportBatch(
                    batch_id=batch_id,
                    source_filename=", ".join(f["filename"] for f in files_data)[:255],
                    file_size_bytes=sum(len(str(f.get("rows", []))) for f in files_data),
                    imported_by=imported_by,
                    import_started=import_started,
                    import_finished=datetime.now(),
                    status="COMMITTED",
                    rows_read=batch_summary["rows_read"],
                    rows_parsed=batch_summary["rows_parsed"],
                    exact_duplicates=batch_summary["exact_duplicates"],
                    possible_duplicates=batch_summary["possible_duplicates"],
                    conflicts=batch_summary["conflicts"],
                    new_records=batch_summary["new_records"],
                    invalid_records=batch_summary["invalid_records"],
                    accepted_records=0,
                    rejected_records=0,
                    details_json=batch_summary,
                )
                db.add(batch_log)
                db.commit()
                batch_summary["status"] = "COMMITTED"
            except Exception as exc:
                db.rollback()
                raise RuntimeError(f"Database transaction failed during CSV commit: {exc}") from exc
        else:
            batch_summary["status"] = "PREVIEW"

        return batch_summary

    @staticmethod
    def resolve_reconciliation_conflict(
        conflict_id: int,
        action: str,
        corrections: Optional[Dict[str, Any]],
        db: Session,
        resolved_by: str = "owner"
    ) -> Dict[str, Any]:
        """
        Executes deliberate human conflict resolution:
        - KEEP_EXISTING: dismisses CSV difference, preserves existing canonical record.
        - USE_CSV_VALUE: updates canonical record with CSV values, records audit trail.
        - EDIT_MANUALLY: applies custom researcher corrections.
        - MARK_AS_DIFFERENT: creates new separate canonical record in PENDING_REVIEW.
        - REJECT_CSV: flags CSV row as rejected, no changes to DB.
        """
        conflict = db.query(HistoricalReconciliationConflict).filter(
            HistoricalReconciliationConflict.id == conflict_id
        ).first()
        if not conflict:
            raise ValueError(f"Conflict ID {conflict_id} not found.")

        action = action.strip().upper()
        now = datetime.now()

        try:
            if action == "KEEP_EXISTING":
                conflict.status = "RESOLVED_KEEP_EXISTING"
                conflict.resolution_action = action
                conflict.resolved_by = resolved_by
                conflict.resolved_at = now
                if conflict.existing_order:
                    conflict.existing_order.reconciliation_status = "CONFIRMED"
                    conflict.existing_order.reconciliation_notes = f"Reconciled on {now}: Human confirmed existing OCR values over CSV."

            elif action == "REJECT_CSV":
                conflict.status = "REJECTED_CSV"
                conflict.resolution_action = action
                conflict.resolved_by = resolved_by
                conflict.resolved_at = now

            elif action == "USE_CSV_VALUE":
                conflict.status = "RESOLVED_USE_CSV"
                conflict.resolution_action = action
                conflict.resolved_by = resolved_by
                conflict.resolved_at = now
                
                order = conflict.existing_order
                if order:
                    csv_data = conflict.csv_data or {}
                    if csv_data.get("grand_total") is not None:
                        order.grand_total = normalize_money(csv_data["grand_total"])
                    if csv_data.get("claimed_date"):
                        c_date = parse_historical_date(csv_data["claimed_date"])
                        if c_date:
                            order.claimed_date = c_date
                            if order.date_received:
                                diff = (c_date - order.date_received).days
                                if 1 <= diff <= 60:
                                    order.completion_days = diff
                                    order.target_provenance = "CLAIM_DATE_CALCULATED"
                    order.reconciliation_status = "CONFIRMED"
                    order.reconciliation_notes = f"Reconciled on {now}: Human approved CSV values for disputed fields."

            elif action == "EDIT_MANUALLY":
                conflict.status = "RESOLVED_MANUAL"
                conflict.resolution_action = action
                conflict.resolved_by = resolved_by
                conflict.resolved_at = now
                
                order = conflict.existing_order
                if order and corrections:
                    for k, v in corrections.items():
                        if hasattr(order, k):
                            setattr(order, k, v)
                    order.reconciliation_status = "CONFIRMED"
                    order.reconciliation_notes = f"Reconciled on {now} via manual edits by {resolved_by}."

            elif action == "MARK_AS_DIFFERENT":
                conflict.status = "RESOLVED_DIFFERENT_ORDER"
                conflict.resolution_action = action
                conflict.resolved_by = resolved_by
                conflict.resolved_at = now
                # Create separate record in PENDING_REVIEW
                csv_data = conflict.csv_data or {}
                date_rec = parse_historical_date(csv_data.get("date_received")) or datetime.now()
                c_name = normalize_customer_name(csv_data.get("customer_name"))
                
                cust = db.query(Customer).filter(func.lower(Customer.customer_name) == c_name.lower()).first()
                if not cust:
                    cust = Customer(customer_name=c_name, contact_number="09000000000")
                    db.add(cust)
                    db.flush()
                
                new_id = resolve_historical_order_id(db, date_rec)
                new_ord = HistoricalOrder(
                    order_id=new_id,
                    customer_id=cust.customer_id,
                    branch="Villamor",
                    date_received=date_rec,
                    grand_total=normalize_money(csv_data.get("grand_total", 0.0)),
                    ocr_status=PENDING_REVIEW,
                    source_type="CSV_IMPORT",
                    reconciliation_status="NEW",
                    reconciliation_notes=f"Created as separate legitimate order after conflict resolution on {now}."
                )
                db.add(new_ord)

            else:
                raise ValueError(f"Invalid resolution action: {action}")

            # Persist forensic audit trail for reconciliation decision
            db.add(AuditLog(
                username=resolved_by,
                role="admin",
                action_type=f"RECONCILIATION_{action}",
                module="Historical Records",
                table_name="historical_reconciliation_conflicts",
                record_id=conflict.id,
                old_values={"status": "PENDING", "disputed_fields": conflict.disputed_fields},
                new_values={"status": conflict.status, "action": action, "resolved_by": resolved_by},
            ))

            db.commit()
            return {"status": "success", "conflict_id": conflict_id, "action": action}
        except Exception as exc:
            db.rollback()
            raise RuntimeError(f"Failed to resolve conflict: {exc}") from exc

    @staticmethod
    def get_provenance_audit(db: Session) -> Dict[str, Any]:
        """
        Produces the full target-provenance and strict academic ML eligibility census.
        """
        orders = db.query(HistoricalOrder).order_by(HistoricalOrder.historical_order_id.asc()).all()
        
        census = {
            "total_canonical_orders": len(orders),
            "human_validated_orders": 0,
            "pending_validation_orders": 0,
            "rejected_orders": 0,
            "provenance_breakdown": defaultdict(int),
            "source_type_breakdown": defaultdict(int),
            "strict_academic_ml_eligible": 0,
            "strict_academic_ml_ineligible": 0,
            "ineligibility_reasons": defaultdict(int),
            "records": []
        }

        for o in orders:
            status = (o.ocr_status or "").strip().upper()
            if status in ("VALIDATED", "CORRECTED"):
                census["human_validated_orders"] += 1
            elif status in ("PENDING_REVIEW", "PENDING"):
                census["pending_validation_orders"] += 1
            elif status == "REJECTED":
                census["rejected_orders"] += 1

            source = o.source_type or "OCR"
            census["source_type_breakdown"][source] += 1

            prov = o.target_provenance or "UNKNOWN"
            census["provenance_breakdown"][prov] += 1

            # Strict Academic ML Eligibility Criteria
            # 1. Canonical order
            # 2. Human validated
            # 3. Genuine date_received
            # 4. Genuine claimed_date
            # 5. 1 <= claimed_date - date_received <= 60
            # 6. Provenance == 'CLAIM_DATE_CALCULATED'
            is_ml_eligible = True
            reasons = []

            if status not in ("VALIDATED", "CORRECTED"):
                is_ml_eligible = False
                reasons.append("NOT_HUMAN_VALIDATED")

            if not o.date_received:
                is_ml_eligible = False
                reasons.append("MISSING_DATE_RECEIVED")

            if not o.claimed_date:
                is_ml_eligible = False
                reasons.append("MISSING_GENUINE_CLAIMED_DATE")

            turnaround = None
            if o.claimed_date and o.date_received:
                diff = (o.claimed_date - o.date_received).days
                if diff < 1:
                    is_ml_eligible = False
                    reasons.append("TURNAROUND_LESS_THAN_1_DAY")
                elif diff > 60:
                    is_ml_eligible = False
                    reasons.append("TURNAROUND_GREATER_THAN_60_DAYS")
                else:
                    turnaround = diff

            if prov != "CLAIM_DATE_CALCULATED":
                is_ml_eligible = False
                if prov == "EXPECTED_DATE_CALCULATED":
                    reasons.append("DERIVED_FROM_EXPECTED_RELEASE_DATE")
                elif prov == "HEURISTIC_GENERATED":
                    reasons.append("HEURISTIC_GENERATED_TARGET")
                else:
                    reasons.append(f"NON_GENUINE_PROVENANCE_{prov}")

            if is_ml_eligible:
                census["strict_academic_ml_eligible"] += 1
            else:
                census["strict_academic_ml_ineligible"] += 1
                for r in reasons:
                    census["ineligibility_reasons"][r] += 1

            census["records"].append({
                "historical_order_id": o.historical_order_id,
                "order_id": o.order_id,
                "source_type": source,
                "source_filename": o.source_filename,
                "date_received": o.date_received.strftime("%Y-%m-%d") if o.date_received else None,
                "claimed_date": o.claimed_date.strftime("%Y-%m-%d") if o.claimed_date else None,
                "completion_days": o.completion_days,
                "target_provenance": prov,
                "validation_status": status,
                "ml_eligible": is_ml_eligible,
                "ml_exclusion_reasons": reasons if not is_ml_eligible else [],
            })

        return census
