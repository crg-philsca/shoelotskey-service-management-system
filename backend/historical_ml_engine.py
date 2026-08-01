"""
HISTORICAL ML ENGINE
====================
Dedicated Random Forest engine for the Historical Records module.
Operates ONLY on: historical_orders, historical_items, historical_item_services.
Does NOT read or write to the live orders or items tables.

Architecture:
  Live Prediction     Historical Dataset
        │                    │
        ▼                    ▼
  ml_engine.py    historical_ml_engine.py
        │                    │
  predictor          historical_ml_engine
  (live orders)       (paper receipts)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor
import pickle
import os

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------
HISTORICAL_MODEL_PATH = "backend/historical_rf_model.pkl"
HISTORICAL_MODEL_VERSION = "1.0"

# Branch lookup — update this list if Shoelotskey expands locations
SHOELOTSKEY_BRANCHES = [
    "Villamor",
    # "Makati",
    # "BGC",
    # "Alabang",
]

_PRIORITY_MAP = {"regular": 0, "rush": 1, "premium": 2}

FEATURE_COLS = [
    "total_pairs",
    "basic_cleaning_qty",
    "full_reglue_qty",
    "minor_reglue_qty",
    "full_restoration_qty",
    "minor_restoration_qty",
    "color_renewal_qty",
    "unyellowing_qty",
    "priority_encoded",
    "grand_total",
    "day_of_week_received",
    "month_received",
]


def _count_service(services: list, name: str) -> int:
    """Count how many times a given service name appears in the service list."""
    return sum(1 for s in services if name.lower() in s.get("service_name", "").lower())


def _build_row(order, all_services: list) -> dict:
    """Build a feature row dict from a HistoricalOrder + its flattened services."""
    return {
        "total_pairs":            order.total_pairs or 1,
        "basic_cleaning_qty":     _count_service(all_services, "Basic Cleaning"),
        "full_reglue_qty":        _count_service(all_services, "Full Reglue"),
        "minor_reglue_qty":       _count_service(all_services, "Minor Reglue"),
        "full_restoration_qty":   _count_service(all_services, "Full Restoration"),
        "minor_restoration_qty":  _count_service(all_services, "Minor Restoration"),
        "color_renewal_qty":      _count_service(all_services, "Color Renewal"),
        "unyellowing_qty":        _count_service(all_services, "Unyellowing"),
        "priority_encoded":       _PRIORITY_MAP.get((order.priority or "regular").lower(), 0),
        "grand_total":            float(order.grand_total or 0),
        "day_of_week_received":   order.date_received.weekday() if order.date_received else 0,
        "month_received":         order.date_received.month if order.date_received else 1,
    }


class HistoricalMLEngine:
    """
    Random Forest Regressor engine trained on historical_orders data.

    Responsibilities:
      - export_dataset(db)  → CSV bytes for download
      - train_model(db)     → trains RF, saves .pkl, returns metrics
      - predict(features)   → predicts completion days + release date
      - get_model_info()    → returns current model status
    """

    def __init__(self, model_path: str = HISTORICAL_MODEL_PATH):
        self.model_path = model_path
        self.model = self._load_model()
        self.last_train_date: Optional[str] = None
        self.dataset_size: int = 0

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------
    def _load_model(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, "rb") as f:
                return pickle.load(f)
        return None

    def _flatten_services(self, order) -> list:
        """Return all service dicts for a given HistoricalOrder."""
        services = []
        for item in order.items:
            for svc in item.services:
                services.append({"service_name": svc.service_name})
        return services

    # ------------------------------------------------------------------
    # PUBLIC: Export dataset
    # ------------------------------------------------------------------
    def export_dataset(self, db: Session) -> bytes:
        """
        Queries historical_orders + items + services and exports as CSV.
        Includes only orders with a claimed_date (completed records).
        Returns UTF-8 encoded CSV bytes ready for HTTP streaming.
        """
        from models import HistoricalOrder

        orders = (
            db.query(HistoricalOrder)
            .filter(HistoricalOrder.claimed_date.isnot(None))
            .all()
        )

        if not orders:
            header = ",".join([
                "order_id", "customer_name", "branch", "date_received",
                "expected_release_date", "claimed_date", "completion_days",
                "total_pairs", "grand_total", "downpayment", "balance",
                "priority", "priority_encoded",
                "basic_cleaning_qty", "full_reglue_qty", "minor_reglue_qty",
                "full_restoration_qty", "minor_restoration_qty",
                "color_renewal_qty", "unyellowing_qty",
                "day_of_week_received", "month_received",
            ]) + "\n"
            return header.encode("utf-8")

        rows = []
        for o in orders:
            all_services = self._flatten_services(o)
            base = _build_row(o, all_services)
            rows.append({
                "order_id":              o.order_id,
                "customer_name":         o.customer.customer_name if o.customer else "",
                "branch":                o.branch or "",
                "date_received":         o.date_received.strftime("%Y-%m-%d") if o.date_received else "",
                "expected_release_date": o.expected_release_date.strftime("%Y-%m-%d") if o.expected_release_date else "",
                "claimed_date":          o.claimed_date.strftime("%Y-%m-%d") if o.claimed_date else "",
                "completion_days":       o.completion_days or 0,
                "grand_total":           float(o.grand_total or 0),
                "downpayment":           float(o.downpayment or 0),
                "balance":               float(o.balance or 0),
                "priority":              o.priority or "regular",
                **base,
            })

        df = pd.DataFrame(rows)
        return df.to_csv(index=False).encode("utf-8")

    # ------------------------------------------------------------------
    # PUBLIC: Train model
    # ------------------------------------------------------------------
    def train_model(self, db: Session) -> Dict[str, Any]:
        """
        Trains RandomForestRegressor on historical_orders.
        Target variable: completion_days.
        Requires at least 5 completed records (claimed_date is not null).
        Returns: status, dataset_size, r2_score, mae, model_version, trained_at.
        """
        from models import HistoricalOrder
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score as sk_r2

        orders = (
            db.query(HistoricalOrder)
            .filter(
                HistoricalOrder.claimed_date.isnot(None),
                HistoricalOrder.completion_days.isnot(None),
                HistoricalOrder.completion_days > 0,
            )
            .all()
        )

        if len(orders) < 5:
            return {
                "status": "insufficient_data",
                "message": (
                    f"Need at least 5 completed records to train. "
                    f"Currently have {len(orders)}. "
                    f"Encode more historical orders with a Claimed Date."
                ),
                "dataset_size": len(orders),
            }

        rows = []
        for o in orders:
            all_services = self._flatten_services(o)
            row = _build_row(o, all_services)
            row["completion_days"] = o.completion_days
            rows.append(row)

        df = pd.DataFrame(rows)
        X = df[FEATURE_COLS]
        y = df["completion_days"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        rf = RandomForestRegressor(n_estimators=150, random_state=42, max_depth=10)
        rf.fit(X_train.values, y_train)

        y_pred = rf.predict(X_test.values)
        r2  = round(float(sk_r2(y_test, y_pred)), 4)
        mae = round(float(mean_absolute_error(y_test, y_pred)), 2)

        self.model = rf
        os.makedirs(
            os.path.dirname(self.model_path) if os.path.dirname(self.model_path) else ".",
            exist_ok=True,
        )
        with open(self.model_path, "wb") as f:
            pickle.dump(rf, f)

        self.last_train_date = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.dataset_size = len(orders)

        print(
            f">>> HistoricalMLEngine: Trained | "
            f"n={len(orders)} | R²={r2} | MAE={mae} days"
        )
        return {
            "status":        "success",
            "dataset_size":  len(orders),
            "r2_score":      r2,
            "mae":           mae,
            "model_version": HISTORICAL_MODEL_VERSION,
            "trained_at":    self.last_train_date,
        }

    # ------------------------------------------------------------------
    # PUBLIC: Predict
    # ------------------------------------------------------------------
    def predict(
        self,
        features: Dict[str, Any],
        date_received: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Predicts completion days + estimated release date.
        features must include keys from FEATURE_COLS.
        Returns error dict if model is not yet trained.
        """
        if self.model is None:
            return {
                "error": (
                    "Model is not trained yet. "
                    "Please encode at least 5 historical records and click 'Train Model'."
                )
            }

        row = [features.get(col, 0) for col in FEATURE_COLS]
        predicted_days = max(1, int(round(self.model.predict([row])[0])))

        ref_date = date_received or datetime.now()
        predicted_release = ref_date + timedelta(days=predicted_days)

        return {
            "predicted_completion_days": predicted_days,
            "predicted_release_date":    predicted_release.strftime("%Y-%m-%d"),
            "algorithm":                 "Random Forest Regressor",
            "model_version":             HISTORICAL_MODEL_VERSION,
        }

    # ------------------------------------------------------------------
    # PUBLIC: Model info
    # ------------------------------------------------------------------
    def get_model_info(self) -> Dict[str, Any]:
        """Returns current model file status, training date, and version."""
        model_exists = os.path.exists(self.model_path)
        trained_at = None
        if model_exists:
            mtime = os.path.getmtime(self.model_path)
            trained_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        return {
            "model_trained":    model_exists,
            "algorithm":        "Random Forest Regressor",
            "model_version":    HISTORICAL_MODEL_VERSION,
            "last_trained_at":  trained_at or self.last_train_date,
            "dataset_size":     self.dataset_size,
        }


# ------------------------------------------------------------------
# Singleton — imported by main.py
# ------------------------------------------------------------------
historical_ml_engine = HistoricalMLEngine()
