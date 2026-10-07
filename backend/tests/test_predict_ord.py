import json
from db.database import SessionLocal
from models import Order, Item
from ml.ml_engine import predictor, live_order_payload_from_db_order

db = SessionLocal()
order = db.query(Order).filter(Order.order_number == 'ORD-2026-09-11-001').first()
if order:
    payload = live_order_payload_from_db_order(order)
    print("PAYLOAD:", json.dumps(payload, indent=2))
    estimate = predictor.estimate_order_release(db, payload)
    print("ESTIMATE RESULT:")
    for k, v in estimate.items():
        print(f"  {k}: {v}")
else:
    print("Order not found")
db.close()
