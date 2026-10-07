import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from models import Order, Service, Condition, Status
from sklearn.ensemble import RandomForestRegressor
import pickle
import os

from ml.historical_ml_engine import (
    historical_ml_engine,
    build_features_from_live_order,
    build_features_from_live_order_v3,
    extract_feature_set_c_vector,
    FEATURE_COLS as HISTORICAL_FEATURE_COLS,
    FEATURE_SET_C_COLS,
    LIVE_COMPLETION_MODEL_PATH,
)
from ml.business_rules import calculate_official_release_days, collect_service_flags, combo_override_days

import time

# Owner-confirmed shop closure dates:
# 1. Weekly closure: Sunday (d.weekday() == 6)
# 2. Holy Week (owner-confirmed): April 16–19, 2025 (Holy Wednesday through Black Saturday; Easter Sunday covered by weekly rule)
# 3. Christmas: December 24 & December 25
# 4. New Year: December 31 & January 1
# Note: Ordinary Philippine national holidays remain OPEN unless explicitly confirmed by the owner.

HOLY_WEEK_2025_CLOSURES = {
    (2025, 4, 16), (2025, 4, 17), (2025, 4, 18), (2025, 4, 19),
}

ANNUAL_OWNER_CLOSURES = {
    (12, 24),  # Christmas Eve
    (12, 25),  # Christmas Day
    (12, 31),  # New Year's Eve
    (1, 1),    # New Year's Day
}

def is_shop_closed_on_date(d: datetime) -> bool:
    """True if Sunday (weekday 6) or matches owner-confirmed closure dates."""
    if d.weekday() == 6:
        return True
    if (d.year, d.month, d.day) in HOLY_WEEK_2025_CLOSURES:
        return True
    if (d.month, d.day) in ANNUAL_OWNER_CLOSURES:
        return True
    return False

def next_open_release_date(target_dt: datetime) -> datetime:
    """Advance date until an open business day (Mon-Sat, non-closure) is reached."""
    cur = target_dt
    while is_shop_closed_on_date(cur):
        cur += timedelta(days=1)
    return cur

# In-memory service & condition catalog cache (5-minute TTL) to make /api/predict sub-millisecond
_CATALOG_CACHE: Dict[str, Any] = {
    "timestamp": 0.0,
    "duration_map": {},
    "service_by_name": {},
    "service_by_id": {},
    "condition_by_name": {},
}

def _parse_duration_days_helper(val) -> int:
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    text = str(val).strip()
    if "-" in text:
        parts = [int(p.strip()) for p in text.split("-") if p.strip().lstrip("-").isdigit()]
        return max(parts) if parts else 0
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return 0

def _get_cached_catalog(db: Session) -> Dict[str, Any]:
    now = time.time()
    if now - _CATALOG_CACHE["timestamp"] < 300.0 and _CATALOG_CACHE["duration_map"]:
        return _CATALOG_CACHE
    try:
        rows = db.query(Service.service_id, Service.service_name, Service.duration_days).all()
        dur_map = {}
        svc_by_name = {}
        svc_by_id = {}
        for sid, name, days in rows:
            if name:
                d = _parse_duration_days_helper(days)
                dur_map[name] = d
                svc_by_name[name] = sid
                svc_by_id[sid] = d

        c_rows = db.query(Condition.condition_id, Condition.condition_name).all()
        cond_by_name = {}
        for cid, cname in c_rows:
            if cname:
                cond_by_name[cname.strip().lower()] = cid

        _CATALOG_CACHE["timestamp"] = now
        _CATALOG_CACHE["duration_map"] = dur_map
        _CATALOG_CACHE["service_by_name"] = svc_by_name
        _CATALOG_CACHE["service_by_id"] = svc_by_id
        _CATALOG_CACHE["condition_by_name"] = cond_by_name
    except Exception as e:
        if not _CATALOG_CACHE["duration_map"]:
            _CATALOG_CACHE["duration_map"] = {
                "Basic Cleaning": 10,
                "Minor Reglue": 25,
                "Full Reglue": 25,
                "Color Renewal": 25,
                "Unyellowing": 5,
            }
    return _CATALOG_CACHE

# ==========================================
# SHOELOTSKEY SMART PREDICTION ENGINE (SPE)
# ==========================================
# This engine uses a hybrid approach:
# 1. Heuristic Baseline: Derived from Service Catalog durations.
# 2. ML Adjustment: Forest-based regression for workload/material complexity.

class ShoelotskeyPredictor:
    DEFAULT_MODEL_PATH = LIVE_COMPLETION_MODEL_PATH

    def __init__(self, model_path=None):
        self.model_path = model_path or self.DEFAULT_MODEL_PATH
        self.metadata = self._load_metadata()
        self.model = self._load_model()
        if isinstance(self.model, RandomForestRegressor):
            self.model.n_jobs = 1
        self.last_prediction_source = "heuristic_fallback" if self.model is None else "random_forest"
        self.last_fallback_reason = None if self.model is not None else "No activated Random Forest model is loaded."
        self.last_predicted_days = None
        self.last_ml_days = None
        self.last_ml_status = "unavailable"
        self.last_ml_reason = None if self.model is not None else "No activated Random Forest model is loaded."
        self.last_official_days = None
        self.last_estimate = None

    def _metadata_path(self):
        base, _ext = os.path.splitext(self.model_path)
        return base + ".meta.json"

    def _load_metadata(self):
        try:
            meta_path = self._metadata_path()
            if os.path.exists(meta_path):
                import json
                with open(meta_path, "r") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[ML] Warning: failed to load model metadata: {e}")
        return None

    def _save_metadata(self, metadata: dict):
        try:
            import json
            with open(self._metadata_path(), "w") as f:
                json.dump(metadata, f, indent=2)
            self.metadata = metadata
        except Exception as e:
            print(f"[ML] Warning: failed to save model metadata: {e}")

    def _load_model(self):
        if self.metadata is not None and self.metadata.get("activated") is False:
            print("[ML] Model artifact exists but is marked not-activated. Serving standard fallback.")
            return None

        for path in (self.model_path, historical_ml_engine.model_path):
            if not os.path.exists(path):
                continue
            try:
                with open(path, "rb") as f:
                    model = pickle.load(f)
                if isinstance(model, RandomForestRegressor):
                    n_feats = getattr(model, "n_features_in_", None)
                    if n_feats != 12:
                        print(f"[ML] WARNING: {path} has {n_feats} features, expected 12 for Feature Set C.")
                        continue
                    if path != self.model_path:
                        print(f"[ML] Loaded RandomForestRegressor from fallback path: {path}")
                    # In-memory latency optimization: single-sample inference does not need thread-pool spawning
                    model.n_jobs = 1
                    return model
                print(f"[ML] WARNING: {path} is not a RandomForestRegressor ({type(model).__name__})")
            except Exception as e:
                print(f"[ML] WARNING: Failed to load model at {path} ({e})")
        return None

    def get_status(self) -> dict:
        """Active model-availability status for /api/ml/status and Job Order UI."""
        is_rf = isinstance(self.model, RandomForestRegressor)
        return {
            **(self.metadata or {}),
            "model_loaded": is_rf,
            "model_path": self.model_path,
            "algorithm": "Random Forest Regressor" if is_rf else "Standard (rule-based) calculation",
            "model_type": type(self.model).__name__ if self.model is not None else None,
            "prediction_mode": "random_forest" if is_rf else "standard_fallback",
            "model_status": "Active" if is_rf else "Unavailable",
            "model_role": "OPERATIONAL_PREDICTION",
            "prediction_target": "Ready-for-Release Duration",
            "features": 12,
            "last_prediction_source": self.last_prediction_source,
            "last_fallback_reason": self.last_fallback_reason,
        }

    def calculate_heuristic_days(self, db: Session, service_ids: list, condition_ids: list, material: str):
        """
        Calculates the theoretical minimum days required based on service catalog.
        """
        if not service_ids:
            return 7 # Standard fallback
            
        cat = _get_cached_catalog(db)
        svc_by_id = cat.get("service_by_id", {})
        max_duration = max([svc_by_id.get(sid, 0) for sid in service_ids], default=0)
        
        # Adjust for material complexity
        material_delay = 0
        m_lower = (material or "Unknown").lower()
        if "suede" in m_lower or "nubuck" in m_lower:
            material_delay = 3
        elif "knit" in m_lower or "mesh" in m_lower:
            material_delay = 1
            
        # Adjust for condition complexity
        # e.g., Sole Separation or Rips take longer
        condition_delay = 0
        if condition_ids:
            cond_by_name = cat.get("condition_by_name", {})
            target_ids = {
                cond_by_name.get("sole separation"),
                cond_by_name.get("rips/holes"),
                cond_by_name.get("deep stains"),
            } - {None}
            complex_count = sum(1 for cid in condition_ids if cid in target_ids)
            condition_delay = complex_count * 2
            
        return max(3, max_duration + material_delay + condition_delay)

    def get_current_workload(self, db: Session):
        """Returns count of active orders in the shop."""
        # Status names now match frontend: 'new-order', 'on-going'
        active_statuses = db.query(Status).filter(
            Status.status_name.in_(['new-order', 'on-going'])
        ).all()
        status_ids = [s.status_id for s in active_statuses]
        return db.query(Order).filter(Order.status_id.in_(status_ids)).count()

    def get_rule_override(self, order_data: dict) -> Optional[int]:
        """Deployed Job Order Form combination table. Same values as the live form."""
        return combo_override_days(collect_service_flags(order_data.get("items") or order_data.get("shoes") or []))

    def _parse_base_date(self, order_data: dict) -> datetime:
        from datetime import timezone, timedelta
        ph_tz = timezone(timedelta(hours=8))
        base_date = datetime.now(timezone.utc).astimezone(ph_tz).replace(tzinfo=None)
        td_iso = (
            order_data.get("transactionDate")
            or order_data.get("orderDate")
            or order_data.get("createdAt")
            or order_data.get("created_at")
            or order_data.get("dateReceived")
            or order_data.get("date_received")
        )
        if not td_iso:
            return base_date
        try:
            raw_str = str(td_iso).strip()
            # If plain date YYYY-MM-DD
            if len(raw_str) == 10 and "-" in raw_str:
                parts = raw_str.split("-")
                return datetime(int(parts[0]), int(parts[1]), int(parts[2]), 0, 0, 0)
            dt = datetime.fromisoformat(raw_str.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                return dt.astimezone(ph_tz).replace(tzinfo=None)
            return dt
        except Exception:
            return base_date

    def _parse_duration_days(self, val) -> int:
        if val is None:
            return 0
        if isinstance(val, (int, float)):
            return int(val)
        text = str(val).strip()
        if "-" in text:
            parts = [int(p.strip()) for p in text.split("-") if p.strip().lstrip("-").isdigit()]
            return max(parts) if parts else 0
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return 0

    def _collect_item_services(self, order_data: dict):
        items = order_data.get("items") or order_data.get("shoes") or []
        flags = {
            "has_basic_cleaning": False,
            "has_minor_reglue": False,
            "has_full_reglue": False,
            "has_color_renewal": False,
            "has_unyellowing": False,
            "has_minor_restoration": False,
            "has_minor_retouch": False,
            "has_services": False,
        }
        normalized_items = []
        for item in items:
            base_services = item.get("baseService") or []
            if isinstance(base_services, str):
                base_services = [base_services]
            elif not isinstance(base_services, list):
                base_services = []
            addons = item.get("addOns") or []
            if isinstance(addons, str):
                addons = [addons]
            elif not isinstance(addons, list):
                addons = []
            addon_names = []
            for addon in addons:
                name = addon.get("name") if isinstance(addon, dict) else addon
                qty = addon.get("quantity", 1) if isinstance(addon, dict) else 1
                if name:
                    addon_names.append((name, qty or 1))
            if base_services or addon_names:
                flags["has_services"] = True
            if "Basic Cleaning" in base_services:
                flags["has_basic_cleaning"] = True
            if "Minor Reglue" in base_services:
                flags["has_minor_reglue"] = True
            if "Full Reglue" in base_services:
                flags["has_full_reglue"] = True
            if "Color Renewal" in base_services:
                flags["has_color_renewal"] = True
            for name, _qty in addon_names:
                if name == "Unyellowing":
                    flags["has_unyellowing"] = True
                elif name == "Minor Restoration":
                    flags["has_minor_restoration"] = True
                elif name == "Minor Retouch":
                    flags["has_minor_retouch"] = True
            normalized_items.append({"baseService": base_services, "addOns": addon_names})
        return flags, normalized_items

    def _service_duration_map(self, db: Session) -> Dict[str, int]:
        cat = _get_cached_catalog(db)
        return cat.get("duration_map", {})

    def calculate_business_rule_days(self, db: Session, order_data: dict) -> int:
        """
        Official Shoelotskey operational duration from the deployed Job Order Form.

        Uses the live production combination table and catalog durations, not the
        drifted local Service.duration_days values and not Random Forest.
        """
        return calculate_official_release_days(order_data, self._service_duration_map(db))

    def calculate_ml_prediction(self, db: Session, order_data: dict) -> Dict[str, Any]:
        """
        Active Random Forest prediction of Received-to-Ready-for-Release Turnaround.
        Uses the frozen 12-feature Feature Set C schema with strict validation and Sunday/closure rollover guardrails.
        """
        result = {
            "ml_predicted_days": None,
            "ml_predicted_date": None,
            "ml_status": "unavailable",
            "ml_source": "random_forest",
            "ml_model": "Random Forest Regression",
            "model_status": "Unavailable",
            "model_role": "OPERATIONAL_PREDICTION",
            "prediction_target": "Ready-for-Release Turnaround",
            "ml_reason": None,
        }
        if not isinstance(self.model, RandomForestRegressor):
            result["ml_reason"] = "No active Random Forest model is loaded."
            self.last_prediction_source = "standard_fallback"
            self.last_fallback_reason = result["ml_reason"]
            self.last_ml_days = None
            self.last_ml_status = "unavailable"
            self.last_ml_reason = result["ml_reason"]
            return result

        if getattr(self.model, "n_features_in_", 0) != 12:
            result["ml_reason"] = f"Model feature dimension mismatch: expected 12, got {getattr(self.model, 'n_features_in_', 0)}"
            result["ml_status"] = "error"
            self.last_prediction_source = "standard_fallback"
            self.last_fallback_reason = result["ml_reason"]
            return result

        try:
            vector = extract_feature_set_c_vector(order_data)
            if len(vector) != 12:
                raise ValueError(f"Feature Set C vector must contain exactly 12 items, got {len(vector)}")
            if not np.all(np.isfinite(vector)):
                raise ValueError("Feature vector contains NaN or infinite values")
        except Exception as e:
            result["ml_status"] = "error"
            result["ml_reason"] = f"Feature extraction failed: {e}"
            self.last_prediction_source = "standard_fallback"
            self.last_fallback_reason = result["ml_reason"]
            return result

        try:
            rf_days = float(self.model.predict([vector])[0])
            MAX_ESTIMATED_DAYS = 60.0
            rf_elapsed_days = max(1, int(round(rf_days)))

            base_date = self._parse_base_date(order_data)
            ml_predicted_date = base_date + timedelta(days=rf_elapsed_days)
            # Narrowly defined safety check: ensure the predicted release date does not land on Sunday or confirmed closure
            final_target_date = next_open_release_date(ml_predicted_date)
            final_operational_days = max(1, (final_target_date.date() - base_date.date()).days)
            safety_rollover_days = max(0, final_operational_days - rf_elapsed_days)

            # Phase 4B.6 Final ML Target-Semantics & UI Fields
            result["ml_raw_prediction_days"] = rf_days
            result["ml_elapsed_days"] = rf_elapsed_days
            result["ml_predicted_turnaround_days"] = final_operational_days
            result["ml_predicted_release_date"] = final_target_date
            result["ml_safety_rollover_days"] = safety_rollover_days
            result["ml_has_safety_rollover"] = safety_rollover_days > 0

            # Backward-compatible fields
            result["ml_base_days"] = rf_elapsed_days
            result["ml_rollover_days"] = safety_rollover_days
            result["ml_has_rollover"] = safety_rollover_days > 0
            result["ml_predicted_days"] = final_operational_days
            result["ml_predicted_date"] = final_target_date
            result["ml_raw_turnaround_days"] = rf_elapsed_days
            result["ml_status"] = "valid"
            result["model_status"] = "Active"
            result["model_role"] = "OPERATIONAL_PREDICTION"
            result["prediction_target"] = "Received-to-Ready-for-Release Elapsed Turnaround"
            result["ml_reason"] = None

            self.last_ml_days = final_operational_days
            self.last_prediction_source = "random_forest"
            self.last_fallback_reason = None
            self.last_ml_status = "valid"
            self.last_ml_reason = None
            return result
        except Exception as e:
            result["ml_status"] = "error"
            result["ml_reason"] = f"Inference exception: {e}"
            self.last_prediction_source = "standard_fallback"
            self.last_fallback_reason = result["ml_reason"]
            return result

    def estimate_order_release(self, db: Session, order_data: dict) -> Dict[str, Any]:
        """
        Dual result: Standard Release Date (Business Rules) + ML Predicted Release Date (Active Random Forest).
        The Standard Release Date represents the shop's established customer commitment.
        The ML Predicted Release Date represents the active model's Ready-for-Release turnaround prediction.
        """
        base_date = self._parse_base_date(order_data)
        try:
            official_days = self.calculate_business_rule_days(db, order_data)
        except Exception as e:
            print(f"[BusinessRules] Warning: calculation error ({e}), serving 10-day fallback.")
            official_days = 10
        if official_days < 0:
            official_days = 0
        raw_official_date = base_date + timedelta(days=official_days)
        official_date = next_open_release_date(raw_official_date) if official_days > 0 else base_date
        final_official_days = max(1, (official_date.date() - base_date.date()).days) if official_days > 0 else 0
        official_rollover_days = max(0, final_official_days - official_days) if official_days > 0 else 0

        ml = self.calculate_ml_prediction(db, order_data)
        ml_days = ml.get("ml_predicted_days")
        ml_date = ml.get("ml_predicted_date")

        estimate = {
            "authoritative": "business_rule",
            "standard_base_days": official_days,
            "standard_release_days": final_official_days,
            "standard_release_date": official_date,
            "standard_rollover_days": official_rollover_days,
            "standard_has_rollover": official_rollover_days > 0,
            "business_rule_days": official_days,
            "business_rule_date": official_date,
            "ml_raw_prediction_days": ml.get("ml_raw_prediction_days"),
            "ml_elapsed_days": ml.get("ml_elapsed_days", ml.get("ml_base_days")),
            "ml_predicted_turnaround_days": ml.get("ml_predicted_turnaround_days", ml_days),
            "ml_base_days": ml.get("ml_base_days"),
            "ml_predicted_release_date": ml.get("ml_predicted_release_date"),
            "ml_rollover_days": ml.get("ml_rollover_days", 0),
            "ml_has_rollover": ml.get("ml_has_rollover", False),
            "ml_safety_rollover_days": ml.get("ml_safety_rollover_days", 0),
            "ml_has_safety_rollover": ml.get("ml_has_safety_rollover", False),
            "ml_predicted_days": ml_days,
            "ml_predicted_date": ml_date,
            "ml_model": ml.get("ml_model") or "Random Forest Regression",
            "ml_status": ml.get("ml_status") or "unavailable",
            "model_status": ml.get("model_status") or ("Active" if isinstance(self.model, RandomForestRegressor) else "Unavailable"),
            "model_role": "OPERATIONAL_PREDICTION",
            "prediction_target": "Received-to-Ready-for-Release Elapsed Turnaround",
            "ml_source": "random_forest",
            "ml_reason": ml.get("ml_reason"),
            "model_loaded": isinstance(self.model, RandomForestRegressor),
        }
        self.last_official_days = final_official_days
        self.last_predicted_days = final_official_days
        self.last_estimate = estimate
        return estimate

    def predict_completion(self, db: Session, order_data: dict) -> datetime:
        """
        Official operational release datetime from Shoelotskey business rules.

        Random Forest still runs via estimate_order_release() and is stored on
        last_estimate / last_ml_* fields. It never overwrites this official date.
        """
        estimate = self.estimate_order_release(db, order_data)
        return estimate["business_rule_date"]

    def train_from_history(self, db: Session):
        """
        Train RandomForestRegressor from VALIDATED + ML-eligible historical records
        via the authoritative historical ML pipeline, then sync to completion_model.pkl
        for /api/predict and Job Order persistence.
        """
        result = historical_ml_engine.train_model(db)
        if result.get("status") != "success":
            return result

        self.metadata = historical_ml_engine.metadata
        self.model = historical_ml_engine.model
        self.last_prediction_source = "random_forest" if self.model is not None else "heuristic_fallback"
        print(
            f">>> Predictor: Historical RF trained n={result.get('dataset_size')} "
            f"R²={result.get('r2_score')} MAE={result.get('mae')} RMSE={result.get('rmse')} "
            f"model_loaded={self.model is not None}"
        )
        return result

def live_order_payload_from_db_order(db_order, extra: Optional[dict] = None) -> dict:
    """Rebuild a live Job Order payload from a persisted Order for dual estimation."""
    items = []
    for item in getattr(db_order, "items", None) or []:
        base = []
        addons = []
        for svc in getattr(item, "services", None) or []:
            cat = getattr(getattr(svc, "category", None), "category_name", None) or ""
            if str(cat).lower() == "addon":
                addons.append({"name": svc.service_name, "quantity": 1})
            else:
                base.append(svc.service_name)
        items.append({
            "baseService": base,
            "addOns": addons,
            "shoeMaterial": getattr(item, "material", None) or "Unknown",
            "quantity": getattr(item, "quantity", 1) or 1,
        })
    payload = {
        "items": items,
        "priorityLevel": getattr(getattr(db_order, "priority", None), "priority_name", None) or "regular",
        "grandTotal": float(getattr(db_order, "grand_total", 0) or 0),
        "transactionDate": db_order.created_at.isoformat() if getattr(db_order, "created_at", None) else None,
    }
    if extra:
        payload.update({k: v for k, v in extra.items() if v is not None and (k != "transactionDate" or str(v).strip())})
    if getattr(db_order, "created_at", None) and not payload.get("transactionDate"):
        payload["transactionDate"] = db_order.created_at.isoformat()
    return payload


# Singleton Instance
predictor = ShoelotskeyPredictor()

# NOTE (P0-4 remediation, duplicate-ML cleanup): A second, unused `HistoricalMLEngine` class +
# `historical_ml_engine` singleton previously lived here as dead code (never imported —
# `main.py` imports `historical_ml_engine` from `ml/historical_ml_engine.py`, the real
# implementation used by the Historical Records module). It has been removed to avoid a
# confusing duplicate ML implementation living alongside the live-order predictor. See
# `ml/historical_ml_engine.py` for the actual Historical Records Random Forest engine.

