import sys, os
import threading
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db"))

from main import app, bcrypt
from database import SessionLocal
from models import User, Role, Order, Status, Payment, Inventory, UserSession, AuditLog
from auth_utils import (
    register_user_session, 
    revoke_user_session, 
    _ACTIVE_USER_SESSIONS, 
    _REVOKED_SESSIONS,
    invalidate_user_cache
)

client = TestClient(app)

HASH_OWNER = bcrypt.hash("@Owner123")
HASH_STAFF = bcrypt.hash("@Staff123")

@pytest.fixture(autouse=True)
def setup_test_db():
    _ACTIVE_USER_SESSIONS.clear()
    _REVOKED_SESSIONS.clear()
    invalidate_user_cache()
    db = SessionLocal()
    try:
        # Clean user sessions
        db.query(UserSession).delete()
        
        # Reset accounts
        owner = db.query(User).filter(User.username == "owner").first()
        if owner:
            owner.failed_login_attempts = 0
            owner.locked_until = None
            owner.is_active = True
            owner.password_hash = HASH_OWNER

        staff = db.query(User).filter(User.username == "staff").first()
        if staff:
            staff.failed_login_attempts = 0
            staff.locked_until = None
            staff.is_active = True
            staff.password_hash = HASH_STAFF

        db.commit()
    finally:
        db.close()
    yield
    _ACTIVE_USER_SESSIONS.clear()
    _REVOKED_SESSIONS.clear()
    invalidate_user_cache()


def test_multi_session_same_account_owner():
    """
    Browser A logs in as owner -> Session A.
    Browser B logs in as owner -> Session B.
    Both sessions must be valid simultaneously.
    Logging out Session A invalidates ONLY Session A; Session B remains valid.
    """
    # 1. Login Browser A
    res_a = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_a.status_code != 200:
        res_a = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    assert res_a.status_code == 200, f"Login A failed: {res_a.text}"
    token_a = res_a.json()["access_token"]

    # 2. Login Browser B (Same owner account, simultaneous)
    res_b = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_b.status_code != 200:
        res_b = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    assert res_b.status_code == 200, f"Login B failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    assert token_a != token_b, "Tokens must have distinct session identifiers"

    # 3. Both sessions are valid
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200

    # 4. Logout Session A only
    res_logout_a = client.post("/api/logout", headers={"Authorization": f"Bearer {token_a}"})
    assert res_logout_a.status_code == 200

    # 5. Session A is revoked (401)
    res_me_a = client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_me_a.status_code == 401, f"Expected 401 for Session A after logout, got {res_me_a.status_code}"

    # 6. Session B remains valid (200)
    res_me_b = client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"})
    assert res_me_b.status_code == 200, f"Session B was unexpectedly invalidated: {res_me_b.text}"


def test_multi_session_same_account_staff():
    """
    Browser A logs in as staff -> Session A.
    Browser B logs in as staff -> Session B.
    Both sessions must be valid simultaneously.
    """
    res_a = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_a.status_code != 200:
        res_a = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]

    res_b = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_b.status_code != 200:
        res_b = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200


def test_authorization_401_vs_403():
    """
    401: Unauthenticated / Invalid token.
    403: Authenticated as staff attempting owner-only /api/users endpoint.
    """
    # 401 on invalid token
    res_invalid = client.get("/api/users", headers={"Authorization": "Bearer invalid_token"})
    assert res_invalid.status_code == 401

    # Login as staff
    res_staff = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_staff.status_code != 200:
        res_staff = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    token_staff = res_staff.json()["access_token"]

    # 403 on staff accessing owner-only /api/users
    res_forbidden = client.get("/api/users", headers={"Authorization": f"Bearer {token_staff}"})
    assert res_forbidden.status_code == 403, f"Expected 403 Forbidden, got {res_forbidden.status_code}"


def test_admin_lock_revokes_all_sessions_for_account():
    """
    Administrative lock on an account blocks ALL sessions for that user.
    """
    # Create Session A and Session B for staff
    res_a = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_a.status_code != 200:
        res_a = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    token_a = res_a.json()["access_token"]

    res_b = client.post("/api/login", json={"username": "staff", "password": "@Staff123"})
    if res_b.status_code != 200:
        res_b = client.post("/api/login", json={"username": "staff", "password": "staff123"})
    token_b = res_b.json()["access_token"]

    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 200
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200

    # Owner locks the staff account
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    token_owner = res_owner.json()["access_token"]

    db = SessionLocal()
    staff_user = db.query(User).filter(User.username == "staff").first()
    staff_id = staff_user.user_id
    db.close()

    res_lock = client.post(f"/api/users/{staff_id}/lock", headers={"Authorization": f"Bearer {token_owner}"})
    assert res_lock.status_code == 200

    # Both Session A and Session B are now blocked with 403
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_a}"}).status_code == 403
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token_b}"}).status_code == 403


def test_concurrent_order_creation_unique_numbers():
    """
    Simulate two browser sessions concurrently creating orders for the same day.
    Both must succeed with unique, distinct order numbers.
    """
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    token = res_owner.json()["access_token"]

    created_orders = []
    errors = []

    def make_order(c_name: str):
        payload = {
            "customerName": c_name,
            "contactNumber": "09171234567",
            "priorityLevel": "regular",
            "grandTotal": 850.0,
            "paymentStatus": "fully-paid",
            "paymentMethod": "cash",
            "items": [
                {
                    "brand": "Nike",
                    "shoeModel": "Air Force 1",
                    "quantity": 1,
                    "services": [{"serviceName": "Basic Cleaning", "price": 850.0}]
                }
            ]
        }
        res = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {token}"})
        if res.status_code == 200:
            created_orders.append(res.json()["order_number"])
        else:
            errors.append(res.text)

    t1 = threading.Thread(target=make_order, args=("Alice Concurrency",))
    t2 = threading.Thread(target=make_order, args=("Bob Concurrency",))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert len(errors) == 0, f"Order creation errors: {errors}"
    assert len(created_orders) == 2
    assert created_orders[0] != created_orders[1], f"Duplicate order numbers generated: {created_orders}"


def test_concurrent_inventory_stock_protection():
    """
    Initial stock = 5 units.
    Order A requests 3 units.
    Order B concurrently requests 3 units.
    One must succeed (leaving 2), and the second must fail with 400 Insufficient Stock.
    Stock must never become negative.
    """
    res_owner = client.post("/api/login", json={"username": "owner", "password": "@Owner123"})
    if res_owner.status_code != 200:
        res_owner = client.post("/api/login", json={"username": "owner", "password": "owner123"})
    token = res_owner.json()["access_token"]

    db = SessionLocal()
    # Create or update a test inventory item with stock = 5
    test_inv = db.query(Inventory).filter(Inventory.item_name == "Concurrency Test Polish").first()
    if not test_inv:
        test_inv = Inventory(
            item_name="Concurrency Test Polish",
            category="supplies",
            stock_quantity=5.0,
            unit="bottles",
            unit_price=100.0,
            is_active=True
        )
        db.add(test_inv)
        db.commit()
        db.refresh(test_inv)
    else:
        test_inv.stock_quantity = 5.0
        db.commit()
    inv_id = test_inv.item_id
    db.close()

    results = []

    def make_order_with_inv(c_name: str):
        payload = {
            "customerName": c_name,
            "contactNumber": "09179998877",
            "priorityLevel": "regular",
            "grandTotal": 500.0,
            "paymentStatus": "fully-paid",
            "paymentMethod": "cash",
            "inventoryUsed": [{"itemId": inv_id, "amount": 3.0}],
            "items": [
                {
                    "brand": "Adidas",
                    "shoeModel": "Samba",
                    "quantity": 1,
                    "inventoryUsed": [{"itemId": inv_id, "amount": 3.0}]
                }
            ]
        }
        res = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {token}"})
        results.append(res.status_code)

    t1 = threading.Thread(target=make_order_with_inv, args=("Charlie Concurrency",))
    t2 = threading.Thread(target=make_order_with_inv, args=("David Concurrency",))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # One should succeed (200), one should fail due to insufficient stock (400)
    assert 200 in results
    assert 400 in results

    # Verify final stock is exactly 2.0 (5 - 3 = 2), never negative
    db = SessionLocal()
    final_inv = db.query(Inventory).filter(Inventory.item_id == inv_id).first()
    assert final_inv.stock_quantity == 2.0
    db.close()
