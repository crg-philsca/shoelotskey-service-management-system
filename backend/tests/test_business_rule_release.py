"""Official Shoelotskey business-rule release dates vs independent Random Forest."""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import SessionLocal
from ml.ml_engine import ShoelotskeyPredictor


def _order(items, priority="regular", when="2026-09-09T10:00:00"):
    return {
        "items": items,
        "priorityLevel": priority,
        "grandTotal": 325,
        "transactionDate": when,
        "rushReductionDays": 9,
    }


def _item(base, addons=None):
    return {
        "baseService": base,
        "addOns": addons or [],
        "condition": {},
        "shoeMaterial": "Leather",
    }


def test_origin_main_job_order_form_rules():
    db = SessionLocal()
    predictor = ShoelotskeyPredictor()
    try:
        cases = [
            ("A single Basic Cleaning", _order([_item(["Basic Cleaning"])]), 10),
            ("B multiple base services BC+CR", _order([_item(["Basic Cleaning", "Color Renewal"])]), 25),
            ("C Unyellowing with BC", _order([_item(["Basic Cleaning"], [{"name": "Unyellowing", "quantity": 1}])]), 15),
            ("D Minor Reglue with BC", _order([_item(["Basic Cleaning", "Minor Reglue"])]), 10),
            ("E Full Reglue with BC", _order([_item(["Basic Cleaning", "Full Reglue"])]), 25),
            ("F Color Renewal with BC", _order([_item(["Basic Cleaning", "Color Renewal"])]), 25),
            ("G Full Reglue + Unyellowing", _order([_item(["Full Reglue"], [{"name": "Unyellowing", "quantity": 1}])]), 25),
            ("H Rush Basic Cleaning", _order([_item(["Basic Cleaning"])], priority="rush"), 3),
            ("Minor Restoration with BC", _order([_item(["Basic Cleaning"], [{"name": "Minor Restoration", "quantity": 1}])]), 20),
            ("Minor Retouch with BC", _order([_item(["Basic Cleaning"], [{"name": "Minor Retouch", "quantity": 1}])]), 20),
        ]
        for label, payload, expected_days in cases:
            days = predictor.calculate_business_rule_days(db, payload)
            estimate = predictor.estimate_order_release(db, payload)
            official = estimate["business_rule_date"].strftime("%Y-%m-%d")
            assert days == expected_days, f"{label}: days {days} != {expected_days}"
            assert estimate["business_rule_days"] == expected_days, label
            assert official == (datetime(2026, 9, 9) + __import__("datetime").timedelta(days=expected_days)).strftime("%Y-%m-%d"), label
            assert estimate["authoritative"] == "business_rule"
            assert predictor.predict_completion(db, payload).strftime("%Y-%m-%d") == official
    finally:
        db.close()


def test_ml_does_not_override_official_date():
    db = SessionLocal()
    predictor = ShoelotskeyPredictor()
    try:
        payload = _order([_item(["Basic Cleaning"])])
        estimate = predictor.estimate_order_release(db, payload)
        official_days = estimate["business_rule_days"]
        assert official_days == 10
        if estimate["ml_status"] == "invalid":
            assert estimate["ml_predicted_days"] is not None
            assert estimate["ml_predicted_days"] != official_days or estimate["ml_reason"]
            assert estimate["business_rule_days"] == 10
        if estimate["ml_predicted_days"] is not None:
            assert estimate["ml_model"] == "Random Forest Regression"
            assert estimate["ml_source"] == "random_forest"
    finally:
        db.close()


def test_invalid_ml_keeps_business_rule_date():
    db = SessionLocal()
    predictor = ShoelotskeyPredictor()
    try:
        payload = _order([_item(["Basic Cleaning"])])
        official = predictor.estimate_order_release(db, payload)
        original = official["business_rule_date"]
        predictor.last_ml_status = "invalid"
        predictor.last_ml_days = 432.4
        second = predictor.estimate_order_release(db, payload)
        assert second["business_rule_date"].strftime("%Y-%m-%d") == original.strftime("%Y-%m-%d")
        assert second["business_rule_days"] == 10
        assert second["authoritative"] == "business_rule"
    finally:
        db.close()


def test_color_count_addons_are_exclusive():
    from ml.business_rules import color_count_conflict_message

    assert color_count_conflict_message([
        {"addOns": [{"name": "2 Colors"}, {"name": "3 Colors"}]}
    ]) == "Color Renewal can use either 2 Colors or 3 Colors, not both."
    assert color_count_conflict_message([
        {"addOns": [{"name": "2 Colors"}]}
    ]) is None


def test_multi_fr_shoes_use_max_pair_days_not_sum():
    from ml.business_rules import calculate_official_release_days

    days = calculate_official_release_days({
        "priorityLevel": "regular",
        "items": [
            {"baseService": ["Full Reglue"], "addOns": []},
            {"baseService": ["Full Reglue"], "addOns": []},
        ],
    })
    assert days == 25


if __name__ == "__main__":
    test_origin_main_job_order_form_rules()
    test_ml_does_not_override_official_date()
    test_invalid_ml_keeps_business_rule_date()
    test_color_count_addons_are_exclusive()
    test_multi_fr_shoes_use_max_pair_days_not_sum()
    print("Business-rule release tests: PASS")
