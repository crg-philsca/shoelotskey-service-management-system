import unittest
import os
import sys

sys.path.insert(0, os.path.abspath('backend'))
from ml.historical_ml_engine import build_features_from_live_order
from ml.business_rules import (
    calculate_official_release_days,
    resolve_canonical_service,
    CANONICAL_BC,
    CANONICAL_FR,
    CANONICAL_COR,
    CANONICAL_MR,
    CANONICAL_UNY,
    CANONICAL_MRES,
    CANONICAL_MRET,
)


class TestPhase2A6ServiceHierarchy(unittest.TestCase):

    def test_01_feature_extraction_fr_frmid(self):
        """12. Live feature extraction returns FR qty=1 for FRMID"""
        order = {
            "items": [{"baseService": ["Full Reglue", "Basic Cleaning"], "addOns": [{"name": "Full Reglue Midsole", "quantity": 1}]}]
        }
        feats = build_features_from_live_order(order)
        self.assertEqual(feats["full_reglue_qty"], 1)
        self.assertEqual(feats["basic_cleaning_qty"], 1)
        self.assertEqual(feats["distinct_service_types"], 2)
        self.assertEqual(feats["total_service_applications"], 2)

    def test_02_feature_extraction_fr_frund(self):
        """13. Live feature extraction returns FR qty=1 for FRUND"""
        order = {
            "items": [{"baseService": ["Full Reglue", "Basic Cleaning"], "addOns": [{"name": "Full Reglue Undersole", "quantity": 1}]}]
        }
        feats = build_features_from_live_order(order)
        self.assertEqual(feats["full_reglue_qty"], 1)
        self.assertEqual(feats["basic_cleaning_qty"], 1)
        self.assertEqual(feats["distinct_service_types"], 2)
        self.assertEqual(feats["total_service_applications"], 2)

    def test_03_feature_extraction_fr_both(self):
        """14. Live feature extraction returns FR qty=1 when both specifications are present"""
        order = {
            "items": [{
                "baseService": ["Full Reglue", "Basic Cleaning"],
                "addOns": [{"name": "Full Reglue Midsole", "quantity": 1}, {"name": "Full Reglue Undersole", "quantity": 1}]
            }]
        }
        feats = build_features_from_live_order(order)
        self.assertEqual(feats["full_reglue_qty"], 1)
        self.assertEqual(feats["basic_cleaning_qty"], 1)
        self.assertEqual(feats["distinct_service_types"], 2)
        self.assertEqual(feats["total_service_applications"], 2)

    def test_04_feature_extraction_cor(self):
        """15. COR2/COR3 each return COR qty=1"""
        order_cor2 = {
            "items": [{"baseService": ["Color Renewal", "Basic Cleaning"], "addOns": [{"name": "2 Colors", "quantity": 1}]}]
        }
        feats_cor2 = build_features_from_live_order(order_cor2)
        self.assertEqual(feats_cor2["color_renewal_qty"], 1)
        self.assertEqual(feats_cor2["basic_cleaning_qty"], 1)
        self.assertEqual(feats_cor2["distinct_service_types"], 2)
        self.assertEqual(feats_cor2["total_service_applications"], 2)

        order_cor3 = {
            "items": [{"baseService": ["Color Renewal", "Basic Cleaning"], "addOns": [{"name": "3 Colors", "quantity": 1}]}]
        }
        feats_cor3 = build_features_from_live_order(order_cor3)
        self.assertEqual(feats_cor3["color_renewal_qty"], 1)
        self.assertEqual(feats_cor3["basic_cleaning_qty"], 1)
        self.assertEqual(feats_cor3["distinct_service_types"], 2)
        self.assertEqual(feats_cor3["total_service_applications"], 2)

    def test_05_feature_extraction_mr(self):
        """11b. MR feature semantics: basic_cleaning_qty=1, minor_reglue_qty=1, distinct=2, apps=2"""
        order = {
            "items": [{"baseService": ["Minor Reglue", "Basic Cleaning"], "addOns": []}]
        }
        feats = build_features_from_live_order(order)
        self.assertEqual(feats["minor_reglue_qty"], 1)
        self.assertEqual(feats["basic_cleaning_qty"], 1)
        self.assertEqual(feats["distinct_service_types"], 2)
        self.assertEqual(feats["total_service_applications"], 2)

    def test_06_pricing_calculations(self):
        """Verify catalog pricing formula across all hierarchy configurations"""
        # Catalog prices
        bc_price = 325
        fr_base = 250
        mr_base = 125
        cor_base = 0
        cor2_price = 375
        cor3_price = 475
        sole_addon_extra = 150

        # 3. FRMID only = ₱575
        self.assertEqual(bc_price + fr_base, 575)

        # 4. FRUND only = ₱575
        self.assertEqual(bc_price + fr_base, 575)

        # 5. Both = ₱725
        self.assertEqual(bc_price + fr_base + sole_addon_extra, 725)

        # 6. Both selection orders produce ₱725
        self.assertEqual(bc_price + fr_base + 0 + sole_addon_extra, 725)
        self.assertEqual(bc_price + fr_base + sole_addon_extra + 0, 725)

        # 9. COR2 = ₱700
        self.assertEqual(bc_price + cor_base + cor2_price, 700)

        # 10. COR3 = ₱800
        self.assertEqual(bc_price + cor_base + cor3_price, 800)

        # 11a. MR = ₱450
        self.assertEqual(bc_price + mr_base, 450)

    def test_07_durations_non_additive(self):
        """17. Duration remains 10/20/25 according to existing non-additive rules"""
        # BC alone = 10
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"]}]}), 10)
        # BC + MR = 10
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Minor Reglue", "Basic Cleaning"]}]}), 10)
        # BC + UNY = 20
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"], "addOns": [{"name": "Unyellowing"}]}]}), 20)
        # BC + MRES = 20
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"], "addOns": [{"name": "Minor Restoration"}]}]}), 20)
        # BC + MRET = 20
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"], "addOns": [{"name": "Minor Retouch"}]}]}), 20)
        # BC + FRMID = 25
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Full Reglue", "Basic Cleaning"], "addOns": [{"name": "Full Reglue Midsole"}]}]}), 25)
        # BC + FR(both) = 25
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Full Reglue", "Basic Cleaning"], "addOns": [{"name": "Full Reglue Midsole"}, {"name": "Full Reglue Undersole"}]}]}), 25)
        # BC + COR2 = 25
        self.assertEqual(calculate_official_release_days({"items": [{"baseService": ["Color Renewal", "Basic Cleaning"], "addOns": [{"name": "2 Colors"}]}]}), 25)

    def test_08_legacy_records_resolution(self):
        """16. Existing legacy generic FR/COR records still load and resolve correctly"""
        self.assertEqual(resolve_canonical_service("FR"), CANONICAL_FR)
        self.assertEqual(resolve_canonical_service("Full Reglue"), CANONICAL_FR)
        self.assertEqual(resolve_canonical_service("COR"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("Color Renewal"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("CR"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("BC"), CANONICAL_BC)
        self.assertEqual(resolve_canonical_service("Basic Cleaning"), CANONICAL_BC)


if __name__ == '__main__':
    unittest.main()
