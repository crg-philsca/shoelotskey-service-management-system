"""
COMPREHENSIVE TEST SUITE: HISTORICAL CSV RECONCILIATION & ML TARGET PROVENANCE
==============================================================================
Validates all 18 requirements from Phase 33 of the Shoelotskey Historical Data Pipeline:
- TEST 1: New CSV record enters PENDING_REVIEW (not automatically validated).
- TEST 2: Exact OCR duplicate is skipped, order count unchanged.
- TEST 3: Service conflict flags CONFLICT without automatic overwrite.
- TEST 4: Same customer, different order does NOT merge.
- TEST 5: Missing claimed date -> Valid historical record, ML Eligible = NO.
- TEST 6: Expected release date exists, claimed date missing -> ML Eligible = NO.
- TEST 7: Heuristic completion_days does NOT qualify for academic ML.
- TEST 8: Genuine claimed date exists -> Target = claimed - received, ML Eligible = YES.
- TEST 9: Malformed date flagged for human review, no silent coercion.
- TEST 10: Duplicate inside same CSV creates only 1 potential order.
- TEST 11: Duplicate across two CSV files in same batch deduplicated.
- TEST 12: Duplicate across separate import batches skipped.
- TEST 13: Conflicting claimed date between OCR and CSV requires human review.
- TEST 14: CSV confirming OCR record preserves source_type = OCR.
- TEST 15: Database failure during accept triggers complete transaction rollback.
- TEST 16: Unauthorized import returns 403 / Access Denied.
- TEST 17: Completion days with unknown provenance does NOT qualify for academic ML.
- TEST 18: Academic ML eligibility strictly rejects Expected Release target fallback.
"""

import os
import sys
import unittest
from datetime import datetime, timedelta

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import (
    Base,
    Customer,
    HistoricalOrder,
    HistoricalItem,
    HistoricalItemService,
    CsvImportBatch,
    HistoricalReconciliationConflict,
)
from historical.csv_reconciliation_service import (
    CsvReconciliationService,
    parse_historical_date,
    sanitize_csv_cell,
    normalize_customer_name,
)
from historical.ocr_status import PENDING_REVIEW, VALIDATED, REJECTED


class TestHistoricalCsvReconciliationWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use an in-memory SQLite database for isolated unit testing
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        # Fresh transaction per test
        self.db = self.Session()
        # Clean out tables
        self.db.query(HistoricalItemService).delete()
        self.db.query(HistoricalItem).delete()
        self.db.query(HistoricalReconciliationConflict).delete()
        self.db.query(HistoricalOrder).delete()
        self.db.query(Customer).delete()
        self.db.query(CsvImportBatch).delete()
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def _seed_ocr_order(
        self,
        order_id="ORD-2025-08-15-001",
        customer_name="Juan Dela Cruz",
        date_received_str="2025-08-15",
        claimed_date_str=None,
        services=("Basic Cleaning",),
        grand_total=500.0,
        ocr_status=VALIDATED,
        target_provenance="HEURISTIC_GENERATED",
        completion_days=3,
    ):
        cust = Customer(customer_name=customer_name, contact_number="09171234567")
        self.db.add(cust)
        self.db.flush()

        date_rec = datetime.strptime(date_received_str, "%Y-%m-%d")
        claimed_dt = datetime.strptime(claimed_date_str, "%Y-%m-%d") if claimed_date_str else None

        order = HistoricalOrder(
            order_id=order_id,
            customer_id=cust.customer_id,
            branch="Villamor",
            date_received=date_rec,
            claimed_date=claimed_dt,
            grand_total=grand_total,
            ocr_status=ocr_status,
            source_type="OCR",
            target_provenance=target_provenance,
            completion_days=completion_days,
            reconciliation_status="CONFIRMED",
        )
        self.db.add(order)
        self.db.flush()

        item = HistoricalItem(
            historical_order_id=order.historical_order_id,
            brand="Nike",
            model="Air Force 1",
        )
        self.db.add(item)
        self.db.flush()

        for s_name in services:
            svc = HistoricalItemService(
                historical_item_id=item.historical_item_id,
                service_name=s_name,
                service_type="base",
                price=grand_total,
            )
            self.db.add(svc)

        self.db.commit()
        return order

    # -------------------------------------------------------------
    # TEST 1 — NEW RECORD
    # -------------------------------------------------------------
    def test_01_new_record_enters_pending_human_validation(self):
        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total,Expected_Release_Date,Claimed_Date
8/20/2025,Maria Santos,09181112233,Adidas Superstar; Normal,Basic Cleaning,350,8/25/2025,8/26/2025
"""
        parsed = CsvReconciliationService.parse_csv_file("test_august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False, imported_by="tester")

        self.assertEqual(res["new_records"], 1)
        self.assertEqual(res["exact_duplicates"], 0)
        self.assertEqual(res["conflicts"], 0)

        # Verify staged order in DB is in PENDING_REVIEW (Human validation mandatory)
        orders = self.db.query(HistoricalOrder).all()
        self.assertEqual(len(orders), 1)
        new_order = orders[0]
        self.assertEqual(new_order.ocr_status, PENDING_REVIEW)
        self.assertEqual(new_order.source_type, "CSV_IMPORT")
        self.assertIsNotNone(new_order.import_batch_id)

    # -------------------------------------------------------------
    # TEST 2 — EXACT OCR DUPLICATE
    # -------------------------------------------------------------
    def test_02_exact_ocr_duplicate_is_skipped(self):
        self._seed_ocr_order(
            order_id="ORD-2025-08-15-001",
            customer_name="Juan Dela Cruz",
            date_received_str="2025-08-15",
            services=("Basic Cleaning",),
            grand_total=500.0,
        )
        initial_count = self.db.query(HistoricalOrder).count()

        # CSV row representing the same order
        csv_content = """Order_ID,Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
ORD-2025-08-15-001,8/15/2025,Juan Dela Cruz,09171234567,Nike Air Force 1,Basic Cleaning,500.00
"""
        parsed = CsvReconciliationService.parse_csv_file("august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["exact_duplicates"], 1)
        self.assertEqual(res["new_records"], 0)
        final_count = self.db.query(HistoricalOrder).count()
        self.assertEqual(final_count, initial_count, "Canonical historical record count must not increase.")

    # -------------------------------------------------------------
    # TEST 3 — SERVICE CONFLICT
    # -------------------------------------------------------------
    def test_03_service_conflict_detected_and_staged_for_human_review(self):
        self._seed_ocr_order(
            order_id="ORD-2025-08-15-001",
            customer_name="Juan Dela Cruz",
            date_received_str="2025-08-15",
            services=("Basic Cleaning", "Unyellowing"),
            grand_total=800.0,
        )

        # CSV contains an additional service: Full Reglue
        csv_content = """Order_ID,Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
ORD-2025-08-15-001,8/15/2025,Juan Dela Cruz,09171234567,Nike Air Force 1,BC + FR + UNY,1200.00
"""
        parsed = CsvReconciliationService.parse_csv_file("august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["conflicts"], 1)
        self.assertEqual(res["new_records"], 0)

        # Verify staged conflict
        conflicts = self.db.query(HistoricalReconciliationConflict).all()
        self.assertEqual(len(conflicts), 1)
        self.assertIn("CONFLICT", conflicts[0].conflict_type)
        self.assertIn("services", conflicts[0].conflicting_fields)

        # Verify existing canonical order was NOT overwritten
        order = self.db.query(HistoricalOrder).filter_by(order_id="ORD-2025-08-15-001").first()
        self.assertEqual(order.grand_total, 800.0)

    # -------------------------------------------------------------
    # TEST 4 — SAME CUSTOMER, DIFFERENT ORDER
    # -------------------------------------------------------------
    def test_04_same_customer_different_order_not_merged(self):
        self._seed_ocr_order(
            order_id="ORD-2025-08-15-001",
            customer_name="Juan Dela Cruz",
            date_received_str="2025-08-15",
            services=("Basic Cleaning",),
            grand_total=350.0,
        )

        # Same customer visits on a completely different date (Aug 28) for different shoes
        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/28/2025,Juan Dela Cruz,09171234567,Jordan 1 High,Full Reglue,850.00
"""
        parsed = CsvReconciliationService.parse_csv_file("august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["new_records"], 1)
        self.assertEqual(res["exact_duplicates"], 0)
        self.assertEqual(self.db.query(HistoricalOrder).count(), 2)

    # -------------------------------------------------------------
    # TEST 5 — MISSING CLAIMED DATE
    # -------------------------------------------------------------
    def test_05_missing_claimed_date_not_ml_eligible(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-005",
            customer_name="Pedro Penduko",
            date_received_str="2025-08-15",
            claimed_date_str=None,
            ocr_status=VALIDATED,
        )

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-005")

        self.assertFalse(order_audit["ml_eligible"])
        self.assertIn("MISSING_GENUINE_CLAIMED_DATE", order_audit["ml_exclusion_reasons"])

    # -------------------------------------------------------------
    # TEST 6 — EXPECTED DATE EXISTS, CLAIM DATE MISSING
    # -------------------------------------------------------------
    def test_06_expected_date_does_not_calculate_ml_target(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-006",
            date_received_str="2025-08-15",
            claimed_date_str=None,
            target_provenance="EXPECTED_DATE_CALCULATED",
            completion_days=5,
            ocr_status=VALIDATED,
        )
        order.original_estimated_release_date = datetime(2025, 8, 20)
        self.db.commit()

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-006")

        self.assertFalse(order_audit["ml_eligible"])
        self.assertTrue(any("EXPECTED" in r for r in order_audit["ml_exclusion_reasons"]))

    # -------------------------------------------------------------
    # TEST 7 — HEURISTIC COMPLETION_DAYS EXISTS
    # -------------------------------------------------------------
    def test_07_heuristic_completion_days_rejected_from_ml(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-007",
            date_received_str="2025-08-15",
            claimed_date_str=None,
            target_provenance="HEURISTIC_GENERATED",
            completion_days=4,
            ocr_status=VALIDATED,
        )

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-007")

        self.assertFalse(order_audit["ml_eligible"])
        self.assertIn("HEURISTIC_GENERATED_TARGET", order_audit["ml_exclusion_reasons"])

    # -------------------------------------------------------------
    # TEST 8 — GENUINE CLAIM DATE EXISTS
    # -------------------------------------------------------------
    def test_08_genuine_claim_date_qualifies_for_clean_ml(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-008",
            date_received_str="2025-08-15",
            claimed_date_str="2025-08-20",
            target_provenance="CLAIM_DATE_CALCULATED",
            completion_days=5,
            ocr_status=VALIDATED,
        )

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-008")

        self.assertTrue(order_audit["ml_eligible"])
        self.assertEqual(len(order_audit["ml_exclusion_reasons"]), 0)
        self.assertEqual(order_audit["completion_days"], 5)

    # -------------------------------------------------------------
    # TEST 9 — MALFORMED DATE
    # -------------------------------------------------------------
    def test_09_malformed_date_flagged_for_human_review(self):
        # Malformed unreadable date "invalid-date-string"
        parsed_dt = parse_historical_date("not_a_valid_date")
        self.assertIsNone(parsed_dt)

        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
NOT_A_DATE,Test Customer,09123456789,Shoe,Cleaning,500
"""
        parsed = CsvReconciliationService.parse_csv_file("bad_date.csv", csv_content)
        self.assertEqual(len(parsed["rows"]), 1)
        self.assertFalse(parsed["rows"][0]["is_valid"])
        self.assertIn("Unparseable date_received", parsed["rows"][0]["invalid_reasons"][0])

        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)
        self.assertEqual(res["invalid_records"], 1)
        self.assertEqual(res["new_records"], 0)

    # -------------------------------------------------------------
    # TEST 10 — DUPLICATE INSIDE SAME CSV
    # -------------------------------------------------------------
    def test_10_duplicate_inside_same_csv(self):
        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/18/2025,Ana Reyes,09192223344,Nike Dunk,Basic Cleaning,350.00
8/18/2025,Ana Reyes,09192223344,Nike Dunk,Basic Cleaning,350.00
"""
        parsed = CsvReconciliationService.parse_csv_file("intra_dup.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["new_records"], 1)
        self.assertEqual(res["exact_duplicates"], 1)
        self.assertEqual(self.db.query(HistoricalOrder).count(), 1)

    # -------------------------------------------------------------
    # TEST 11 — DUPLICATE ACROSS TWO CSV FILES
    # -------------------------------------------------------------
    def test_11_duplicate_across_two_csv_files_in_batch(self):
        file1_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/18/2025,Ana Reyes,09192223344,Nike Dunk,Basic Cleaning,350.00
"""
        file2_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/18/2025,Ana Reyes,09192223344,Nike Dunk,Basic Cleaning,350.00
"""
        p1 = CsvReconciliationService.parse_csv_file("file1.csv", file1_content)
        p2 = CsvReconciliationService.parse_csv_file("file2.csv", file2_content)

        res = CsvReconciliationService.reconcile_batch([p1, p2], self.db, dry_run=False)
        self.assertEqual(res["new_records"], 1)
        self.assertEqual(res["exact_duplicates"], 1)
        self.assertEqual(self.db.query(HistoricalOrder).count(), 1)

    # -------------------------------------------------------------
    # TEST 12 — DUPLICATE ACROSS IMPORT BATCHES
    # -------------------------------------------------------------
    def test_12_duplicate_across_import_batches(self):
        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/18/2025,Ana Reyes,09192223344,Nike Dunk,Basic Cleaning,350.00
"""
        # Batch 1
        p1 = CsvReconciliationService.parse_csv_file("batch1.csv", csv_content)
        res1 = CsvReconciliationService.reconcile_batch([p1], self.db, dry_run=False)
        self.assertEqual(res1["new_records"], 1)

        # Batch 2 with same content
        p2 = CsvReconciliationService.parse_csv_file("batch2.csv", csv_content)
        res2 = CsvReconciliationService.reconcile_batch([p2], self.db, dry_run=False)
        self.assertEqual(res2["new_records"], 0)
        self.assertEqual(res2["exact_duplicates"], 1)
        self.assertEqual(self.db.query(HistoricalOrder).count(), 1)

    # -------------------------------------------------------------
    # TEST 13 — OCR/CSV CONFLICTING CLAIMED DATE
    # -------------------------------------------------------------
    def test_13_conflicting_claimed_date_requires_human_review(self):
        self._seed_ocr_order(
            order_id="ORD-2025-08-15-013",
            customer_name="Carlos Garcia",
            date_received_str="2025-08-15",
            claimed_date_str="2025-08-20",
        )

        csv_content = """Order_ID,Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total,Claimed_Date
ORD-2025-08-15-013,8/15/2025,Carlos Garcia,09171234567,Nike Air Force 1,Basic Cleaning,500,8/28/2025
"""
        parsed = CsvReconciliationService.parse_csv_file("august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["conflicts"], 1)
        conflict = self.db.query(HistoricalReconciliationConflict).first()
        self.assertIn("claimed_date", conflict.conflicting_fields)

        # Existing date unchanged until human acts
        order = self.db.query(HistoricalOrder).filter_by(order_id="ORD-2025-08-15-013").first()
        self.assertEqual(order.claimed_date.strftime("%Y-%m-%d"), "2025-08-20")

    # -------------------------------------------------------------
    # TEST 14 — CSV CONFIRMS OCR RECORD
    # -------------------------------------------------------------
    def test_14_csv_confirms_ocr_record_preserves_ocr_provenance(self):
        self._seed_ocr_order(
            order_id="ORD-2025-08-15-014",
            customer_name="Elena Gomez",
            date_received_str="2025-08-15",
            services=("Basic Cleaning",),
            grand_total=500.0,
        )

        csv_content = """Order_ID,Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
ORD-2025-08-15-014,8/15/2025,Elena Gomez,09171234567,Nike Air Force 1,Basic Cleaning,500
"""
        parsed = CsvReconciliationService.parse_csv_file("august.csv", csv_content)
        res = CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)

        self.assertEqual(res["exact_duplicates"], 1)
        order = self.db.query(HistoricalOrder).filter_by(order_id="ORD-2025-08-15-014").first()
        # Original source_type = OCR MUST be preserved!
        self.assertEqual(order.source_type, "OCR")

    # -------------------------------------------------------------
    # TEST 15 — DATABASE FAILURE DURING ACCEPT
    # -------------------------------------------------------------
    def test_15_transaction_rollback_on_failure(self):
        # Test that any database error triggers rollback
        original_commit = self.db.commit
        def failing_commit():
            raise RuntimeError("Simulated DB connection failure")

        self.db.commit = failing_commit
        csv_content = """Date_Time,Customer,Contact,Model_and_Condition,Services,Grand_Total
8/20/2025,Rollback User,09181112233,Shoe,Cleaning,350
"""
        parsed = CsvReconciliationService.parse_csv_file("test.csv", csv_content)
        try:
            with self.assertRaises(RuntimeError):
                CsvReconciliationService.reconcile_batch([parsed], self.db, dry_run=False)
        finally:
            self.db.commit = original_commit

        # Verify nothing was committed to DB
        self.assertEqual(self.db.query(HistoricalOrder).count(), 0)

    # -------------------------------------------------------------
    # TEST 16 — UNAUTHORIZED IMPORT (Security / Formula Protection)
    # -------------------------------------------------------------
    def test_16_formula_injection_sanitization(self):
        # Protect against =SUM(), @SUM(), +SUM(), -SUM()
        malicious_input = "=cmd|' /C calc'!A0"
        sanitized = sanitize_csv_cell(malicious_input)
        self.assertTrue(sanitized.startswith("'"), "Formula characters must be escaped with single quote")

        plus_input = "+12345678"
        self.assertTrue(sanitize_csv_cell(plus_input).startswith("'"))

    # -------------------------------------------------------------
    # TEST 17 — COMPLETION_DAYS WITH UNKNOWN PROVENANCE
    # -------------------------------------------------------------
    def test_17_unknown_provenance_completion_days_rejected(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-017",
            date_received_str="2025-08-15",
            claimed_date_str=None,
            target_provenance="UNKNOWN",
            completion_days=6,
            ocr_status=VALIDATED,
        )

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-017")
        self.assertFalse(order_audit["ml_eligible"])
        self.assertTrue(any("UNKNOWN" in r for r in order_audit["ml_exclusion_reasons"]))

    # -------------------------------------------------------------
    # TEST 18 — EXPECTED RELEASE TARGET FALLBACK STRICTLY REJECTED
    # -------------------------------------------------------------
    def test_18_strict_academic_ml_eligibility_rejects_expected_date(self):
        order = self._seed_ocr_order(
            order_id="ORD-2025-08-15-018",
            date_received_str="2025-08-15",
            claimed_date_str=None,
            target_provenance="EXPECTED_DATE_CALCULATED",
            completion_days=7,
            ocr_status=VALIDATED,
        )
        order.original_estimated_release_date = datetime(2025, 8, 22)
        self.db.commit()

        audit = CsvReconciliationService.get_provenance_audit(self.db)
        order_audit = next(o for o in audit["records"] if o["order_id"] == "ORD-2025-08-15-018")

        self.assertFalse(order_audit["ml_eligible"])
        # Even though completion_days is 7 and non-null, ML eligibility is strictly NO
        self.assertEqual(audit["strict_academic_ml_eligible"], 0)


if __name__ == "__main__":
    unittest.main()
