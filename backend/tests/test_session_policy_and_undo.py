import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db"))

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User, Role, Order, Status, Payment, PaymentStatus, PaymentMethod
from auth_utils import (
    register_user_session, 
    revoke_user_session, 
    is_user_session_active,
    is_eval_account,
    invalidate_user_cache,
    _ACTIVE_USER_SESSIONS,
    _ACTIVE_EVAL_SESSIONS,
    _REVOKED_SESSIONS,
)

client = TestClient(app)

from main import bcrypt
HASH_OWNER = bcrypt.hash("@Owner123")
HASH_STAFF = bcrypt.hash("@Staff123")
HASH_EXPERT = bcrypt.hash("expert123")

@pytest.fixture(autouse=True)
def clean_sessions():
    """Ensure clean in-memory and database session state before each test."""
    _ACTIVE_USER_SESSIONS.clear()
    _ACTIVE_EVAL_SESSIONS.clear()
    _REVOKED_SESSIONS.clear()
    invalidate_user_cache()
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for u in users:
            u.active_session_id = None
            u.failed_login_attempts = 0
            u.locked_until = None
            uname = (u.username or '').lower()
            if uname == 'owner':
                u.password_hash = HASH_OWNER
            elif uname == 'staff':
                u.password_hash = HASH_STAFF
            elif uname in ('expert_owner', 'expert_staff'):
                u.password_hash = HASH_EXPERT
        db.commit()
    finally:
        db.close()
    yield
    _ACTIVE_USER_SESSIONS.clear()
    _ACTIVE_EVAL_SESSIONS.clear()
    _REVOKED_SESSIONS.clear()
    invalidate_user_cache()


def test_regression_a_actual_owner_multi_session():
    """
    Requirement:
    Browser/Session A: login succeeds.
    Browser/Session B: simultaneous login succeeds.
    Both sessions valid.
    Logging out Session A invalidates ONLY Session A; Session B remains valid.
    """
    # 1. Login Session A
    res_a = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_a.status_code != 200:
        res_a = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    assert res_a.status_code == 200, f"Session A login failed: {res_a.text}"
    token_a = res_a.json()["access_token"]

    # 2. Login Session B (Same owner account) -> Must succeed
    res_b = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_b.status_code != 200:
        res_b = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    assert res_b.status_code == 200, f"Expected 200 for simultaneous login, got {res_b.status_code}: {res_b.text}"
    token_b = res_b.json()["access_token"]
    assert token_a != token_b, "Tokens must have unique session identifiers"

    # 3. Both sessions are valid
    res_me_a = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_me_a.status_code == 200, f"Session A check failed: {res_me_a.text}"
    res_me_b = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_me_b.status_code == 200, f"Session B check failed: {res_me_b.text}"

    # 4. Logout Session A only
    res_logout = client.post("/api/logout", headers={"Authorization": f"Bearer {token_a}"})
    assert res_logout.status_code == 200

    # 5. Session A is revoked; Session B remains valid
    res_me_a_after = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_me_a_after.status_code == 401, f"Expected 401 for Session A after logout, got {res_me_a_after.status_code}"
    res_me_b_after = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_me_b_after.status_code == 200, f"Session B was unexpectedly invalidated: {res_me_b_after.text}"


def test_regression_b_actual_staff_multi_session():
    """
    Requirement:
    Staff account allows multiple concurrent sessions.
    """
    res_a = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_a.status_code != 200:
        res_a = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res_a.status_code == 200, f"Session A login failed: {res_a.text}"
    token_a = res_a.json()["access_token"]

    # Second login succeeds
    res_b = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_b.status_code != 200:
        res_b = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res_b.status_code == 200, f"Expected 200, got {res_b.status_code}: {res_b.text}"
    token_b = res_b.json()["access_token"]

    # Both valid
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200



def test_regression_c_expert_owner_multi_session():
    """
    Requirement 8C:
    expert_owner:
    Session A: login succeeds.
    Session B: login succeeds.
    Verify: Session A remains valid, Session B remains valid.
    Logout Session A: Session A invalid, Session B still valid.
    """
    # Session A
    res_a = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    assert res_a.status_code == 200, f"expert_owner login A failed: {res_a.text}"
    token_a = res_a.json()["access_token"]

    # Session B (allowed simultaneously)
    res_b = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    assert res_b.status_code == 200, f"expert_owner login B failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    assert token_a != token_b, "Tokens must have distinct SIDs"

    # Both valid
    res_me_a = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_me_a.status_code == 200, f"Session A failed check: {res_me_a.text}"

    res_me_b = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_me_b.status_code == 200, f"Session B failed check: {res_me_b.text}"

    # Logout Session A only
    res_logout_a = client.post("/api/logout", headers={"Authorization": f"Bearer {token_a}"})
    assert res_logout_a.status_code == 200

    # Session A now invalid
    res_me_a_after = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_me_a_after.status_code == 401, f"Expected 401 for logged out Session A, got {res_me_a_after.status_code}"

    # Session B remains valid
    res_me_b_after = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_me_b_after.status_code == 200, f"Session B was unexpectedly invalidated by Session A logout: {res_me_b_after.text}"


def test_regression_d_expert_staff_multi_session():
    """
    Requirement 8D:
    expert_staff:
    Session A: login succeeds.
    Session B: login succeeds.
    Verify both remain valid simultaneously.
    """
    res_a = client.post("/api/login", json={"username": "expert_staff", "password": "expert123"})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]

    res_b = client.post("/api/login", json={"username": "expert_staff", "password": "expert123"})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200


def test_regression_e_different_accounts():
    """
    Requirement 8E:
    Owner + Staff: allowed.
    expert_owner + expert_staff: allowed.
    Owner + expert_owner: allowed.
    """
    # 1. Owner + Staff
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    assert res_owner.status_code == 200
    t_owner = res_owner.json()["access_token"]

    res_staff = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_staff.status_code != 200:
        res_staff = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res_staff.status_code == 200
    t_staff = res_staff.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {t_owner}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {t_staff}"}).status_code == 200

    # 2. expert_owner + expert_staff
    res_eo = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    assert res_eo.status_code == 200
    t_eo = res_eo.json()["access_token"]

    res_es = client.post("/api/login", json={"username": "expert_staff", "password": "expert123"})
    assert res_es.status_code == 200
    t_es = res_es.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {t_eo}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {t_es}"}).status_code == 200


def test_regression_f_revoked_session_access():
    """
    Requirement 8F:
    A revoked session cannot access protected APIs.
    """
    res = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res.status_code != 200:
        res = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    token = res.json()["access_token"]

    # Logout
    client.post("/api/logout", headers={"Authorization": f"Bearer {token}"})

    # Protected endpoint should reject
    res_check = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert res_check.status_code == 401


def test_regression_g_locked_evaluation_account():
    """
    Requirement 8G:
    Lock expert_owner -> ALL active sessions must be rejected (HTTP 403).
    Unlock expert_owner -> Normal authentication resumes.
    """
    db = SessionLocal()
    eo = db.query(User).filter(User.username == "expert_owner").first()
    eo_id = eo.user_id
    db.close()

    # Session A & B
    res_a = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    res_b = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    token_a = res_a.json()["access_token"]
    token_b = res_b.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200

    # Lock account via admin / owner
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    t_owner = res_owner.json()["access_token"]

    res_lock = client.post(f"/api/users/{eo_id}/lock", headers={"Authorization": f"Bearer {t_owner}"})
    assert res_lock.status_code == 200

    # ALL sessions for expert_owner must now be rejected with 403
    res_chk_a = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_chk_a.status_code == 403, f"Expected 403 for locked account, got {res_chk_a.status_code}: {res_chk_a.text}"

    res_chk_b = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_chk_b.status_code == 403, f"Expected 403 for locked account, got {res_chk_b.status_code}: {res_chk_b.text}"

    # Unlock account
    res_unlock = client.post(f"/api/users/{eo_id}/unlock", headers={"Authorization": f"Bearer {t_owner}"})
    assert res_unlock.status_code == 200

    # New login succeeds
    res_new = client.post("/api/login", json={"username": "expert_owner", "password": "expert123"})
    assert res_new.status_code == 200
    t_new = res_new.json()["access_token"]
    assert client.get("/api/me", headers={"Authorization": f"Bearer {t_new}"}).status_code == 200


def test_order_undo_data_preservation():
    """
    Requirements 10-12: Order cancellation and undo must preserve:
    - intake date (created_at)
    - expected date (expected_at)
    - financial status, grand total, amount received, balance
    """
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    token = res_owner.json()["access_token"]

    # 1. Create Downpayment Order
    order_payload = {
        "customerName": "Undo Regression Customer",
        "contactNumber": "09123456789",
        "serviceName": "Basic Cleaning",
        "price": 825.0,
        "grandTotal": 825.0,
        "amountReceived": 412.50,
        "depositAmount": 412.50,
        "balance": 412.50,
        "paymentStatus": "downpayment",
        "paymentMethod": "cash",
        "priorityLevel": "regular",
        "items": [
            {
                "brand": "Nike",
                "shoeModel": "Air Max",
                "shoeMaterial": "Canvas",
                "color": "White",
                "shoeSize": "10",
                "quantity": 1,
                "services": ["Basic Cleaning"],
                "price": 825.0
            }
        ]
    }
    res_create = client.post("/api/orders", json=order_payload, headers={"Authorization": f"Bearer {token}"})
    assert res_create.status_code == 200, f"Order creation failed: {res_create.text}"
    created_order = res_create.json()
    order_id = created_order["order_id"]
    orig_created_at = created_order["created_at"]
    orig_expected_at = created_order["expected_at"]

    # 2. Cancel order with preCancellationState
    pre_cancel_state = {
        "status": "new-order",
        "paymentStatus": "downpayment",
        "amountReceived": 412.50,
        "depositAmount": 412.50,
        "balance": 412.50,
        "grandTotal": 825.0,
        "created_at": orig_created_at,
        "expected_at": orig_expected_at
    }
    cancel_payload = {
        "status": "cancelled",
        "cancellationStage": "New Order",
        "cancellationReason": "Customer Request",
        "refundStatus": "Refunded",
        "refundAmount": 412.50,
        "preCancellationState": pre_cancel_state
    }
    res_cancel = client.put(f"/api/orders/{order_id}", json=cancel_payload, headers={"Authorization": f"Bearer {token}"})
    assert res_cancel.status_code == 200

    # 3. Undo cancel and restore preCancellationState
    undo_payload = {
        "status": pre_cancel_state["status"],
        "paymentStatus": pre_cancel_state["paymentStatus"],
        "amountReceived": pre_cancel_state["amountReceived"],
        "depositAmount": pre_cancel_state["depositAmount"],
        "balance": pre_cancel_state["balance"],
        "grandTotal": pre_cancel_state["grandTotal"],
        "cancellationStage": None,
        "cancellationReason": None,
        "refundStatus": None,
        "refundAmount": 0.0,
        "refundReason": None,
        "preCancellationState": None
    }
    res_undo = client.put(f"/api/orders/{order_id}", json=undo_payload, headers={"Authorization": f"Bearer {token}"})
    assert res_undo.status_code == 200
    restored = res_undo.json()

    # Verify intake date, expected date, and financial values are 100% preserved
    assert restored["status"]["status_name"] == "new-order"
    assert restored["created_at"] == orig_created_at
    assert restored["expected_at"] == orig_expected_at
    assert float(restored["grand_total"]) == 825.0
    assert float(restored["payments"][0]["amount_received"]) == 412.50
    assert float(restored["payments"][0]["balance"]) == 412.50
    p_status = restored["payments"][0].get("p_status") or restored["payments"][0].get("status")
    assert p_status["status_name"] == "downpayment"
