import os
import sys
import uuid
import requests

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "db"))

from database import SessionLocal
from models import User
from auth_utils import create_access_token, register_user_session

def test_lock():
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    sid = str(uuid.uuid4())
    token = create_access_token(data={"sub": admin.username, "role": "admin", "uid": admin.user_id}, session_id=sid)
    register_user_session(db, admin, sid)
    db.commit()

    headers = {"Authorization": f"Bearer {token}"}
    r1 = requests.post("http://127.0.0.1:8000/api/historical/train", headers=headers)
    print("/api/historical/train status:", r1.status_code, r1.json())
    assert r1.status_code == 403, f"Expected 403, got {r1.status_code}"

    r2 = requests.post("http://127.0.0.1:8000/api/historical/predictions/batch", headers=headers)
    print("/api/historical/predictions/batch status:", r2.status_code, r2.json())
    assert r2.status_code == 403, f"Expected 403, got {r2.status_code}"

    r3 = requests.post("http://127.0.0.1:8000/api/ml/train", headers=headers)
    print("/api/ml/train status:", r3.status_code, r3.json())
    assert r3.status_code == 403, f"Expected 403, got {r3.status_code}"

    from scripts.retrain_weekly import run_weekly_retraining
    retrain_res = run_weekly_retraining(force=True)
    print("run_weekly_retraining result:", retrain_res)
    assert retrain_res.get("status") == "locked", f"Expected status 'locked', got {retrain_res.get('status')}"
    assert retrain_res.get("can_train") is False, "can_train should be False"

    db.close()
    print("ALL LOCK ENFORCEMENT CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_lock()
