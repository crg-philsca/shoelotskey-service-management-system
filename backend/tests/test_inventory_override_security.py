import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app, get_db
import models
import auth_utils
import schemas

client = TestClient(app)

def create_token_for_user(username: str) -> str:
    return auth_utils.create_access_token(data={"sub": username})

def get_auth_headers(username: str):
    token = create_token_for_user(username)
    return {"Authorization": f"Bearer {token}"}

def run_all_tests():
    print("=" * 70)
    print("INVENTORY OVERRIDE & CONFIDENTIALITY CONTROLS VERIFICATION TEST SUITE")
    print("=" * 70)

    db = next(get_db())

    # 1. Setup Owner user
    owner_user = db.query(models.User).filter(models.User.role.has(role_name="owner")).first()
    if not owner_user:
        owner_role = db.query(models.Role).filter(models.Role.role_name == "owner").first()
        import bcrypt
        pw_hash = bcrypt.hashpw(b"@Owner123", bcrypt.gensalt()).decode("utf-8")
        owner_user = models.User(
            username="owner_test",
            email="owner_test@shoelotskey.com",
            password_hash=pw_hash,
            role_id=owner_role.role_id if owner_role else 1,
            is_active=True
        )
        db.add(owner_user)
        db.commit()
        db.refresh(owner_user)

    owner_headers = get_auth_headers(owner_user.username)
    print(f"[SETUP] Owner user: {owner_user.username} (ID: {owner_user.user_id})")

    # 2. Setup Staff user
    staff_role = db.query(models.Role).filter(models.Role.role_name == "staff").first()
    assert staff_role is not None, "Staff role not found in database!"

    test_staff = db.query(models.User).filter(models.User.username == "test_staff_inv_security").first()
    if not test_staff:
        import bcrypt
        pw_hash = bcrypt.hashpw(b"StaffPass123!", bcrypt.gensalt()).decode("utf-8")
        test_staff = models.User(
            username="test_staff_inv_security",
            email="test_staff_inv_security@shoelotskey.com",
            password_hash=pw_hash,
            role_id=staff_role.role_id,
            is_active=True
        )
        db.add(test_staff)
        db.commit()
        db.refresh(test_staff)

    # Configure canonical base permissions for test_staff
    # Grant: inventory.view, inventory.add_stock, inventory.use_stock, inventory.adjust_balance
    staff_perms_to_grant = ["inventory.view", "inventory.add_stock", "inventory.use_stock", "inventory.adjust_balance"]
    for perm_name in staff_perms_to_grant:
        perm_obj = db.query(models.Permission).filter(models.Permission.code == perm_name).first()
        if perm_obj:
            existing = db.query(models.UserPermission).filter(
                models.UserPermission.user_id == test_staff.user_id,
                models.UserPermission.permission_id == perm_obj.permission_id
            ).first()
            if not existing:
                db.add(models.UserPermission(user_id=test_staff.user_id, permission_id=perm_obj.permission_id))
    db.commit()

    staff_headers = get_auth_headers(test_staff.username)
    print(f"[SETUP] Staff user: {test_staff.username} (ID: {test_staff.user_id})")

    # 3. Create or find dedicated test inventory item
    test_item = db.query(models.Inventory).filter(models.Inventory.item_name == "Security Test Item Sole Cleaner").first()
    if not test_item:
        test_item = models.Inventory(
            item_name="Security Test Item Sole Cleaner",
            category="Chemical",
            stock_quantity=100.0,
            unit="mL",
            unit_price=450.00,
            retail_price=750.00,
            is_retail=True,
            is_active=True,
            low_stock_threshold=20.0,
            auto_deduct=False
        )
        db.add(test_item)
        db.commit()
        db.refresh(test_item)
    else:
        test_item.stock_quantity = 100.0
        test_item.unit_price = 450.00
        test_item.retail_price = 750.00
        test_item.is_active = True
        db.commit()

    item_id = test_item.item_id
    print(f"[SETUP] Test item ID {item_id}: {test_item.item_name} (Stock: {test_item.stock_quantity})")

    # TEST 1: Staff 403 Forbidden on GET /api/inventory/{item_id}/logs
    print("\n[TEST 1] Staff 403 Forbidden on GET /api/inventory/{item_id}/logs")
    res = client.get(f"/api/inventory/{item_id}/logs", headers=staff_headers)
    assert res.status_code == 403, f"Expected 403 for staff, got {res.status_code}: {res.text}"
    print("  -> PASSED: Staff correctly blocked from stock movement history (403 Forbidden).")

    # TEST 2: Owner can access GET /api/inventory/{item_id}/logs
    print("\n[TEST 2] Owner access to GET /api/inventory/{item_id}/logs")
    res = client.get(f"/api/inventory/{item_id}/logs", headers=owner_headers)
    assert res.status_code == 200, f"Expected 200 for owner, got {res.status_code}: {res.text}"
    print("  -> PASSED: Owner allowed to view stock movement history (200 OK).")

    # TEST 3: Staff 403 Forbidden on GET /api/activities (Confidentiality Filter)
    print("\n[TEST 3] Staff 403 Forbidden on GET /api/activities")
    res = client.get("/api/activities", headers=staff_headers)
    assert res.status_code == 403, f"Expected 403 for staff on activities, got {res.status_code}: {res.text}"
    print("  -> PASSED: Staff blocked from recovering movement logs via activity history (403 Forbidden).")

    # TEST 4: Cost Confidentiality on GET /api/inventory
    print("\n[TEST 4] Cost Confidentiality: unit_price hidden from Staff, preserved for Owner")
    res_staff = client.get("/api/inventory", headers=staff_headers)
    assert res_staff.status_code == 200
    staff_items = res_staff.json()
    item_for_staff = next((i for i in staff_items if i.get("item_id") == item_id or i.get("id") == item_id), None)
    assert item_for_staff is not None, "Test item not returned in staff inventory list"
    assert item_for_staff.get("unit_price") is None, f"Staff should receive null unit_price, got: {item_for_staff.get('unit_price')}"
    assert float(item_for_staff.get("retail_price") or 0) == 750.00, "Staff must retain visibility of retail_price for sales"

    res_owner = client.get("/api/inventory", headers=owner_headers)
    assert res_owner.status_code == 200
    owner_items = res_owner.json()
    item_for_owner = next((i for i in owner_items if i.get("item_id") == item_id or i.get("id") == item_id), None)
    assert item_for_owner is not None
    assert float(item_for_owner.get("unit_price") or 0) == 450.00, f"Owner must receive true unit_price, got: {item_for_owner.get('unit_price')}"
    print("  -> PASSED: Purchase costs (unit_price) strictly stripped for Staff; retail_price preserved.")

    # TEST 5: Normal Restock by Staff (No override required)
    print("\n[TEST 5] Normal Restock by Staff succeeds without override")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 25.0,
        "action": "restock",
        "reason": "Supplier shipment received"
    }, headers=staff_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert float(data["new_stock"]) == 125.0, f"Expected 125.0, got {data['new_stock']}"
    print("  -> PASSED: Normal restock (+25) succeeded with standard staff permission.")

    # TEST 6: Normal Usage by Staff (No override required, within stock)
    print("\n[TEST 6] Normal Actual Usage by Staff succeeds without override")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 15.0,
        "action": "use_stock",
        "reason": "Routine shoe upper cleaning"
    }, headers=staff_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert float(data["new_stock"]) == 110.0, f"Expected 110.0, got {data['new_stock']}"
    print("  -> PASSED: Normal usage (-15) succeeded with standard staff permission.")

    # TEST 7: Excessive Deduction Rejected (Insufficient physical stock)
    print("\n[TEST 7] Excessive Deduction Rejected with HTTP 400")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 99999.0,
        "action": "use_stock",
        "reason": "Accidental bulk deduction"
    }, headers=staff_headers)
    assert res.status_code == 400, f"Expected 400 for insufficient stock, got {res.status_code}: {res.text}"
    print("  -> PASSED: Excessive deduction rejected (Insufficient stock).")

    # TEST 8: Excessive Deduction Rejected even with Owner Override
    print("\n[TEST 8] Excessive Deduction Rejected even when Owner credentials / auth code supplied")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 99999.0,
        "action": "use_stock",
        "reason": "Attempted override of physical stock reality",
        "authorization_code": "SECURE-CODE-2026"
    }, headers=staff_headers)
    assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
    print("  -> PASSED: Owner authorization cannot bypass physical stock reality.")

    # TEST 9: Manual set_balance by Staff without Owner Authorization is REJECTED
    print("\n[TEST 9] Manual set_balance without Owner Authorization rejected with HTTP 403")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 80.0,
        "action": "set_balance",
        "reason": "Physical count recount"
    }, headers=staff_headers)
    assert res.status_code == 403, f"Expected 403 for unauthorized set_balance, got {res.status_code}: {res.text}"
    assert "Owner authorization required" in res.text, f"Expected 'Owner authorization required' error, got: {res.text}"
    print("  -> PASSED: Staff set_balance without authorization blocked (403 Forbidden).")

    # TEST 10: Manual set_balance with Mandatory Reason Validation
    print("\n[TEST 10] Manual set_balance with missing or empty reason rejected with HTTP 400")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 80.0,
        "action": "set_balance",
        "reason": "   ",
        "authorization_code": "SECURE-CODE-2026"
    }, headers=staff_headers)
    assert res.status_code == 400, f"Expected 400 for blank reason, got {res.status_code}: {res.text}"
    assert "mandatory reason" in res.text.lower(), f"Expected mandatory reason message, got: {res.text}"
    print("  -> PASSED: Empty reason correctly rejected.")

    # TEST 11: Manual set_balance with Negative Stock Rejected
    print("\n[TEST 11] Manual set_balance with negative balance rejected with HTTP 400")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": -5.0,
        "action": "set_balance",
        "reason": "Invalid negative adjustment",
        "authorization_code": "SECURE-CODE-2026"
    }, headers=staff_headers)
    assert res.status_code == 400, f"Expected 400 for negative balance, got {res.status_code}: {res.text}"
    print("  -> PASSED: Negative proposed balance rejected.")

    # TEST 12: Manual set_balance by Staff with Method B (Store Authorization Code)
    print("\n[TEST 12] Staff set_balance with Store Authorization Code (Method B)")
    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 85.0,
        "action": "set_balance",
        "reason": "Periodic physical count reconciliation",
        "authorization_code": "SECURE-CODE-2026"
    }, headers=staff_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert float(data["new_stock"]) == 85.0, f"Expected 85.0, got {data['new_stock']}"
    print("  -> PASSED: Staff set_balance succeeded with valid Store Authorization Code.")

    # TEST 13: Manual set_balance by Staff with Method A (Owner Credentials)
    print("\n[TEST 13] Staff set_balance with Owner Credentials (Method A)")
    # Ensure owner has known password
    import bcrypt
    owner_user.password_hash = bcrypt.hashpw(b"@Owner123", bcrypt.gensalt()).decode("utf-8")
    db.commit()

    res = client.post("/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 90.0,
        "action": "set_balance",
        "reason": "Manager-supervised reconciliation",
        "authorizer_username": owner_user.username,
        "authorizer_password": "@Owner123"
    }, headers=staff_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert float(data["new_stock"]) == 90.0, f"Expected 90.0, got {data['new_stock']}"
    print("  -> PASSED: Staff set_balance succeeded with verified Owner credentials.")

    # TEST 14: Performer and Authorizer Auditing in Database
    print("\n[TEST 14] Verification of performed_by and authorized_by in InventoryLog & AuditLog")
    db_logs = db.query(models.InventoryLog).filter(
        models.InventoryLog.item_id == item_id,
        models.InventoryLog.action_type == "set_balance"
    ).order_by(models.InventoryLog.log_id.desc()).all()
    assert len(db_logs) >= 2, "Expected at least 2 set_balance logs"

    # Latest was Method A
    latest_log = db_logs[0]
    assert latest_log.user_id == test_staff.user_id, f"Expected user_id={test_staff.user_id}, got {latest_log.user_id}"
    assert latest_log.authorized_by == owner_user.username, f"Expected authorized_by={owner_user.username}, got {latest_log.authorized_by}"

    # Previous was Method B
    prev_log = db_logs[1]
    assert prev_log.user_id == test_staff.user_id, f"Expected user_id={test_staff.user_id}, got {prev_log.user_id}"
    assert "Authorization Code" in (prev_log.authorized_by or ""), f"Expected Auth Code in authorized_by, got {prev_log.authorized_by}"

    # Check AuditLog
    audit_entry = db.query(models.AuditLog).filter(
        models.AuditLog.action == "SET_BALANCE"
    ).order_by(models.AuditLog.log_id.desc()).first()
    assert audit_entry is not None, "AuditLog entry for SET_BALANCE not found"
    assert audit_entry.username == test_staff.username
    assert "Authorized by" in audit_entry.details
    print("  -> PASSED: Dual-actor accountability recorded: performed_by and authorized_by present in both logs.")

    # TEST 15: Master Data Operations Restricted to Owner / Admin
    print("\n[TEST 15] Master Data Operations (Create, Update, Deactivate) restricted to Owner/Admin")
    # Staff attempts create item
    res_create = client.post("/api/inventory", json={
        "item_name": "Unauthorized Staff Item",
        "stock_quantity": 10.0,
        "unit": "Pcs",
        "unit_price": 50.0
    }, headers=staff_headers)
    assert res_create.status_code == 403, f"Expected 403 for staff create item, got {res_create.status_code}"

    # Staff attempts update item
    res_update = client.put(f"/api/inventory/{item_id}", json={
        "unit_price": 100.0
    }, headers=staff_headers)
    assert res_update.status_code == 403, f"Expected 403 for staff update item, got {res_update.status_code}"

    # Staff attempts delete / deactivate item
    res_delete = client.delete(f"/api/inventory/{item_id}", headers=staff_headers)
    assert res_delete.status_code == 403, f"Expected 403 for staff delete item, got {res_delete.status_code}"
    print("  -> PASSED: Master data creation, editing, and deactivation strictly 403 for Staff.")

    # TEST 16: Immutability of Historical Movement Records
    print("\n[TEST 16] Historical Movement Records are immutable (no PUT/DELETE endpoints)")
    # InventoryLog has no modification API route
    res_put_log = client.put(f"/api/inventory/{item_id}/logs/{latest_log.log_id}", json={"change_amount": 999}, headers=owner_headers)
    assert res_put_log.status_code in [404, 405], f"Expected 404/405 for immutable logs, got {res_put_log.status_code}"

    res_del_log = client.delete(f"/api/inventory/{item_id}/logs/{latest_log.log_id}", headers=owner_headers)
    assert res_del_log.status_code in [404, 405], f"Expected 404/405 for immutable logs, got {res_del_log.status_code}"
    print("  -> PASSED: InventoryLog records are append-only and strictly immutable.")

    print("\n" + "=" * 70)
    print("ALL 16 INVENTORY OVERRIDE & CONFIDENTIALITY SECURITY TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_all_tests()
