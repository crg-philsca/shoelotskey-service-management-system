import os
import sys
import uuid
import requests

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "db"))

from database import SessionLocal
from models import User, HistoricalOrder
from auth_utils import create_access_token, register_user_session

def verify():
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    sid = str(uuid.uuid4())
    token = create_access_token(data={"sub": admin.username, "role": "admin", "uid": admin.user_id}, session_id=sid)
    register_user_session(db, admin, sid)
    db.commit()

    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get("http://127.0.0.1:8000/api/historical/processing/queue?limit=1&source_filter=potential_ml", headers=headers)
    print("Queue status code:", resp.status_code)
    data = resp.json()
    items = data.get("items", [])
    print("Queue items returned:", len(items))
    if items:
        cand = items[0].get("order", {})
        print(f"Top Candidate in queue: order_id={cand.get('order_id')}, historical_order_id={cand.get('historical_order_id')}, ocr_status={cand.get('ocr_status')}")

    # Verify counts
    active_count = db.query(HistoricalOrder).filter(HistoricalOrder.is_legacy_archived == False).count()
    pending_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status.in_(["PENDING_REVIEW", "UNPROCESSED"])
    ).count()
    potential_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.potential_ml_candidate == True,
        HistoricalOrder.ocr_status == "PENDING_REVIEW"
    ).count()
    validated_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "VALIDATED"
    ).count()
    corrected_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "CORRECTED"
    ).count()
    rejected_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status == "REJECTED"
    ).count()
    confirmed_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.sync_status == "CONFIRMED_ML_ELIGIBLE"
    ).count()
    clean_ml_count = db.query(HistoricalOrder).filter(
        HistoricalOrder.is_legacy_archived == False,
        HistoricalOrder.ocr_status.in_(["VALIDATED", "CORRECTED"]),
        HistoricalOrder.completion_days.isnot(None),
        HistoricalOrder.target_provenance == "CLAIM_DATE_CALCULATED"
    ).count()

    print("LIVE DATABASE STATUS:")
    print(f"Active: {active_count}")
    print(f"Pending: {pending_count}")
    print(f"Potential ML: {potential_ml_count}")
    print(f"Validated: {validated_count}")
    print(f"Corrected: {corrected_count}")
    print(f"Rejected: {rejected_count}")
    print(f"Confirmed ML Eligible: {confirmed_ml_count}")
    print(f"Clean ML Dataset: {clean_ml_count}")

    cand_1 = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == 1507).first()
    print(f"Candidate 1507 status: {cand_1.ocr_status}")

    db.close()

if __name__ == "__main__":
    verify()
