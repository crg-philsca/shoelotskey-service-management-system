import sys
import os
from decimal import Decimal
from datetime import date, datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app, get_db
from auth_utils import create_access_token
from models import User, Role, CashSession, AuditLog

client = TestClient(app)

def create_token_for_user(username: str) -> str:
    return create_access_token(data={"sub": username})

def run_tests():
    print("=== STARTING CASH REGISTER & RBAC TESTS ===")

    # 1. Check Roles in DB
    db = next(get_db())
    front_role = db.query(Role).filter(Role.role_name == "front staff").first()
    assert front_role is not None, "Role 'front staff' not found in database!"
    print("[PASS] Role 'front staff' exists with id:", front_role.role_id)

    staff_user = db.query(User).filter(User.role.has(role_name="staff")).first()
    assert staff_user is not None, "Staff user not found in database!"

    front_user = db.query(User).filter(User.username == "front_staff").first()
    assert front_user is not None, "User 'front_staff' not found!"
    assert front_user.role.role_name == "front staff", f"User front_staff has role {front_user.role.role_name}, expected 'front staff'"
    print(f"[PASS] User front_staff has role 'front staff'")

    staff_token = create_token_for_user(staff_user.username)
    front_token = create_token_for_user(front_user.username)

    # 2. RBAC: Regular staff must be rejected with 403 Forbidden
    endpoints = [
        ("GET", "/api/cash-register/current"),
        ("GET", "/api/cash-register/summary"),
        ("GET", "/api/cash-register/transactions"),
        ("POST", "/api/cash-register/open"),
        ("POST", "/api/cash-register/close"),
        ("GET", "/api/dashboard/front-staff-summary"),
    ]

    for method, path in endpoints:
        if method == "GET":
            res = client.get(path, headers={"Authorization": f"Bearer {staff_token}"})
        else:
            res = client.post(path, json={}, headers={"Authorization": f"Bearer {staff_token}"})
        assert res.status_code == 403, f"Expected 403 for staff on {method} {path}, got {res.status_code}"
    print("[PASS] Regular staff strictly blocked (403 Forbidden) on all 6 cash register endpoints")

    # 3. Front staff has access (200 OK)
    res = client.get("/api/cash-register/current", headers={"Authorization": f"Bearer {front_token}"})
    assert res.status_code == 200, f"Expected 200 for front staff, got {res.status_code}: {res.text}"
    print("[PASS] Front staff can access /api/cash-register/current")

    res = client.get("/api/dashboard/front-staff-summary", headers={"Authorization": f"Bearer {front_token}"})
    assert res.status_code == 200, f"Expected 200 for front staff dashboard summary, got {res.status_code}: {res.text}"
    data = res.json()
    assert "total_sales" in data
    assert "cash_sales" in data
    assert "digital_sales" in data
    assert "balance_due" in data
    assert "daily_expenses" in data
    assert "cash_on_hand" in data
    print("[PASS] Front staff summary returns all 6 required KPI metrics:", data)

    # 4. Open cash register session test
    # Clean up any OPEN sessions from today for a clean test
    today = date.today()
    open_sessions = db.query(CashSession).filter(CashSession.business_date == today, CashSession.status == "OPEN").all()
    for s in open_sessions:
        s.status = "CLOSED"
        s.closed_at = datetime.utcnow()
    db.commit()

    open_res = client.post(
        "/api/cash-register/open",
        json={"opening_cash": 1000.00},
        headers={"Authorization": f"Bearer {front_token}"}
    )
    assert open_res.status_code == 200, f"Failed to open session: {open_res.text}"
    session_data = open_res.json()["session"]
    assert session_data["status"] == "OPEN"
    assert session_data["opening_cash"] == 1000.0
    print("[PASS] Successfully opened cash register session with 1000.00 beginning cash")

    # Test opening again while active should fail
    dup_open = client.post(
        "/api/cash-register/open",
        json={"opening_cash": 500.00},
        headers={"Authorization": f"Bearer {front_token}"}
    )
    assert dup_open.status_code == 400, f"Expected 400 on duplicate open, got {dup_open.status_code}"
    print("[PASS] Prevented duplicate session creation while register is OPEN")

    # 5. Summary and transactions check
    summary_res = client.get("/api/cash-register/summary", headers={"Authorization": f"Bearer {front_token}"})
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["beginning_cash"] == 1000.0
    print("[PASS] Cash Register summary calculates beginning cash and expected cash on hand:", summary)

    tx_res = client.get("/api/cash-register/transactions", headers={"Authorization": f"Bearer {front_token}"})
    assert tx_res.status_code == 200
    txs = tx_res.json()["transactions"]
    assert len(txs) >= 1
    assert "Beginning Cash Fund" in txs[0]["transaction"]
    print(f"[PASS] Cash Register transactions returned {len(txs)} records with Beginning Cash Fund")

    # 6. Close session test
    # Discrepancy without variance reason should fail
    fail_close = client.post(
        "/api/cash-register/close",
        json={"actual_cash": summary["expected_cash"] - 50.0},
        headers={"Authorization": f"Bearer {front_token}"}
    )
    assert fail_close.status_code == 400, "Expected 400 when closing with variance but no reason"
    print("[PASS] Closing with variance requires variance_reason")

    # Close with variance reason
    success_close = client.post(
        "/api/cash-register/close",
        json={
            "actual_cash": summary["expected_cash"] - 50.0,
            "variance_reason": "Shortage verified during count"
        },
        headers={"Authorization": f"Bearer {front_token}"}
    )
    assert success_close.status_code == 200, f"Failed to close session: {success_close.text}"
    closed_session = success_close.json()["session"]
    assert closed_session["status"] == "CLOSED"
    assert closed_session["over_short"] == -50.0
    print("[PASS] Successfully closed register session with SHORT (-50.00) and recorded variance reason")

    print("\n=== ALL CASH REGISTER & RBAC BACKEND TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
