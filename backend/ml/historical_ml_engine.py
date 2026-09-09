"""
HISTORICAL ML ENGINE
====================
Random Forest engine for validated historical records.
Trains on VALIDATED + ML-eligible finalized records only.
The trained artifact is synced to completion_model.pkl for /api/predict.
"""

import json
import pickle
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy.orm import Session

# Resolve paths relative to this file (not CWD) for Heroku/local consistency.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORICAL_MODEL_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "historical_rf_model.pkl")
)
LIVE_COMPLETION_MODEL_PATH = os.path.join(_BACKEND_DIR, "completion_model.pkl")
HISTORICAL_MODEL_VERSION = "1.2"
MIN_TRAINING_RECORDS = 5
MAX_ML_COMPLETION_DAYS = 60

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
    "scratches_count",
    "yellowing_count",
    "sole_separation_count",
    "deep_stains_count",
    "rips_holes_count",
    "worn_out_count",
]

_CONDITION_KEYS = {
    "scratches": "scratches_count",
    "yellowing": "yellowing_count",
    "soleSeparation": "sole_separation_count",
    "deepStains": "deep_stains_count",
    "ripsHoles": "rips_holes_count",
    "wornOut": "worn_out_count",
}


def _count_service(services: list, name: str) -> int:
    return sum(1 for s in services if name.lower() in s.get("service_name", "").lower())


def _metadata_path(model_path: str) -> str:
    base, _ = os.path.splitext(model_path)
    return base + ".meta.json"


def is_ml_eligible_order(order) -> bool:
    """VALIDATED finalized records with a realistic completion duration target."""
    status = (getattr(order, "ocr_status", None) or "").strip()
    if status not in ("Validated", "Corrected", "VALIDATED", "CORRECTED"):
        return False
    if not getattr(order, "date_received", None):
        return False
    days = getattr(order, "completion_days", None)
    if days is None:
        return False
    try:
        days = float(days)
    except (TypeError, ValueError):
        return False
    # OCR year/date errors produce 300–700+ day targets and poison Random Forest.
    if days < 1 or days > MAX_ML_COMPLETION_DAYS:
        return False
    return True


def _build_row(order, all_services: list) -> dict:
    return {
        "total_pairs": order.total_pairs or 1,
        "basic_cleaning_qty": _count_service(all_services, "Basic Cleaning"),
        "full_reglue_qty": _count_service(all_services, "Full Reglue"),
        "minor_reglue_qty": _count_service(all_services, "Minor Reglue"),
        "full_restoration_qty": _count_service(all_services, "Full Restoration"),
        "minor_restoration_qty": _count_service(all_services, "Minor Restoration"),
        "color_renewal_qty": _count_service(all_services, "Color Renewal"),
        "unyellowing_qty": _count_service(all_services, "Unyellowing"),
        "priority_encoded": _PRIORITY_MAP.get((order.priority or "regular").lower(), 0),
        "grand_total": float(order.grand_total or 0),
        "day_of_week_received": order.date_received.weekday() if order.date_received else 0,
        "month_received": order.date_received.month if order.date_received else 1,
        "scratches_count": sum(1 for i in order.items if getattr(i, "scratches", False)),
        "yellowing_count": sum(1 for i in order.items if getattr(i, "yellowing", False)),
        "sole_separation_count": sum(1 for i in order.items if getattr(i, "sole_separation", False)),
        "deep_stains_count": sum(1 for i in order.items if getattr(i, "deep_stains", False)),
        "rips_holes_count": sum(1 for i in order.items if getattr(i, "rips_holes", False)),
        "worn_out_count": sum(1 for i in order.items if getattr(i, "worn_out", False)),
    }


def build_features_from_live_order(order_data: dict) -> dict:
    """
    Map live Job Order payload (/api/predict) to the historical RF feature contract.
    Uses only information knowable at order creation (no post-completion leakage).
    """
    items = order_data.get("items") or []
    total_pairs = max(1, len(items))
    service_names: List[dict] = []
    condition_counts = {k: 0 for k in _CONDITION_KEYS.values()}

    for item in items:
        base = item.get("baseService") or []
        if isinstance(base, str):
            base = [base]
        addons = item.get("addOns") or []
        for s in base:
            if s:
                service_names.append({"service_name": s})
        for addon in addons:
            name = addon.get("name") if isinstance(addon, dict) else addon
            if name:
                service_names.append({"service_name": name})

        c_data = item.get("condition") or {}
        if isinstance(c_data, dict):
            for key, col in _CONDITION_KEYS.items():
                if c_data.get(key):
                    condition_counts[col] += 1

    priority = str(order_data.get("priorityLevel") or "regular").lower()
    grand_total = float(order_data.get("grandTotal") or 0)

    date_received = datetime.now()
    td = order_data.get("transactionDate") or order_data.get("createdAt")
    if td:
        try:
            dt = datetime.fromisoformat(str(td).replace("Z", "+00:00"))
            date_received = dt.replace(tzinfo=None) if dt.tzinfo else dt
        except Exception:
            pass

    return {
        "total_pairs": total_pairs,
        "basic_cleaning_qty": _count_service(service_names, "Basic Cleaning"),
        "full_reglue_qty": _count_service(service_names, "Full Reglue"),
        "minor_reglue_qty": _count_service(service_names, "Minor Reglue"),
        "full_restoration_qty": _count_service(service_names, "Full Restoration"),
        "minor_restoration_qty": _count_service(service_names, "Minor Restoration"),
        "color_renewal_qty": _count_service(service_names, "Color Renewal"),
        "unyellowing_qty": _count_service(service_names, "Unyellowing"),
        "priority_encoded": _PRIORITY_MAP.get(priority, 0),
        "grand_total": grand_total,
        "day_of_week_received": date_received.weekday(),
        "month_received": date_received.month,
        **condition_counts,
    }


class HistoricalMLEngine:
    def __init__(self, model_path: str = HISTORICAL_MODEL_PATH):
        self.model_path = model_path
        self.metadata = self._load_metadata()
        self.model = self._load_model()
        self.last_train_date: Optional[str] = None
        self.dataset_size: int = int((self.metadata or {}).get("dataset_size") or 0)

    def _load_metadata(self) -> Optional[dict]:
        try:
            meta_path = _metadata_path(self.model_path)
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[HistoricalML] Warning: failed to load metadata: {e}")
        return None

    def _save_metadata(self, metadata: dict, path: Optional[str] = None) -> None:
        meta_path = _metadata_path(path or self.model_path)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        self.metadata = metadata

    def _load_model(self):
        if self.metadata is not None and self.metadata.get("activated") is False:
            return None
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    model = pickle.load(f)
                if not isinstance(model, RandomForestRegressor):
                    print("[HistoricalML] WARNING: artifact is not RandomForestRegressor")
                    return None
                return model
            except Exception as e:
                print(f"[HistoricalML] WARNING: failed to load model ({e})")
        return None

    def reload_model(self):
        self.metadata = self._load_metadata()
        self.model = self._load_model()

    def _query_ml_eligible_orders(self, db: Session):
        from models import HistoricalOrder

        orders = db.query(HistoricalOrder).all()
        return [o for o in orders if is_ml_eligible_order(o)]

    def _flatten_services(self, order) -> list:
        services = []
        for item in order.items:
            for svc in item.services:
                services.append({"service_name": svc.service_name})
        return services

    def export_dataset(self, db: Session) -> bytes:
        from models import HistoricalOrder

        orders = self._query_ml_eligible_orders(db)
        if not orders:
            header = ",".join(
                ["order_id", "customer_name", "branch", "date_received", "completion_days"]
                + FEATURE_COLS
            ) + "\n"
            return header.encode("utf-8")

        rows = []
        for o in orders:
            all_services = self._flatten_services(o)
            base = _build_row(o, all_services)
            rows.append(
                {
                    "order_id": o.order_id,
                    "customer_name": o.customer.customer_name if o.customer else "",
                    "branch": o.branch or "",
                    "date_received": o.date_received.strftime("%Y-%m-%d") if o.date_received else "",
                    "completion_days": o.completion_days or 0,
                    **base,
                }
            )
        return pd.DataFrame(rows).to_csv(index=False).encode("utf-8")

    def train_model(self, db: Session) -> Dict[str, Any]:
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score as sk_r2
        from sklearn.model_selection import train_test_split

        orders = self._query_ml_eligible_orders(db)
        n = len(orders)
        if n < MIN_TRAINING_RECORDS:
            return {
                "status": "insufficient_data",
                "message": (
                    f"Need at least {MIN_TRAINING_RECORDS} VALIDATED ML-eligible records. "
                    f"Currently have {n}."
                ),
                "dataset_size": n,
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

        train_count = n
        test_count = 0
        r2 = None
        mae = None
        rmse = None
        eval_note = None

        if n >= 10:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            train_count = len(X_train)
            test_count = len(X_test)
            eval_model = RandomForestRegressor(n_estimators=150, random_state=42, max_depth=10)
            eval_model.fit(X_train.values, y_train)
            y_pred = eval_model.predict(X_test.values)
            r2 = round(float(sk_r2(y_test, y_pred)), 4)
            mae = round(float(mean_absolute_error(y_test, y_pred)), 2)
            rmse = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 2)
        else:
            eval_note = (
                f"Dataset has {n} records (<10); held-out 80/20 evaluation skipped. "
                f"Model fit on all {n} records; metrics not computed on a separate test split."
            )

        rf = RandomForestRegressor(n_estimators=150, random_state=42, max_depth=10)
        rf.fit(X.values, y)

        os.makedirs(os.path.dirname(self.model_path) or ".", exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(rf, f)

        trained_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.last_train_date = trained_at
        self.dataset_size = n
        self.model = rf

        metadata = {
            "status": "success",
            "activated": True,
            "algorithm": "RandomForestRegressor",
            "model_type": type(rf).__name__,
            "model_version": HISTORICAL_MODEL_VERSION,
            "dataset_version": trained_at,
            "dataset_size": n,
            "train_count": train_count,
            "test_count": test_count,
            "feature_columns": FEATURE_COLS,
            "target": "completion_days (order-to-claim turnaround; claimed_date − date_received)",
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse,
            "trained_at": trained_at,
            "evaluation_note": eval_note if n < 10 else None,
            "data_source": "VALIDATED + ML-eligible historical_orders only",
            "max_completion_days": MAX_ML_COMPLETION_DAYS,
        }
        self._save_metadata(metadata)
        sync_result = self.sync_to_live_predictor(metadata, rf)

        print(
            f">>> HistoricalMLEngine: Trained n={n} train={train_count} test={test_count} "
            f"R²={r2} MAE={mae} RMSE={rmse} synced={sync_result.get('synced')}"
        )
        return {
            "status": "success",
            "dataset_size": n,
            "train_count": train_count,
            "test_count": test_count,
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse,
            "model_version": HISTORICAL_MODEL_VERSION,
            "trained_at": trained_at,
            "model_type": type(rf).__name__,
            "activated": True,
            "synced_to_live_predictor": sync_result.get("synced", False),
            **({"evaluation_note": eval_note} if n < 10 else {}),
        }

    def sync_to_live_predictor(self, metadata: Optional[dict] = None, model=None) -> Dict[str, Any]:
        """Copy trained RF artifact + metadata to completion_model.pkl for /api/predict."""
        model = model or self.model
        metadata = metadata or self.metadata
        if model is None or metadata is None:
            return {"synced": False, "reason": "no model or metadata"}

        try:
            with open(LIVE_COMPLETION_MODEL_PATH, "wb") as f:
                pickle.dump(model, f)
            live_meta = dict(metadata)
            live_meta["live_predictor_path"] = LIVE_COMPLETION_MODEL_PATH
            live_meta["source_engine"] = "historical_ml_engine"
            self._save_metadata(live_meta, LIVE_COMPLETION_MODEL_PATH)
            return {"synced": True, "path": LIVE_COMPLETION_MODEL_PATH}
        except Exception as e:
            print(f"[HistoricalML] sync_to_live_predictor failed: {e}")
            return {"synced": False, "reason": str(e)}

    def predict(self, features: Dict[str, Any], date_received: Optional[datetime] = None) -> Dict[str, Any]:
        if self.model is None:
            return {
                "error": (
                    "Model is not trained yet. "
                    "Finalize at least 5 VALIDATED ML-eligible historical records and train."
                )
            }

        row = [features.get(col, 0) for col in FEATURE_COLS]
        predicted_days = max(1, int(round(float(self.model.predict([row])[0]))))
        ref_date = date_received or datetime.now()
        return {
            "predicted_completion_days": predicted_days,
            "predicted_release_date": (ref_date + timedelta(days=predicted_days)).strftime("%Y-%m-%d"),
            "algorithm": "Random Forest Regressor",
            "model_version": HISTORICAL_MODEL_VERSION,
            "source": "random_forest",
        }

    def predict_live_order(self, order_data: dict) -> Optional[float]:
        """Return predicted days for a live order payload, or None if model unavailable."""
        if self.model is None:
            return None
        features = build_features_from_live_order(order_data)
        row = [features.get(col, 0) for col in FEATURE_COLS]
        return max(1.0, float(self.model.predict([row])[0]))

    def get_model_info(self) -> Dict[str, Any]:
        model_exists = os.path.exists(self.model_path)
        meta = self.metadata or {}
        trained_at = meta.get("trained_at")
        if not trained_at and model_exists:
            trained_at = datetime.fromtimestamp(os.path.getmtime(self.model_path)).strftime("%Y-%m-%d %H:%M")
        return {
            "model_trained": model_exists and self.model is not None,
            "model_loaded": self.model is not None,
            "algorithm": "Random Forest Regressor" if self.model is not None else "Not loaded",
            "model_type": type(self.model).__name__ if self.model is not None else None,
            "model_version": meta.get("model_version", HISTORICAL_MODEL_VERSION),
            "last_trained_at": trained_at or self.last_train_date,
            "dataset_size": meta.get("dataset_size", self.dataset_size),
            "r2_score": meta.get("r2_score"),
            "mae": meta.get("mae"),
            "rmse": meta.get("rmse"),
            "train_count": meta.get("train_count"),
            "test_count": meta.get("test_count"),
        }


historical_ml_engine = HistoricalMLEngine()
