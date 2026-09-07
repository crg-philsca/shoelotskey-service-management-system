from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from datetime import datetime, date

from db.database import get_db
from models import HistoricalOrder, HistoricalImage, HistoricalItem, HistoricalItemService, HistoricalCustomer

router = APIRouter()


# ─── 1. Validation Queue ─────────────────────────────────────────────────────
# Returns records that need human review: OCR-pending images OR records
# with NULL ML-critical fields (completion_days, brand, service_name)

@router.get("/queue")
def get_validation_queue(db: Session = Depends(get_db), limit: int = 20):
    """
    Returns records needing human review.
    Includes:
      1. Images with ocr_status == 'Pending'
      2. Orders with NULL ML-critical fields (completion_days, brand, etc.)
    """
    results = []

    # ── Source A: OCR-pending images ──────────────────────────────────────────
    images = (
        db.query(HistoricalImage)
        .filter(HistoricalImage.ocr_status == "Pending")
        .limit(limit)
        .all()
    )
    for img in images:
        order = img.order
        if order:
            results.append(_build_queue_item(img, order, source="ocr_pending"))

    # ── Source B: Orders with missing ML-critical fields ──────────────────────
    incomplete_orders = (
        db.query(HistoricalOrder)
        .filter(
            (HistoricalOrder.completion_days == None) |
            (HistoricalOrder.claimed_date == None) |
            (HistoricalOrder.priority == None)
        )
        .limit(limit)
        .all()
    )
    existing_ids = {r["order"]["historical_order_id"] for r in results if r.get("order")}
    for order in incomplete_orders:
        if order.historical_order_id in existing_ids:
            continue
        results.append(_build_queue_item(None, order, source="incomplete_fields"))

    return results


def _build_queue_item(img, order, source: str):
    """Build a standardised queue item for the frontend review UI."""
    missing_fields = []
    if not order.completion_days:
        missing_fields.append("completion_days")
    if not order.claimed_date:
        missing_fields.append("claimed_date")
    if not order.priority:
        missing_fields.append("priority")
    items_data = []
    for i in (order.items or []):
        if not i.brand:
            missing_fields.append(f"pair_{i.historical_item_id}_brand")
        if not i.model:
            missing_fields.append(f"pair_{i.historical_item_id}_model")
        conditions_list = []
        if getattr(i, 'scratches', False): conditions_list.append("Scratches")
        if getattr(i, 'yellowing', False): conditions_list.append("Yellowing")
        if getattr(i, 'sole_separation', False): conditions_list.append("Sole Separation")
        if getattr(i, 'deep_stains', False): conditions_list.append("Deep Stains")
        if getattr(i, 'rips_holes', False): conditions_list.append("Rips/Holes")
        if getattr(i, 'worn_out', False): conditions_list.append("Worn Out")

        items_data.append({
            "model": i.model,
            "brand": i.brand,
            "color": i.color,
            "size": i.size,
            "material": getattr(i, 'material', None),
            "base_services": [s.service_name for s in (i.services or []) if s.service_type == "base"],
            "addon_services": [s.service_name for s in (i.services or []) if s.service_type == "addon"],
            "conditions": conditions_list,
            "item_price": float(i.item_price) if getattr(i, 'item_price', None) is not None else None
        })

    return {
        "historical_image_id": img.historical_image_id if img else None,
        "image_filename": img.image_filename if img else None,
        "image_path": img.image_path if img else None,
        "ocr_confidence": img.ocr_confidence if img else 1.0,
        "source": source,
        "missing_fields": missing_fields,
        "order": {
            "historical_order_id": order.historical_order_id,
            "order_id": order.order_id,
            "customer": {
                "name": order.customer.name if order.customer else None,
                "contact": order.customer.contact_number if order.customer else None,
            },
            "date_received": str(order.date_received) if order.date_received else None,
            "expected_release_date": str(order.original_estimated_release_date) if order.original_estimated_release_date else None,
            "claimed_date": str(order.claimed_date) if order.claimed_date else None,
            "completion_days": order.completion_days,
            "priority": order.priority,
            "branch": order.branch,
            "grand_total": float(order.grand_total) if order.grand_total else 0,
            "downpayment": float(order.downpayment) if order.downpayment else 0,
            "balance": float(order.balance) if order.balance else 0,
            "payment_method": order.payment_method,
            "items": items_data,
        },
    }


# ─── 2. Validate / Approve / Reject ──────────────────────────────────────────

def apply_order_corrections(order, corrections, db: Session):
    for field, value in corrections.items():
        if field == "items":
            for item_data in value:
                item_id = item_data.get("historical_item_id")
                if not item_id and "model" in item_data:
                    db_item = next((i for i in order.items if i.model == item_data["model"] and i.brand == item_data.get("brand")), None)
                else:
                    db_item = next((i for i in order.items if i.historical_item_id == item_id), None)
                
                if db_item:
                    for item_field in ["brand", "model", "color", "size", "material", "item_price", "priority", "remarks"]:
                        if item_field in item_data:
                            val = item_data[item_field]
                            if item_field == "item_price" and val == "":
                                val = None
                            setattr(db_item, item_field, val)
                    
                    if "base_services" in item_data or "addon_services" in item_data:
                        from models import HistoricalItemService
                        for s in list(db_item.services):
                            db.delete(s)
                        
                        base_list = item_data.get("base_services", [])
                        addon_list = item_data.get("addon_services", [])
                        for b in base_list:
                            if str(b).strip():
                                db.add(HistoricalItemService(historical_item_id=db_item.historical_item_id, service_name=str(b).strip(), service_type="base", price=0))
                        for a in addon_list:
                            if str(a).strip():
                                db.add(HistoricalItemService(historical_item_id=db_item.historical_item_id, service_name=str(a).strip(), service_type="addon", price=0))
                    
                    if "conditions" in item_data:
                        cond_list = [str(c).lower().strip() for c in item_data["conditions"]]
                        db_item.scratches = "scratches" in cond_list
                        db_item.yellowing = "yellowing" in cond_list
                        db_item.sole_separation = "sole separation" in cond_list
                        db_item.deep_stains = "deep stains" in cond_list
                        db_item.rips_holes = ("rips/holes" in cond_list or "rips / holes" in cond_list)
                        db_item.worn_out = "worn out" in cond_list

        elif field == "customer":
            if order.customer:
                if "customer_name" in value: order.customer.customer_name = value["customer_name"]
                if "contact" in value: order.customer.contact_number = value["contact"]
        elif hasattr(order, field) and field not in ("historical_order_id", "order_id", "audit_trail", "items", "customer"):
            if value == "":
                value = None
            setattr(order, field, value)

    trail = order.audit_trail or []
    trail.append({"timestamp": str(datetime.now()), "changes": "Applied manual corrections"})
    order.audit_trail = trail
    
    # Recalculate completion_days if dates changed
    if order.date_received and order.claimed_date:
        try:
            dr = order.date_received if isinstance(order.date_received, date) else datetime.fromisoformat(str(order.date_received)).date()
            cd = order.claimed_date if isinstance(order.claimed_date, date) else datetime.fromisoformat(str(order.claimed_date)).date()
            order.completion_days = (cd - dr).days
        except Exception:
            pass


@router.post("/validate/{historical_image_id}")
def approve_historical_item(historical_image_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Approves, corrects, or rejects an OCR extraction."""
    img = db.query(HistoricalImage).filter(HistoricalImage.historical_image_id == historical_image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    action = payload.get("action")  # "approve" | "correct" | "reject"

    if action == "reject":
        img.ocr_status = "Rejected"
        img.processed_at = datetime.now()
    elif action == "approve":
        img.ocr_status = "Validated"
        img.processed_at = datetime.now()
    elif action == "correct":
        img.ocr_status = "Corrected"
        img.processed_at = datetime.now()
        if img.order and "corrections" in payload:
            apply_order_corrections(img.order, payload["corrections"], db)

    db.commit()
    return {"status": "success", "new_status": img.ocr_status}


@router.post("/validate-order/{historical_order_id}")
def validate_order_record(historical_order_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Approve or correct a record that has missing fields but no associated image
    (i.e., manually entered or bulk-imported records).
    """
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == historical_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    action = payload.get("action")
    corrections = payload.get("corrections", {})

    if action in ("approve", "correct") and corrections:
        apply_order_corrections(order, corrections, db)
        order.sync_status = "synced"

    db.commit()
    return {"status": "success", "historical_order_id": historical_order_id}


# ─── 3. Stats Endpoint (for ML Training tab) ─────────────────────────────────

@router.get("/stats")
def get_historical_stats(db: Session = Depends(get_db)):
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
    pending_ocr = db.query(HistoricalImage).filter(HistoricalImage.ocr_status == "Pending").count()
    return {
        "total": total,
        "validated": validated,
        "missing_fields": missing_fields,
        "pending_ocr": pending_ocr,
        "ready_for_training": validated,
    }


# ─── 4. Bulk JSON Import ──────────────────────────────────────────────────────

@router.post("/bulk-import")
def bulk_import_records(payload: List[Dict[str, Any]], db: Session = Depends(get_db)):
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


