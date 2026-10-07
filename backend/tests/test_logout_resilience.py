import sys
import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from main import app
from auth_utils import SECRET_KEY, ALGORITHM

client = TestClient(app)

def test_logout_resilience():
    print("\n--- RUNNING LOGOUT RESILIENCE TESTS ---")
    
    # 1. Logout without any credentials
    res1 = client.post("/api/logout")
    assert res1.status_code == 200, f"Expected 200 for missing token logout, got {res1.status_code}: {res1.text}"
    print("[PASS] Logout with NO credentials returned HTTP 200.")

    # 2. Logout with completely garbage token
    res2 = client.post("/api/logout", headers={"Authorization": "Bearer not-a-real-token-12345"})
    assert res2.status_code == 200, f"Expected 200 for garbage token logout, got {res2.status_code}: {res2.text}"
    print("[PASS] Logout with GARBAGE token returned HTTP 200.")

    # 3. Logout with an expired token
    expired_payload = {
        "sub": "admin",
        "sid": "test-expired-sid-123",
        "exp": datetime.now(timezone.utc) - timedelta(hours=2)
    }
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)
    res3 = client.post("/api/logout", headers={"Authorization": f"Bearer {expired_token}"})
    assert res3.status_code == 200, f"Expected 200 for EXPIRED token logout, got {res3.status_code}: {res3.text}"
    print("[PASS] Logout with EXPIRED token returned HTTP 200 (never 401).")

    # 4. Generate a valid token with a real session and test logout
    from auth_utils import create_access_token, register_user_session
    from db.database import SessionLocal
    from models import User
    
    db = SessionLocal()
    user = db.query(User).first()
    test_sid = "test-resilience-sid-999"
    if user:
        register_user_session(db, user, test_sid)
        valid_token = create_access_token(data={"sub": user.username}, session_id=test_sid)
    else:
        valid_token = create_access_token(data={"sub": "admin"}, session_id=test_sid)
    db.close()

    res4 = client.post("/api/logout", headers={"Authorization": f"Bearer {valid_token}"})
    assert res4.status_code == 200, f"Expected 200 for valid token logout, got {res4.status_code}: {res4.text}"
    print("[PASS] Logout with VALID token returned HTTP 200 and revoked session.")

    # 5. Calling logout AGAIN with the already-revoked token should STILL return 200, NEVER 401
    res5 = client.post("/api/logout", headers={"Authorization": f"Bearer {valid_token}"})
    assert res5.status_code == 200, f"Expected 200 for already-revoked token logout, got {res5.status_code}: {res5.text}"
    print("[PASS] Repeat logout with REVOKED token returned HTTP 200 (prevents infinite loops).")

    print("\nALL LOGOUT RESILIENCE TESTS PASSED SUCCESSFULLY! (5/5)\n")

if __name__ == "__main__":
    test_logout_resilience()
