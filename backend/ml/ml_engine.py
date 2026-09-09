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
    FEATURE_COLS as HISTORICAL_FEATURE_COLS,
    LIVE_COMPLETION_MODEL_PATH,
)
from ml.business_rules import calculate_official_release_days, collect_service_flags, combo_override_days

# ==========================================
# SHOELOTSKEY SMART PREDICTION ENGINE (SPE)
# ==========================================
# This engine uses a hybrid approach:
# 1. Heuristic Baseline: Derived from Service Catalog durations.
# 2. ML Adjustment: Forest-based regression for workload/material complexity.

class ShoelotskeyPredictor:
    # P1-13 / HIGH-8 FIX: The old default `model_path="backend/completion_model.pkl"` was
    # resolved relative to the process CURRENT WORKING DIRECTORY, not this file's location.
    # The Procfile runs gunicorn with `--chdir backend`, so on Heroku the effective lookup
    # path was `backend/backend/completion_model.pkl` — always wrong. Locally, `npm run
    # server` also `cd`s into backend/ first, so the same doubling bug applied locally too.
    # Resolving relative to __file__ makes this correct regardless of CWD, matching the
    # convention already used by ml/historical_ml_engine.py's HISTORICAL_MODEL_PATH.
    DEFAULT_MODEL_PATH = LIVE_COMPLETION_MODEL_PATH

    def __init__(self, model_path=None):
        self.model_path = model_path or self.DEFAULT_MODEL_PATH
        # P0-4: Metadata describing how the on-disk model was produced/evaluated, so callers
        # (the /api/predict response, the Job Order Form UI) can honestly report whether a
        # prediction came from a genuinely trained, quality-gated Random Forest model or the
        # rule/heuristic fallback — this must never be silently presented as "trained ML" when
        # it is not. Loaded BEFORE the model itself so the activation gate below can consult it.
        self.metadata = self._load_metadata()
        self.model = self._load_model()
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
            print("[ML] Model artifact exists but is marked not-activated. Serving heuristic fallback.")
            return None

        for path in (self.model_path, historical_ml_engine.model_path):
            if not os.path.exists(path):
                continue
            try:
                with open(path, "rb") as f:
                    model = pickle.load(f)
                if isinstance(model, RandomForestRegressor):
                    if path != self.model_path:
                        print(f"[ML] Loaded RandomForestRegressor from fallback path: {path}")
                    return model
                print(f"[ML] WARNING: {path} is not a RandomForestRegressor ({type(model).__name__})")
            except Exception as e:
                print(f"[ML] WARNING: Failed to load model at {path} ({e})")
        return None

    def get_status(self) -> dict:
        """Honest model-availability status for /api/ml/status and Job Order UI."""
        is_rf = isinstance(self.model, RandomForestRegressor)
        return {
            **(self.metadata or {}),
            "model_loaded": is_rf,
            "model_path": self.model_path,
            "algorithm": "Random Forest Regressor" if is_rf else "Heuristic (rule-based) fallback",
            "model_type": type(self.model).__name__ if self.model is not None else None,
            # Availability of a loaded RF artifact — not a claim that the last live call used it.
            "prediction_mode": "random_forest" if is_rf else "heuristic_fallback",
            "last_prediction_source": self.last_prediction_source,
            "last_fallback_reason": self.last_fallback_reason,
        }

    def calculate_heuristic_days(self, db: Session, service_ids: list, condition_ids: list, material: str):
        """
        Calculates the theoretical minimum days required based on service catalog.
        """
        if not service_ids:
            return 7 # Standard fallback
            
        # Get maximum duration from the services selected
        max_duration = db.query(func.max(Service.duration_days)).filter(
            Service.service_id.in_(service_ids)
        ).scalar() or 0
        
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
            # We look for 'Sole Separation' or 'Rips' in condition names
            complex_conds = db.query(Condition).filter(
                Condition.condition_id.in_(condition_ids),
                func.lower(Condition.condition_name).in_(['sole separation', 'rips/holes', 'deep stains'])
            ).count()
            condition_delay = complex_conds * 2
            
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
        return combo_override_days(collect_service_flags(order_data.get("items") or []))

    def _parse_base_date(self, order_data: dict) -> datetime:
        base_date = datetime.now()
        td_iso = order_data.get("transactionDate") or order_data.get("createdAt")
        if not td_iso:
            return base_date
        try:
            dt = datetime.fromisoformat(str(td_iso).replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                return dt.astimezone().replace(tzinfo=None)
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
        items = order_data.get("items") or []
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
        rows = db.query(Service.service_name, Service.duration_days).all()
        return {name: self._parse_duration_days(days) for name, days in rows if name}

    def calculate_business_rule_days(self, db: Session, order_data: dict) -> int:
        """
        Official Shoelotskey operational duration from the deployed Job Order Form.

        Uses the live production combination table and catalog durations, not the
        drifted local Service.duration_days values and not Random Forest.
        """
        return calculate_official_release_days(order_data, self._service_duration_map(db))

    def calculate_ml_prediction(self, db: Session, order_data: dict) -> Dict[str, Any]:
        """
        Independent Random Forest prediction. Never used as expected_at.
        Returns raw model days even when validation rejects them.
        """
        result = {
            "ml_predicted_days": None,
            "ml_status": "unavailable",
            "ml_source": "random_forest",
            "ml_model": "Random Forest Regression",
            "ml_reason": None,
        }
        if not isinstance(self.model, RandomForestRegressor):
            result["ml_reason"] = "No activated Random Forest model is loaded."
            self.last_prediction_source = "heuristic_fallback"
            self.last_fallback_reason = result["ml_reason"]
            self.last_ml_days = None
            self.last_ml_status = "unavailable"
            self.last_ml_reason = result["ml_reason"]
            return result

        all_service_ids = []
        all_condition_ids = []
        primary_material = "Unknown"
        items = order_data.get("items") or []
        for i, item in enumerate(items):
            if i == 0:
                primary_material = item.get("shoeMaterial", "Unknown")
            b_srvs = item.get("baseService") or []
            a_srvs = item.get("addOns") or []
            s_names = b_srvs + [a.get("name") if isinstance(a, dict) else a for a in a_srvs if a]
            s_names = [s for s in s_names if s]
            if s_names:
                srvs = db.query(Service.service_id).filter(Service.service_name.in_(s_names)).all()
                all_service_ids.extend([s[0] for s in srvs])
            c_data = item.get("condition") or {}
            if isinstance(c_data, dict):
                c_map = {
                    "scratches": "Scratches",
                    "yellowing": "Yellowing",
                    "ripsHoles": "Rips/Holes",
                    "deepStains": "Deep Stains",
                    "soleSeparation": "Sole Separation",
                    "wornOut": "Worn Out",
                }
                active_c_names = [v for k, v in c_map.items() if c_data.get(k)]
                if active_c_names:
                    conds = db.query(Condition.condition_id).filter(Condition.condition_name.in_(active_c_names)).all()
                    all_condition_ids.extend([c[0] for c in conds])

        heuristic_days = self.calculate_heuristic_days(
            db, list(set(all_service_ids)), list(set(all_condition_ids)), primary_material
        )
        features = build_features_from_live_order(order_data)
        row = [features.get(col, 0) for col in HISTORICAL_FEATURE_COLS]
        rf_days = float(self.model.predict([row])[0])
        # Locked methodology: PredictedDays = max(1, round(ŷ)); never 0/negative.
        predicted_days = max(1, int(round(rf_days)))
        upper_bound = max(heuristic_days * 4, heuristic_days + 30, 60)
        result["ml_predicted_days"] = predicted_days
        self.last_ml_days = result["ml_predicted_days"]
        self.last_prediction_source = "random_forest"

        if rf_days < 1 or rf_days > upper_bound:
            result["ml_status"] = "invalid"
            result["ml_reason"] = (
                f"Prediction outside valid service-duration range "
                f"(1–{upper_bound:.0f} days). Random Forest predicted {rf_days:.1f} days."
            )
            self.last_fallback_reason = result["ml_reason"]
            self.last_ml_status = "invalid"
            self.last_ml_reason = result["ml_reason"]
            return result

        result["ml_status"] = "valid"
        result["ml_reason"] = None
        self.last_fallback_reason = None
        self.last_ml_status = "valid"
        self.last_ml_reason = None
        return result

    def estimate_order_release(self, db: Session, order_data: dict) -> Dict[str, Any]:
        """
        Dual result: official business-rule date + independent Random Forest prediction.
        The official operational date is always the business-rule date.
        """
        base_date = self._parse_base_date(order_data)
        official_days = self.calculate_business_rule_days(db, order_data)
        if official_days <= 0:
            official_days = 10
        official_date = base_date + timedelta(days=official_days)
        ml = self.calculate_ml_prediction(db, order_data)
        ml_days = ml.get("ml_predicted_days")
        ml_date = None
        if ml.get("ml_status") == "valid" and ml_days is not None:
            ml_date = base_date + timedelta(days=float(ml_days))

        estimate = {
            "authoritative": "business_rule",
            "business_rule_days": official_days,
            "business_rule_date": official_date,
            "ml_predicted_days": ml_days,
            "ml_predicted_date": ml_date,
            "ml_model": ml.get("ml_model") or "Random Forest Regression",
            "ml_status": ml.get("ml_status") or "unavailable",
            "ml_source": ml.get("ml_source") or "random_forest",
            "ml_reason": ml.get("ml_reason"),
            "model_loaded": isinstance(self.model, RandomForestRegressor),
        }
        self.last_official_days = official_days
        self.last_predicted_days = official_days
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
        payload.update({k: v for k, v in extra.items() if v is not None})
    return payload


# Singleton Instance
predictor = ShoelotskeyPredictor()

# NOTE (P0-4 remediation, duplicate-ML cleanup): A second, unused `HistoricalMLEngine` class +
# `historical_ml_engine` singleton previously lived here as dead code (never imported —
# `main.py` imports `historical_ml_engine` from `ml/historical_ml_engine.py`, the real
# implementation used by the Historical Records module). It has been removed to avoid a
# confusing duplicate ML implementation living alongside the live-order predictor. See
# `ml/historical_ml_engine.py` for the actual Historical Records Random Forest engine.

