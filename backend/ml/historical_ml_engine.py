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
        acc_1 = None
        acc_2 = None
        acc_3 = None
        count_1 = None
        count_2 = None
        count_3 = None
        mean_actual = None
        mean_pred = None
        median_abs_err = None
        max_abs_err = None
        min_abs_err = None
        target_85_status = None
        test_predictions: List[Dict[str, Any]] = []

        if n >= 10:
            indices = np.arange(n)
            train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42)
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
            test_orders = [orders[i] for i in test_idx]

            train_count = len(X_train)
            test_count = len(X_test)
            eval_model = RandomForestRegressor(n_estimators=150, random_state=42, max_depth=10)
            eval_model.fit(X_train.values, y_train)
            y_pred = eval_model.predict(X_test.values)

            r2 = round(float(sk_r2(y_test, y_pred)), 4)
            mae = round(float(mean_absolute_error(y_test, y_pred)), 2)
            rmse = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 2)

            abs_errors = np.abs(y_test.values - y_pred)
            acc_1 = round(float(np.mean(abs_errors <= 1.0) * 100), 2)
            acc_2 = round(float(np.mean(abs_errors <= 2.0) * 100), 2)
            acc_3 = round(float(np.mean(abs_errors <= 3.0) * 100), 2)
            count_1 = int(np.sum(abs_errors <= 1.0))
            count_2 = int(np.sum(abs_errors <= 2.0))
            count_3 = int(np.sum(abs_errors <= 3.0))

            mean_actual = round(float(np.mean(y_test.values)), 2)
            mean_pred = round(float(np.mean(y_pred)), 2)
            median_abs_err = round(float(np.median(abs_errors)), 2)
            max_abs_err = round(float(np.max(abs_errors)), 2)
            min_abs_err = round(float(np.min(abs_errors)), 2)
            target_85_status = "TARGET MET" if acc_2 >= 85.0 else "TARGET NOT MET"

            for i in range(len(test_orders)):
                to = test_orders[i]
                svcs = self._flatten_services(to)
                svc_names = sorted(list(set(s.get("service_name") for s in svcs if s.get("service_name"))))
                test_predictions.append({
                    "test_id": f"O2-TEST-{i+1:03d}",
                    "order_id": to.order_id,
                    "service_summary": " + ".join(svc_names) if svc_names else "Standard Service",
                    "total_pairs": int(to.total_pairs or 1),
                    "services_count": len(svcs),
                    "priority": str(to.priority or "regular").title(),
                    "actual_completion_days": round(float(y_test.values[i]), 1),
                    "predicted_completion_days": round(float(y_pred[i]), 1),
                    "absolute_error": round(float(abs_errors[i]), 1),
                    "within_1_day": bool(abs_errors[i] <= 1.0),
                    "within_2_days": bool(abs_errors[i] <= 2.0),
                    "within_3_days": bool(abs_errors[i] <= 3.0),
                })
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
            "target_type": "historical_order_to_claim",
            "target_definition": "Historical Order-to-Claim Turnaround (claimed_date − date_received)",
            "actual_completion_target_available": False,
            "actual_completion_note": "Physical paper receipts did not record technician finish timestamps. Digital forward orders record actual_release_at.",
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse,
            "accuracy_within_1_day": acc_1,
            "accuracy_within_2_days": acc_2,
            "accuracy_within_3_days": acc_3,
            "target_85_status": target_85_status,
            "count_within_1_day": count_1,
            "count_within_2_days": count_2,
            "count_within_3_days": count_3,
            "mean_actual_duration": mean_actual,
            "mean_predicted_duration": mean_pred,
            "median_absolute_error": median_abs_err,
            "max_absolute_error": max_abs_err,
            "min_absolute_error": min_abs_err,
            "test_predictions": test_predictions,
            "trained_at": trained_at,
            "evaluation_note": eval_note if n < 10 else None,
            "data_source": "VALIDATED + ML-eligible historical_orders only",
            "max_completion_days": MAX_ML_COMPLETION_DAYS,
        }
        self._save_metadata(metadata)
        sync_result = self.sync_to_live_predictor(metadata, rf)

        print(
            f">>> HistoricalMLEngine: Trained n={n} train={train_count} test={test_count} "
            f"R²={r2} MAE={mae} RMSE={rmse} ±2d={acc_2}% ({target_85_status}) synced={sync_result.get('synced')}"
        )
        return {
            "status": "success",
            "dataset_size": n,
            "train_count": train_count,
            "test_count": test_count,
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse,
            "accuracy_within_1_day": acc_1,
            "accuracy_within_2_days": acc_2,
            "accuracy_within_3_days": acc_3,
            "target_85_status": target_85_status,
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
        raw_pred = float(self.model.predict([row])[0])
        if features.get("priority_encoded") == 1:
            raw_pred = max(1.0, raw_pred - 9.0)
        predicted_days = max(1, int(round(raw_pred)))
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
        raw_pred = float(self.model.predict([row])[0])
        if features.get("priority_encoded") == 1:
            rush_red = float(order_data.get("rushReductionDays") or 9)
            raw_pred = max(1.0, raw_pred - rush_red)
        return max(1.0, raw_pred)

    def get_dataset_funnel(self, db: Session) -> Dict[str, Any]:
        from models import HistoricalOrder
        all_orders = db.query(HistoricalOrder).all()
        total = len(all_orders)
        with_received = sum(1 for o in all_orders if o.date_received)
        with_est = sum(1 for o in all_orders if o.original_estimated_release_date)
        with_claimed = sum(1 for o in all_orders if o.claimed_date)
        with_actual = 0  # Physical paper receipts did not record technician finish timestamps

        cat_a = 0
        cat_b = sum(1 for o in all_orders if o.date_received and o.original_estimated_release_date)
        cat_c = sum(1 for o in all_orders if o.date_received and o.claimed_date and not o.original_estimated_release_date)
        cat_d = total - (cat_b + cat_c)

        with_valid_days = sum(1 for o in all_orders if o.completion_days and 1 <= o.completion_days <= MAX_ML_COMPLETION_DAYS)
        eligible = [o for o in all_orders if is_ml_eligible_order(o)]
        eligible_count = len(eligible)

        reasons = {
            "insufficient_dates": total - (with_est if with_est > with_claimed else with_claimed),
            "unvalidated_ocr": sum(1 for o in all_orders if (getattr(o, "ocr_status", "") or "").strip() not in ("Validated", "Corrected", "VALIDATED", "CORRECTED")),
            "target_duration_outside_range": sum(1 for o in all_orders if o.completion_days is not None and (o.completion_days < 1 or o.completion_days > MAX_ML_COMPLETION_DAYS)),
        }

        return {
            "total_historical_records": total,
            "with_date_received": with_received,
            "with_estimated_release": with_est,
            "with_claimed_date": with_claimed,
            "with_actual_completion_date": with_actual,
            "category_a_count": cat_a,
            "category_b_count": cat_b,
            "category_c_count": cat_c,
            "category_d_count": cat_d,
            "with_valid_target_duration": with_valid_days,
            "ml_eligible_records": eligible_count,
            "excluded_records": total - eligible_count,
            "exclusion_reasons": reasons,
        }

    def get_research_evidence(self, db: Session) -> Dict[str, Any]:
        meta = self.metadata or {}
        funnel = self.get_dataset_funnel(db)
        return {
            "model_overview": {
                "algorithm": "Random Forest Regressor",
                "model_version": meta.get("model_version", HISTORICAL_MODEL_VERSION),
                "last_trained_at": meta.get("trained_at") or self.last_train_date,
                "dataset_version": meta.get("dataset_version"),
                "dataset_size": funnel["ml_eligible_records"],
                "train_records": meta.get("train_count"),
                "test_records": meta.get("test_count"),
                "model_loaded": self.model is not None,
                "hyperparameters": {
                    "n_estimators": 150,
                    "max_depth": 10,
                    "random_state": 42,
                    "test_size": 0.2,
                }
            },
            "target_info": {
                "historical_target_type": "historical_order_to_claim",
                "historical_target_definition": "Historical Order-to-Claim Turnaround (claimed_date − date_received)",
                "historical_actual_completion_available": False,
                "digital_forward_target_type": "actual_service_completion",
                "digital_forward_target_definition": "Actual Service Completion Duration (released_at − created_at)",
                "academic_status": "Partially Supported historically (predicting turnaround); forward digital collection supports actual service completion."
            },
            "feature_contract": [
                {"name": col, "type": "int/float", "available_at_intake": True, "description": col.replace("_", " ").title()}
                for col in FEATURE_COLS
            ],
            "metrics": {
                "mae": meta.get("mae"),
                "rmse": meta.get("rmse"),
                "r2_score": meta.get("r2_score"),
                "accuracy_within_1_day": meta.get("accuracy_within_1_day"),
                "accuracy_within_2_days": meta.get("accuracy_within_2_days"),
                "accuracy_within_3_days": meta.get("accuracy_within_3_days"),
                "target_85_threshold": 85.0,
                "target_85_status": meta.get("target_85_status", "TARGET NOT MET"),
                "count_within_1_day": meta.get("count_within_1_day"),
                "count_within_2_days": meta.get("count_within_2_days"),
                "count_within_3_days": meta.get("count_within_3_days"),
                "mean_actual_duration": meta.get("mean_actual_duration"),
                "mean_predicted_duration": meta.get("mean_predicted_duration"),
                "median_absolute_error": meta.get("median_absolute_error"),
                "max_absolute_error": meta.get("max_absolute_error"),
                "min_absolute_error": meta.get("min_absolute_error"),
            },
            "dataset_funnel": funnel,
            "test_predictions": meta.get("test_predictions", []),
        }

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
            "accuracy_within_1_day": meta.get("accuracy_within_1_day"),
            "accuracy_within_2_days": meta.get("accuracy_within_2_days"),
            "accuracy_within_3_days": meta.get("accuracy_within_3_days"),
            "target_85_status": meta.get("target_85_status"),
            "train_count": meta.get("train_count"),
            "test_count": meta.get("test_count"),
        }


historical_ml_engine = HistoricalMLEngine()
