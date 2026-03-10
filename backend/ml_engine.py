import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
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
        active_statuses = db.query(Status).filter(
            func.lower(Status.status_name).in_(['pending', 'in progress'])
        ).all()
        status_ids = [s.status_id for s in active_statuses]
        return db.query(Order).filter(Order.status_id.in_(status_ids)).count()

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

        return datetime.now() + timedelta(days=round(predicted_days))

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
            is_rush = 1 if o.priority and o.priority.priority_name == 'Rush' else 0
            
            svc_count = 0
            cond_count = 0
            for item in o.items:
                svc_count += len(item.services)
                cond_count += len(item.conditions)
            
            # Note: We don't have historical workload at time of creation saved in Order (3NF improvement opportunity!)
            # For now, we use a constant or average.
            
            data.append({
                'item_count': item_count,
                'is_rush': is_rush,
                'svc_count': svc_count,
                'cond_count': cond_count,
                'actual_days': actual_days
            })
            
        df = pd.DataFrame(data)
        X = df[['item_count', 'is_rush', 'svc_count', 'cond_count']]
        # We add 'workload' and 'heuristic' here if we had them saved.
        # This is enough to demonstrate the principle.
        
        # Train!
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        # We need more features for a real model, but this validates the 3NF data entry.
        # Target: actual_days
        y = df['actual_days']
        self.model.fit(X, y)
        
        # Save model
        with open(self.model_path, 'wb') as f:
            pickle.dump(self.model, f)
        
        print(f">>> Predictor: Model trained on {len(orders)} historical samples.")
        return True

# Singleton Instance
predictor = ShoelotskeyPredictor()
