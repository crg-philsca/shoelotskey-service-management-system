import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from models import Order, Item, Service, Condition, Status, PriorityLevel
from sklearn.ensemble import RandomForestRegressor
import pickle
import os

# ==========================================
# SHOELOTSKEY SMART PREDICTION ENGINE (SPE)
# ==========================================
# This engine uses a hybrid approach:
# 1. Heuristic Baseline: Derived from Service Catalog durations.
# 2. ML Adjustment: Forest-based regression for workload/material complexity.

class ShoelotskeyPredictor:
    def __init__(self, model_path="backend/completion_model.pkl"):
        self.model_path = model_path
        self.model = self._load_model()
        
    def _load_model(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, 'rb') as f:
                return pickle.load(f)
        return None

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
        items = order_data.get('items', [])
        has_basic_cleaning = False
        has_minor_reglue = False
        has_full_reglue = False
        has_color_renewal = False
        has_unyellowing = False
        has_minor_restoration = False
        has_minor_retouch = False

        for item in items:
            base_services = item.get('baseService', [])
            if isinstance(base_services, str):
                base_services = [base_services]
            elif not isinstance(base_services, list):
                base_services = []
            
            addons = item.get('addOns', [])
            if isinstance(addons, str):
                addons = [addons]
            elif not isinstance(addons, list):
                addons = []
            
            if 'Basic Cleaning' in base_services:
                has_basic_cleaning = True
            if 'Minor Reglue' in base_services:
                has_minor_reglue = True
            if 'Full Reglue' in base_services:
                has_full_reglue = True
            if 'Color Renewal' in base_services:
                has_color_renewal = True

            for addon in addons:
                name = addon.get('name') if isinstance(addon, dict) else addon
                if name == 'Unyellowing':
                    has_unyellowing = True
                elif name == 'Minor Restoration':
                    has_minor_restoration = True
                elif name == 'Minor Retouch':
                    has_minor_retouch = True

        # Rule 1: Other services (Full Reglue, Color Renewal) + Unyellowing -> 25 days default
        if (has_full_reglue or has_color_renewal) and has_unyellowing:
            return 25
        # Rule 2: Basic Cleaning + (Unyellowing or Minor Restoration or Minor Retouch) -> 20 days
        if has_basic_cleaning and (has_unyellowing or has_minor_restoration or has_minor_retouch):
            return 20
        # Rule 3: Basic Cleaning + Minor Reglue -> 10 days
        if has_basic_cleaning and has_minor_reglue and not has_full_reglue and not has_color_renewal and not has_unyellowing and not has_minor_restoration and not has_minor_retouch:
            return 10
        # Rule 4: Color Renewal + Basic Cleaning -> 15 days
        if has_color_renewal and has_basic_cleaning and not has_minor_reglue and not has_full_reglue and not has_unyellowing and not has_minor_restoration and not has_minor_retouch:
            return 15

        return None



    def predict_completion(self, db: Session, order_data: dict) -> datetime:
        """
        Public API to predict completion date.
        Input: order_data (Dict containing items, services, conditions, priority)
        """
        # 1. Gather all unique service and condition IDs from all items in the order
        all_service_ids = []
        all_condition_ids = []
        primary_material = "Unknown"
        total_items = 0
        
        items = order_data.get('items', [])
        for i, item in enumerate(items):
            total_items += 1
            if i == 0: primary_material = item.get('shoeMaterial', 'Unknown')
            
            # Resolve service IDs from names (since frontend uses names)
            s_names = item.get('baseService', []) + [a.get('name') if isinstance(a, dict) else a for a in item.get('addOns', [])]
            srvs = db.query(Service.service_id).filter(Service.service_name.in_(s_names)).all()
            all_service_ids.extend([s[0] for s in srvs])
            
            # Resolve condition IDs
            c_data = item.get('condition', {})
            if isinstance(c_data, dict):
                c_map = {"scratches": "Scratches", "yellowing": "Yellowing", "ripsHoles": "Rips/Holes", "deepStains": "Deep Stains", "soleSeparation": "Sole Separation", "wornOut": "Worn Out"}
                active_c_names = [v for k, v in c_map.items() if c_data.get(k)]
                if active_c_names:
                    conds = db.query(Condition.condition_id).filter(Condition.condition_name.in_(active_c_names)).all()
                    all_condition_ids.extend([c[0] for c in conds])

        # Parse base_date from transactionDate if specified
        base_date = datetime.now()
        td_iso = order_data.get('transactionDate')
        if td_iso:
            try:
                dt = datetime.fromisoformat(td_iso.replace('Z', '+00:00'))
                if dt.tzinfo is not None:
                    base_date = dt.astimezone().replace(tzinfo=None)
                else:
                    base_date = dt
            except Exception:
                pass

        # Check for rule overrides first
        rule_override = self.get_rule_override(order_data)
        if rule_override is not None:
            return base_date + timedelta(days=rule_override)

        # 2. Get Baselines
        heuristic_days = self.calculate_heuristic_days(db, list(set(all_service_ids)), list(set(all_condition_ids)), primary_material)
        workload = self.get_current_workload(db)
        is_rush = 1 if str(order_data.get('priorityLevel')).lower() == 'rush' else 0
        
        # 3. Apply ML refinement (Simulated if no model exists)
        if self.model:
            # Features: [total_items, is_rush, service_count, condition_count, workload, heuristic_days]
            X = np.array([[total_items, is_rush, len(all_service_ids), len(all_condition_ids), workload, heuristic_days]])
            predicted_days = self.model.predict(X)[0]
        else:
            # Fallback Dynamic Math: 
            # Workload delay (0.2 days per active order)
            workload_delay = workload * 0.2
            # Rush reduction
            if is_rush:
                heuristic_days *= 0.6
                workload_delay *= 0.1 # Priority skip
            
            predicted_days = heuristic_days + workload_delay

        return base_date + timedelta(days=round(predicted_days))

    def train_from_history(self, db: Session):
        """
        Extracts historical data from orders and trains the Random Forest model.
        Requires 'released_at' or 'claimed_at' to be populated.
        """
        # Query completed orders with temporal data
        orders = db.query(Order).filter(Order.released_at.isnot(None)).all()
        if len(orders) < 5:
            print(">>> Predictor: Not enough data to train. Need at least 5 completed orders.")
            return False

        data = []
        for o in orders:
            # Calculate actual days
            start = o.created_at
            end = o.released_at
            actual_days = (end - start).days + (end - start).seconds / 86400.0
            
            # Extract features for this order
            item_count = len(o.items)
            is_rush = 1 if o.priority and o.priority.priority_name == 'rush' else 0
            
            all_service_ids = []
            all_condition_ids = []
            primary_material = "Unknown"
            
            for i, item in enumerate(o.items):
                if i == 0:
                    primary_material = item.material or "Unknown"
                all_service_ids.extend([s.service_id for s in item.services])
                all_condition_ids.extend([c.condition_id for c in item.conditions])
            
            # Compute heuristic days dynamically for historical sample
            heuristic_days = self.calculate_heuristic_days(db, list(set(all_service_ids)), list(set(all_condition_ids)), primary_material)
            
            # Calculate historical workload: how many active orders existed when this order was created
            workload = db.query(Order).filter(
                Order.created_at <= start,
                or_(Order.released_at == None, Order.released_at > start)
            ).count()
            
            data.append({
                'item_count': item_count,
                'is_rush': is_rush,
                'svc_count': len(all_service_ids),
                'cond_count': len(all_condition_ids),
                'workload': workload,
                'heuristic_days': heuristic_days,
                'actual_days': actual_days
            })
            
        df = pd.DataFrame(data)
        X = df[['item_count', 'is_rush', 'svc_count', 'cond_count', 'workload', 'heuristic_days']]
        
        # Train!
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        # Target: actual_days
        y = df['actual_days']
        self.model.fit(X.values, y)
        
        # Save model
        with open(self.model_path, 'wb') as f:
            pickle.dump(self.model, f)
        
        print(f">>> Predictor: Model trained on {len(orders)} historical samples.")
        return True

# Singleton Instance
predictor = ShoelotskeyPredictor()



class HistoricalMLEngine:
    """
    Random Forest engine trained exclusively on historical_orders data.
    Used by the Historical Records module for:
      - Dataset export (CSV)
      - Model training
      - Release date prediction
    """

    def __init__(self, model_path: str = ""):
        self.model_path = model_path
        self.model = self._load_model()
        self.last_train_date: Optional[str] = None
        self.dataset_size: int = 0

    def _load_model(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, "rb") as f:
                return pickle.load(f)
        return None

    # ------------------------------------------------------------------
    # PUBLIC: Export dataset
    # ------------------------------------------------------------------
    def export_dataset(self, db: Session) -> bytes:
        """
        Builds a CSV dataset from historical tables.
        Returns CSV bytes ready to stream as a download.
        """
        from models import HistoricalOrder, HistoricalItem, HistoricalItemService, Customer

        orders = (
            db.query(HistoricalOrder)
            .filter(HistoricalOrder.claimed_date.isnot(None))
            .all()
        )

        rows = []
        for o in orders:
            customer_name = o.customer.customer_name if o.customer else ""
            all_services = []
            for item in o.items:
                for svc in item.services:
                    all_services.append({"service_name": svc.service_name})

            rows.append({
                "order_id": o.order_id,
                "customer_name": customer_name,
                "branch": o.branch or "",
                "date_received": o.date_received.strftime("%Y-%m-%d") if o.date_received else "",
                "expected_release_date": o.expected_release_date.strftime("%Y-%m-%d") if o.expected_release_date else "",
                "claimed_date": o.claimed_date.strftime("%Y-%m-%d") if o.claimed_date else "",
                "completion_days": o.completion_days or 0,
                "total_pairs": o.total_pairs or 1,
                "grand_total": float(o.grand_total or 0),
                "downpayment": float(o.downpayment or 0),
                "balance": float(o.balance or 0),
                "priority": o.priority or "regular",
                "priority_encoded": _PRIORITY_MAP.get((o.priority or "regular").lower(), 0),
                "basic_cleaning_qty": _count_service(all_services, "Basic Cleaning"),
                "full_reglue_qty": _count_service(all_services, "Full Reglue"),
                "minor_reglue_qty": _count_service(all_services, "Minor Reglue"),
                "full_restoration_qty": _count_service(all_services, "Full Restoration"),
                "minor_restoration_qty": _count_service(all_services, "Minor Restoration"),
                "color_renewal_qty": _count_service(all_services, "Color Renewal"),
                "unyellowing_qty": _count_service(all_services, "Unyellowing"),
                "day_of_week_received": o.date_received.weekday() if o.date_received else 0,
                "month_received": o.date_received.month if o.date_received else 1,
            })

        if not rows:
            # Return header-only CSV
            header = "order_id,customer_name,branch,date_received,expected_release_date,claimed_date,completion_days,total_pairs,grand_total,downpayment,balance,priority,priority_encoded,basic_cleaning_qty,full_reglue_qty,minor_reglue_qty,full_restoration_qty,minor_restoration_qty,color_renewal_qty,unyellowing_qty,day_of_week_received,month_received\n"
            return header.encode("utf-8")

        df = pd.DataFrame(rows)
        return df.to_csv(index=False).encode("utf-8")

    # ------------------------------------------------------------------
    # PUBLIC: Train model
    # ------------------------------------------------------------------
    def train_model(self, db: Session) -> Dict[str, Any]:
        """
        Trains RandomForestRegressor on historical_orders where claimed_date is set.
        Target: completion_days.
        Returns: dict with status, dataset_size, r2_score, mae, model_version.
        """
        from models import HistoricalOrder

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
                "message": f"Need at least 5 completed records to train. Currently have {len(orders)}.",
                "dataset_size": len(orders),
            }

        feature_cols = [
            "total_pairs", "basic_cleaning_qty", "full_reglue_qty",
            "minor_reglue_qty", "full_restoration_qty", "minor_restoration_qty",
            "color_renewal_qty", "unyellowing_qty", "priority_encoded",
            "grand_total", "day_of_week_received", "month_received",
        ]

        rows = []
        for o in orders:
            all_services = []
            for item in o.items:
                for svc in item.services:
                    all_services.append({"service_name": svc.service_name})
            rows.append({
                "total_pairs": o.total_pairs or 1,
                "basic_cleaning_qty": _count_service(all_services, "Basic Cleaning"),
                "full_reglue_qty": _count_service(all_services, "Full Reglue"),
                "minor_reglue_qty": _count_service(all_services, "Minor Reglue"),
                "full_restoration_qty": _count_service(all_services, "Full Restoration"),
                "minor_restoration_qty": _count_service(all_services, "Minor Restoration"),
                "color_renewal_qty": _count_service(all_services, "Color Renewal"),
                "unyellowing_qty": _count_service(all_services, "Unyellowing"),
                "priority_encoded": _PRIORITY_MAP.get((o.priority or "regular").lower(), 0),
                "grand_total": float(o.grand_total or 0),
                "day_of_week_received": o.date_received.weekday() if o.date_received else 0,
                "month_received": o.date_received.month if o.date_received else 1,
                "completion_days": o.completion_days,
            })

        df = pd.DataFrame(rows)
        X = df[feature_cols]
        y = df["completion_days"]

        # Train-test split (80/20)
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score as sk_r2

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        rf = RandomForestRegressor(n_estimators=150, random_state=42, max_depth=10)
        rf.fit(X_train.values, y_train)

        y_pred = rf.predict(X_test.values)
        r2  = round(float(sk_r2(y_test, y_pred)), 4)
        mae = round(float(mean_absolute_error(y_test, y_pred)), 2)

        self.model = rf
        os.makedirs(os.path.dirname(self.model_path) if os.path.dirname(self.model_path) else ".", exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(rf, f)

        self.last_train_date = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.dataset_size = len(orders)

        print(f">>> HistoricalMLEngine: Trained on {len(orders)} records | R²={r2} | MAE={mae}")
        return {
            "status": "success",
            "dataset_size": len(orders),
            "r2_score": r2,
            "mae": mae,
            "model_version": HISTORICAL_MODEL_VERSION,
            "trained_at": self.last_train_date,
        }

    # ------------------------------------------------------------------
    # PUBLIC: Predict
    # ------------------------------------------------------------------
    def predict(self, features: Dict[str, Any], date_received: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Predicts completion days and estimated release date.
        features must contain the same keys as feature_cols above.
        """
        if self.model is None:
            return {"error": "Model not trained yet. Please train the model first."}

        feature_cols = [
            "total_pairs", "basic_cleaning_qty", "full_reglue_qty",
            "minor_reglue_qty", "full_restoration_qty", "minor_restoration_qty",
            "color_renewal_qty", "unyellowing_qty", "priority_encoded",
            "grand_total", "day_of_week_received", "month_received",
        ]

        row = [features.get(col, 0) for col in feature_cols]
        predicted_days = max(1, int(round(self.model.predict([row])[0])))

        ref_date = date_received or datetime.now()
        predicted_release = ref_date + timedelta(days=predicted_days)

        return {
            "predicted_completion_days": predicted_days,
            "predicted_release_date": predicted_release.strftime("%Y-%m-%d"),
            "algorithm": "Random Forest Regressor",
            "model_version": HISTORICAL_MODEL_VERSION,
        }

    # ------------------------------------------------------------------
    # PUBLIC: Model info
    # ------------------------------------------------------------------
    def get_model_info(self) -> Dict[str, Any]:
        model_exists = os.path.exists(self.model_path)
        trained_at = None
        if model_exists:
            mtime = os.path.getmtime(self.model_path)
            trained_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        return {
            "model_trained": model_exists,
            "algorithm": "Random Forest Regressor",
            "model_version": HISTORICAL_MODEL_VERSION,
            "last_trained_at": trained_at or self.last_train_date,
            "dataset_size": self.dataset_size,
        }


# Singleton
historical_ml_engine = HistoricalMLEngine()

