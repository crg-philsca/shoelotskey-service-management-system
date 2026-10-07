import os
import sys
from datetime import datetime

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "db"))

from database import SessionLocal
from models import HistoricalOrder, Customer, AuditLog, HistoricalItem, HistoricalItemService

def inspect():
    db = SessionLocal()
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == 1507).first()
    print("=" * 60)
    print("CANDIDATE 1507 DATABASE RECORD INSPECTION")
    print("=" * 60)
    if not order:
        print("ERROR: Order 1507 not found!")
        return

    print("historical_order_id:", order.historical_order_id)
    print("order_id (internal):", order.order_id)
    print("raw_order_id (CSV):", getattr(order, "raw_order_id", None))
    print("ocr_status (validation_status):", order.ocr_status)
    print("sync_status:", order.sync_status)
    print("target_provenance:", order.target_provenance)
    print("completion_days (target):", order.completion_days)
    print("date_received:", order.date_received)
    print("claimed_date:", order.claimed_date)
    print("priority:", order.priority)
    print("grand_total:", order.grand_total)
    print("downpayment:", order.downpayment)
    print("balance:", order.balance)
    print("original_grand_total:", order.original_grand_total)
    print("raw_services:", getattr(order, "raw_services", None))
    print("raw_date_received:", getattr(order, "raw_date_received", None))
    print("raw_claimed_date:", getattr(order, "raw_claimed_date", None))
    print("raw_total:", getattr(order, "raw_total", None))
    print("validated_by:", order.validated_by)
    print("validated_at:", order.validated_at)

    print("\n--- CUSTOMER DATA ---")
    if order.customer:
        print("customer_id:", order.customer.customer_id)
        print("customer_name:", order.customer.customer_name)
        print("contact_number:", order.customer.contact_number)
    else:
        print("Customer relationship is None")

    print("\n--- ITEMS & SERVICES ---")
    print("Items count:", len(order.items))
    for idx, item in enumerate(order.items):
        print(f"Item {idx + 1}:")
        print(f"  historical_item_id: {item.historical_item_id}")
        print(f"  brand: {item.brand}")
        print(f"  model: {item.model}")
        print(f"  color: {item.color}")
        print(f"  size: {item.size}")
        print(f"  material: {item.material}")
        print(f"  item_price: {item.item_price}")
        print(f"  priority: {item.priority}")
        print(f"  remarks: {item.remarks}")
        print(f"  services: {[s.service_name for s in item.services]}")

    print("\n--- AUDIT TRAIL LOGS ---")
    logs = db.query(AuditLog).filter(AuditLog.record_id == 1507).order_by(AuditLog.audit_log_id.desc()).all()
    print(f"Total audit logs found for 1507: {len(logs)}")
    for l in logs:
        print(f"  [Log {l.audit_log_id}] action={l.action_type} user={l.username} at={l.created_at}")
        print(f"    old_values: {l.old_values}")
        print(f"    new_values: {l.new_values}")

    print("\n" + "=" * 60)
    print("DATABASE AGGREGATE COUNTS")
    print("=" * 60)
    from historical.ocr_status import pending_filter_values

    active_count = db.query(HistoricalOrder).filter(HistoricalOrder.is_legacy_archived == False).count()
    pending_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status.in_(pending_filter_values())
    ).count()
    potential_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.potential_ml_candidate == True,
        HistoricalOrder.ocr_status.in_(pending_filter_values())
    ).count()
    validated_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "VALIDATED"
    ).count()
    corrected_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "CORRECTED"
    ).count()
    rejected_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "REJECTED"
    ).count()
    confirmed_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.sync_status == "CONFIRMED_ML_ELIGIBLE"
    ).count()
    clean_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status.in_(["VALIDATED", "CORRECTED"]),
        HistoricalOrder.completion_days.isnot(None),
        HistoricalOrder.target_provenance == "CLAIM_DATE_CALCULATED"
    ).count()

    print(f"Active CSV Historical Records: {active_count} (Expected: 714)")
    print(f"Pending:                      {pending_count} (Expected: 713)")
    print(f"Potential ML Remaining:       {potential_ml_count} (Expected: 119)")
    print(f"Validated:                    {validated_count} (Expected: 1)")
    print(f"Corrected:                    {corrected_count} (Expected: 0)")
    print(f"Rejected:                     {rejected_count} (Expected: 0)")
    print(f"Confirmed ML Eligible:        {confirmed_ml_count} (Expected: 1)")
    print(f"Clean ML Dataset:             {clean_ml_count} (Expected: 1)")

    # Clean ML dataset check
    clean_records = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status.in_(["VALIDATED", "CORRECTED"]),
        HistoricalOrder.completion_days.isnot(None),
        HistoricalOrder.target_provenance == "CLAIM_DATE_CALCULATED"
    ).all()
    print("\n--- CLEAN ML DATASET RECORDS ---")
    print(f"Count: {len(clean_records)}")
    for r in clean_records:
        print(f"  ID: {r.historical_order_id} | Internal ID: {r.order_id} | Source ID: {getattr(r, 'raw_order_id', None)} | Status: {r.ocr_status} | Target: {r.completion_days} | Provenance: {r.target_provenance}")

    # Check Potential ML remaining queue to confirm Candidate 1 is NOT in it
    remaining_potential_ml = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.potential_ml_candidate == True,
        HistoricalOrder.ocr_status.in_(pending_filter_values())
    ).all()
    cand1_in_remaining = any(r.historical_order_id == 1507 for r in remaining_potential_ml)
    print(f"\nCandidate 1507 still in Potential ML Remaining queue? {cand1_in_remaining} (Expected: False)")

    # Check legacy archived records
    legacy_archived = db.query(HistoricalOrder).filter(HistoricalOrder.is_legacy_archived == True).count()
    legacy_in_clean = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == True,
        HistoricalOrder.ocr_status.in_(["VALIDATED", "CORRECTED"])
    ).count()
    print(f"Total Legacy Archived records: {legacy_archived}")
    print(f"Legacy Archived in Clean ML Dataset: {legacy_in_clean} (Expected: 0)")

    db.close()

if __name__ == "__main__":
    inspect()
