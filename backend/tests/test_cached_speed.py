import time
from ml.ml_engine import predictor
from ml.historical_ml_engine import build_features_from_live_order, FEATURE_COLS as HISTORICAL_FEATURE_COLS

order_data = {'items': [{'baseService': ['Basic Cleaning']}], 'priorityLevel': 'regular', 'grandTotal': 250}

t0 = time.time()
features = build_features_from_live_order(order_data)
row = [features.get(col, 0) for col in HISTORICAL_FEATURE_COLS]
rf_days = float(predictor.model.predict([row])[0])
t1 = time.time()
print("Inference time:", round((t1 - t0) * 1000, 3), "ms, predicted days:", round(rf_days, 1))
