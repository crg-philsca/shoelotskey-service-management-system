"""ML pipeline tests — validated historical training + live /api/predict integration."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.ensemble import RandomForestRegressor

from db.database import SessionLocal
from ml.historical_ml_engine import (
    historical_ml_engine,
    is_ml_eligible_order,
    MIN_TRAINING_RECORDS,
    MAX_ML_COMPLETION_DAYS,
    FEATURE_COLS,
    build_features_from_live_order,
)
from ml.ml_engine import ShoelotskeyPredictor


def test_feature_vector_contract_no_leakage():
    """Train/predict must share the locked 18-feature vector with no post-receipt leakage."""
    assert len(FEATURE_COLS) == 18
    forbidden = {
        "claimed_date",
        "completion_days",
        "workload",
        "material",
        "released_at",
        "expected_at",
    }
    assert forbidden.isdisjoint(set(FEATURE_COLS))
    live = build_features_from_live_order(
        {
            "items": [
                {
                    "baseService": ["Basic Cleaning"],
                    "addOns": [],
                    "condition": {"yellowing": True},
                    "shoeMaterial": "Suede",
                }
            ],
            "priorityLevel": "rush",
            "grandTotal": 325,
            "transactionDate": "2025-08-20T10:00:00",
            "claimed_date": "2025-09-01",  # must never become a feature
            "completion_days": 12,
        }
    )
    assert set(live.keys()) == set(FEATURE_COLS)
    assert "claimed_date" not in live
    assert "completion_days" not in live
    assert "material" not in live
    assert live["priority_encoded"] == 1
    assert live["yellowing_count"] == 1
    assert live["month_received"] == 8


def test_ml_eligible_query_count():
    db = SessionLocal()
    try:
        eligible = historical_ml_engine._query_ml_eligible_orders(db)
        assert len(eligible) >= MIN_TRAINING_RECORDS, (
            f"Need >={MIN_TRAINING_RECORDS} ML-eligible records, got {len(eligible)}"
        )
        for o in eligible:
            assert is_ml_eligible_order(o)
            assert 1 <= float(o.completion_days) <= MAX_ML_COMPLETION_DAYS
    finally:
        db.close()


def test_train_and_reload_random_forest():
    db = SessionLocal()
    try:
        result = historical_ml_engine.train_model(db)
        assert result["status"] == "success", result
        assert result["dataset_size"] >= MIN_TRAINING_RECORDS
        assert result["model_type"] == "RandomForestRegressor"

        predictor = ShoelotskeyPredictor()
        assert isinstance(predictor.model, RandomForestRegressor)
        status = predictor.get_status()
        assert status["model_loaded"] is True
        assert status["algorithm"] == "Random Forest Regressor"
        assert os.path.exists(predictor.model_path)
    finally:
        db.close()


def test_predict_returns_source():
    db = SessionLocal()
    try:
        predictor = ShoelotskeyPredictor()
        order_data = {
            "items": [
                {
                    "baseService": ["Basic Cleaning", "Minor Reglue"],
                    "addOns": [],
                    "condition": {},
                    "shoeMaterial": "Leather",
                }
            ],
            "priorityLevel": "regular",
            "grandTotal": 800,
            "transactionDate": "2026-09-09T10:00:00",
        }
        estimate = predictor.estimate_order_release(db, order_data)
        assert estimate["authoritative"] == "business_rule"
        assert estimate["business_rule_days"] == 10
        assert estimate["ml_model"] == "Random Forest Regression"
        assert estimate["ml_status"] in ("valid", "invalid", "unavailable")
        if estimate["ml_status"] == "valid":
            assert 1 <= float(estimate["ml_predicted_days"]) <= MAX_ML_COMPLETION_DAYS
            assert estimate["ml_predicted_date"] is not None
        else:
            assert estimate["ml_predicted_date"] is None
        dt = predictor.predict_completion(db, order_data)
        assert dt.strftime("%Y-%m-%d") == estimate["business_rule_date"].strftime("%Y-%m-%d")
        second = predictor.predict_completion(db, order_data)
        assert dt.strftime("%Y-%m-%d") == second.strftime("%Y-%m-%d")
    finally:
        db.close()


def test_predict_date_matches_engine_for_basic_cleaning():
    """Form preview (/api/predict) and persist must share one engine result."""
    db = SessionLocal()
    try:
        predictor = ShoelotskeyPredictor()
        order_data = {
            "items": [
                {
                    "baseService": ["Basic Cleaning"],
                    "addOns": [],
                    "condition": {},
                    "shoeMaterial": "Leather",
                }
            ],
            "priorityLevel": "regular",
            "grandTotal": 325,
            "transactionDate": "2026-09-09T06:21:00",
        }
        estimate = predictor.estimate_order_release(db, order_data)
        assert estimate["business_rule_days"] == 10
        first = predictor.predict_completion(db, order_data)
        second = predictor.predict_completion(db, order_data)
        assert first.date() == second.date()
        assert first.strftime("%Y-%m-%d") == estimate["business_rule_date"].strftime("%Y-%m-%d")
        assert estimate["ml_status"] in ("valid", "invalid", "unavailable")
        if estimate["ml_status"] == "valid":
            assert 1 <= float(estimate["ml_predicted_days"]) <= MAX_ML_COMPLETION_DAYS
            assert estimate["ml_predicted_date"] is not None
        else:
            assert estimate["ml_predicted_date"] is None
    finally:
        db.close()


if __name__ == "__main__":
    test_feature_vector_contract_no_leakage()
    test_ml_eligible_query_count()
    test_train_and_reload_random_forest()
    test_predict_returns_source()
    test_predict_date_matches_engine_for_basic_cleaning()
    print("ML pipeline tests: PASS")
