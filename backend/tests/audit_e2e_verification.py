import os
import sys
import hashlib
from datetime import datetime, timezone
import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
db_dir = os.path.join(BASE_DIR, "db")
if db_dir not in sys.path:
    sys.path.insert(0, db_dir)

from sqlalchemy.orm import Session
from db.database import get_db, SessionLocal
from models import Customer, HistoricalOrder, HistoricalReconciliationConflict, CsvImportBatch, AuditLog, Order
from historical.csv_reconciliation_service import CsvReconciliationService
from api.historical_processing import (
    get_validation_queue,
    apply_queue_review_action,
    serialize_historical_order
)

def get_file_hash(filepath):
    if not os.path.exists(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def test_audit_e2e_reconciliation_and_validation():
    db: Session = SessionLocal()
    try:
        # 1. Verify Model files safety
        model_paths = [
            os.path.join(os.path.dirname(__file__), "..", "completion_model.pkl"),
            os.path.join(os.path.dirname(__file__), "..", "historical_rf_model.pkl"),
            os.path.join(os.path.dirname(__file__), "..", "completion_model.meta.json"),
            os.path.join(os.path.dirname(__file__), "..", "historical_rf_model.meta.json"),
        ]
        initial_hashes = {p: get_file_hash(p) for p in model_paths if os.path.exists(p)}
        initial_mtimes = {p: os.path.getmtime(p) for p in model_paths if os.path.exists(p)}

        # 2. Verify 725 canonical records exist
        canonical_count = db.query(HistoricalOrder).count()
        assert canonical_count == 725, f"Expected 725 canonical records, found {canonical_count}"

        # Check genuine vs heuristic ML targets in existing canonical records
        genuine_canonical = db.query(HistoricalOrder).filter(
            HistoricalOrder.target_provenance == "CLAIM_DATE_CALCULATED"
        ).count()
        heuristic_canonical = db.query(HistoricalOrder).filter(
            HistoricalOrder.target_provenance.in_(["EXPECTED_DATE_CALCULATED", "HEURISTIC_GENERATED"])
        ).count()
        assert genuine_canonical == 14, f"Expected 14 genuine targets, got {genuine_canonical}"
        assert heuristic_canonical == 711, f"Expected 711 heuristic targets, got {heuristic_canonical}"

        # 3. Verify CSV Preview
        source_dir = os.path.join(os.path.dirname(__file__), "..", "historical_data", "source", "csv")
        csv_names = [
            "shoelotskey_august_dataset.csv",
            "shoelotskey_september_dataset.csv",
            "shoelotskey_october_dataset.csv",
            "shoelotskey_november_dataset.csv",
            "shoelotskey_december_dataset.csv",
            "shoelotskey_january_dataset.csv",
        ]
        files_data = []
        for name in csv_names:
            p = os.path.join(source_dir, name)
            with open(p, "r", encoding="utf-8") as f:
                files_data.append(CsvReconciliationService.parse_csv_file(name, f.read()))

        preview = CsvReconciliationService.reconcile_batch(
            files_data=files_data,
            db=db,
            dry_run=True,
            imported_by="auditor_lead"
        )
        assert preview["files_processed"] == 6
        assert preview["rows_read"] == 721
        assert preview["rows_parsed"] == 693
        assert preview["new_records"] == 624, f"Expected 624 pending, got {preview['new_records']}"
        assert preview["conflicts"] == 48, f"Expected 48 conflicts, got {preview['conflicts']}"
        assert preview["invalid_records"] == 28, f"Expected 28 invalid rows, got {preview['invalid_records']}"
        assert preview["potential_ml_eligible"] == 102, f"Expected 102 potential ML, got {preview['potential_ml_eligible']}"

        # Confirm all 28 invalid rows have explicit reasons
        all_invalid = [r for f in files_data for r in f.get("rows", []) if not r.get("is_valid")]
        assert len(all_invalid) == 28, f"Expected 28 invalid rows, got {len(all_invalid)}"
        for inv in all_invalid:
            assert "invalid_reasons" in inv and len(inv["invalid_reasons"]) > 0

        # 4. Verify Validation Queue logic includes non-image CSV orders
        test_customer = None
        test_order = None
        test_conflict = None
        try:
            # Create a test pending CSV record
            test_customer = Customer(
                customer_name="Juan Audit Test",
                contact_number="09171234567"
            )
            db.add(test_customer)
            db.commit()
            db.refresh(test_customer)

            test_order = HistoricalOrder(
                order_id="AUDIT-TEST-001",
                customer_id=test_customer.customer_id,
                branch="Villamor",
                date_received=datetime(2024, 8, 10),
                original_estimated_release_date=datetime(2024, 8, 15),
                claimed_date=datetime(2024, 8, 14),
                completion_days=4,
                total_pairs=1,
                grand_total=325.0,
                downpayment=325.0,
                balance=0.0,
                priority="regular",
                sync_status="local",
                ocr_status="PENDING_REVIEW",
                source_type="CSV_IMPORT",
                target_provenance="CLAIM_DATE_CALCULATED",
                reconciliation_status="NEW_RECORD",
                import_batch_id="AUDIT_BATCH",
                source_filename="audit_test.csv"
            )
            db.add(test_order)
            db.commit()
            db.refresh(test_order)

            # Confirm serialized order reflects potential_ml_eligible = True, ml_eligible = False before human validation
            serialized = serialize_historical_order(test_order)
            assert serialized["potential_ml_eligible"] is True
            assert serialized["ml_eligible"] is False
            assert serialized["ml_exclusion_reason"] == "AWAITING_HUMAN_VALIDATION"

            # Check that test_order appears in validation queue
            queue_result = get_validation_queue(db=db, limit=20, source_filter="csv")
            found_in_queue = any(
                item.get("order", {}).get("historical_order_id") == test_order.historical_order_id
                or item.get("historical_order_id") == test_order.historical_order_id
                for item in queue_result["items"]
            )
            assert found_in_queue, "Pending CSV record without image must appear in validation queue"

            # 5. Apply Human Validation Approval on the pending record
            from types import SimpleNamespace
            action_result = apply_queue_review_action(
                action="approve",
                img=None,
                order=test_order,
                corrections={},
                db=db,
                current_user=SimpleNamespace(username="auditor_lead", role="admin", user_id=1)
            )
            assert action_result == "VALIDATED"
            db.commit()
            assert test_order.ocr_status == "VALIDATED"
            assert test_order.validated_by == "auditor_lead"
            assert test_order.validated_at is not None

            # Re-serialize to verify it is now officially ml_eligible = True
            serialized_approved = serialize_historical_order(test_order)
            assert serialized_approved["ml_eligible"] is True
            assert serialized_approved["target_provenance"] == "CLAIM_DATE_CALCULATED"
            assert serialized_approved["completion_days"] == 4

            # Verify AuditLog row was created for human approval
            audit_entry = db.query(AuditLog).filter(
                AuditLog.record_id == test_order.historical_order_id,
                AuditLog.action_type == "HISTORICAL_VALIDATE"
            ).first()
            assert audit_entry is not None
            assert audit_entry.username == "auditor_lead"

            # 6. Test Conflict Resolution & Audit Trail
            test_conflict = HistoricalReconciliationConflict(
                batch_id="AUDIT_BATCH",
                csv_row_index=10,
                csv_order_id="AUDIT-CONFLICT-001",
                conflict_type="SERVICE_CONFLICT",
                status="PENDING",
                disputed_fields=["services"],
                existing_data={"order_id": "AUDIT-CONFLICT-001", "claimed_date": "2024-08-15"},
                csv_data={"order_id": "AUDIT-CONFLICT-001", "claimed_date": "2024-08-16"}
            )
            db.add(test_conflict)
            db.commit()
            db.refresh(test_conflict)

            # Resolve conflict using service
            resolve_res = CsvReconciliationService.resolve_reconciliation_conflict(
                conflict_id=test_conflict.id,
                action="KEEP_EXISTING",
                corrections=None,
                db=db,
                resolved_by="auditor_lead"
            )
            assert resolve_res["status"] == "success"
            assert resolve_res["action"] == "KEEP_EXISTING"

            # Check AuditLog for conflict resolution
            conflict_audit = db.query(AuditLog).filter(
                AuditLog.record_id == test_conflict.id,
                AuditLog.action_type == "RECONCILIATION_KEEP_EXISTING"
            ).first()
            assert conflict_audit is not None
            assert conflict_audit.username == "auditor_lead"
        finally:
            # 7. Clean up test records
            if test_conflict and getattr(test_conflict, "id", None):
                db.delete(test_conflict)
            if test_order and test_order.historical_order_id:
                db.delete(test_order)
            if test_customer and test_customer.customer_id:
                db.delete(test_customer)
            to_delete_ids = []
            if test_order and test_order.historical_order_id:
                to_delete_ids.append(test_order.historical_order_id)
            if test_conflict and getattr(test_conflict, "id", None):
                to_delete_ids.append(test_conflict.id)
            if to_delete_ids:
                db.query(AuditLog).filter(
                    AuditLog.record_id.in_(to_delete_ids)
                ).delete(synchronize_session=False)
            db.commit()

        # Re-verify canonical count is strictly preserved at 725
        final_canonical_count = db.query(HistoricalOrder).count()
        assert final_canonical_count == 725, f"Canonical count changed! Expected 725, got {final_canonical_count}"

        # 8. Check ML Model files safety (strict check)
        for p, initial_hash in initial_hashes.items():
            current_hash = get_file_hash(p)
            assert current_hash == initial_hash, f"CRITICAL: Model file {p} was modified!"
        for p, initial_mtime in initial_mtimes.items():
            current_mtime = os.path.getmtime(p)
            assert current_mtime == initial_mtime, f"CRITICAL: Model file {p} timestamp changed!"

        print("\nALL AUDIT E2E CHECKS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    test_audit_e2e_reconciliation_and_validation()
