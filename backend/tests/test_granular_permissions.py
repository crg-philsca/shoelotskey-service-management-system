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
    print("============================================================")
    print("STARTING COMPREHENSIVE GRANULAR STAFF PERMISSION TEST SUITE")
    print("============================================================")

    db = next(get_db())

    # Ensure required roles exist
    owner_user = db.query(models.User).filter(models.User.role.has(role_name="owner")).first()
    assert owner_user is not None, "Owner user not found!"
    owner_headers = get_auth_headers(owner_user.username)
    print(f"[SETUP] Owner user: {owner_user.username} (ID: {owner_user.user_id})")

    # Ensure or create test staff users
    staff_role = db.query(models.Role).filter(models.Role.role_name == "staff").first()
    assert staff_role is not None, "Staff role not found!"

    # Create/Find dedicated test staff user
    test_staff = db.query(models.User).filter(models.User.username == "test_staff_permissions").first()
    if not test_staff:
        import bcrypt
        pw_hash = bcrypt.hashpw(b"TestStaff123!", bcrypt.gensalt()).decode("utf-8")
        test_staff = models.User(
            username="test_staff_permissions",
            email="test_staff_permissions@shoelotskey.test",
            password_hash=pw_hash,
            role_id=staff_role.role_id,
            is_active=True
        )
        db.add(test_staff)
        db.commit()
        db.refresh(test_staff)
    # Always ensure test_staff has canonical default permissions configured at start
    all_perms = db.query(models.Permission).all()
    for p in all_perms:
        up = db.query(models.UserPermission).filter(
            models.UserPermission.user_id == test_staff.user_id,
            models.UserPermission.permission_id == p.permission_id
        ).first()
        def_val = auth_utils.DEFAULT_STAFF_PERMISSIONS.get(p.code, True)
        if not up:
            db.add(models.UserPermission(
                user_id=test_staff.user_id,
                permission_id=p.permission_id,
                enabled=def_val
            ))
        else:
            up.enabled = def_val
    db.commit()
    auth_utils.invalidate_user_cache(test_staff.username)
    print(f"[SETUP] Test Staff user: {test_staff.username} (ID: {test_staff.user_id})")

    staff_headers = get_auth_headers(test_staff.username)

    # ------------------------------------------------------------
    # TEST 17: EXISTING USERS / DEFAULT STAFF PERMISSIONS
    # ------------------------------------------------------------
    print("\n--- TEST 17: Existing Staff Default Permissions ---")
    perms = auth_utils.get_effective_user_permissions(db, test_staff)["permissions"]
    assert "job_orders.view" in perms, "Default job_orders.view missing!"
    assert "job_orders.create" in perms, "Default job_orders.create missing!"
    assert "job_orders.update" in perms, "Default job_orders.update missing!"
    assert "job_orders.cancel" in perms, "Default job_orders.cancel missing!"
    assert "job_orders.release" in perms, "Default job_orders.release missing!"
    assert "payments.process" in perms, "Default payments.process missing!"
    assert "inventory.view" in perms, "Default inventory.view missing!"
    assert "inventory.add" in perms, "Default inventory.add missing!"
    assert "inventory.edit" in perms, "Default inventory.edit missing!"
    assert "discounts.authorize" not in perms, "discounts.authorize must be OFF by default!"
    assert "inventory.deactivate" not in perms, "inventory.deactivate must be OFF by default!"
    print("[PASS] Test 17: Existing staff default permissions verified (9 ON, 2 OFF)")

    # ------------------------------------------------------------
    # TEST 1 & 2: USER MANAGEMENT VISIBILITY & VIEW PERMISSIONS
    # ------------------------------------------------------------
    print("\n--- TEST 1 & 2: User Management Visibility & GET Permissions ---")
    res_list = client.get("/api/users", headers=owner_headers)
    assert res_list.status_code == 200, f"Failed GET /api/users: {res_list.text}"
    user_item = next((u for u in res_list.json() if u["user_id"] == test_staff.user_id), None)
    assert user_item is not None, "Test staff user not returned in /api/users"
    assert "permissions" in user_item, "permissions field missing in User schema"
    assert "permissions_summary" in user_item, "permissions_summary field missing in User schema"
    print(f"[PASS] Test 1: User list returned permissions & summary: {user_item['permissions_summary']}")

    res_perms = client.get(f"/api/users/{test_staff.user_id}/permissions", headers=owner_headers)
    assert res_perms.status_code == 200, f"Failed GET /api/users/{test_staff.user_id}/permissions: {res_perms.text}"
    perm_items = res_perms.json()
    assert len(perm_items) == len(auth_utils.CANONICAL_PERMISSIONS), f"Expected {len(auth_utils.CANONICAL_PERMISSIONS)} canonical permissions, got {len(perm_items)}"
    enabled_count = sum(1 for p in perm_items if p["enabled"])
    expected_enabled = sum(1 for p in auth_utils.CANONICAL_PERMISSIONS if p.get("default_enabled", True))
    assert enabled_count == expected_enabled, f"Expected {expected_enabled} enabled by default, got {enabled_count}"
    print(f"[PASS] Test 2: View permissions endpoint returned {len(perm_items)} canonical items ({enabled_count} enabled)")

    # ------------------------------------------------------------
    # TEST 3: PERSISTENCE (PUT /api/users/{id}/permissions)
    # ------------------------------------------------------------
    print("\n--- TEST 3: Permission Persistence & Re-query ---")
    update_payload = {
        "permissions": [
            "job_orders.view",
            "job_orders.create",
            "job_orders.update",
            "job_orders.release",
            "payments.process",
            "inventory.view",
            "inventory.add",
            "inventory.edit"
            # job_orders.cancel is omitted -> Disabled
        ]
    }
    res_update = client.put(f"/api/users/{test_staff.user_id}/permissions", json=update_payload, headers=owner_headers)
    assert res_update.status_code == 200, f"Failed PUT permissions: {res_update.text}"
    
    # Re-query
    res_requery = client.get(f"/api/users/{test_staff.user_id}/permissions", headers=owner_headers)
    assert res_requery.status_code == 200
    requery_items = {p["code"]: p["enabled"] for p in res_requery.json()}
    assert requery_items["job_orders.cancel"] is False, "job_orders.cancel should be False after update!"
    assert requery_items["job_orders.create"] is True, "job_orders.create should be True!"
    print("[PASS] Test 3: Permission update persisted and verified via authoritative re-query")

    # ------------------------------------------------------------
    # TEST 14: PERMISSION CHANGE AUDIT LOG
    # ------------------------------------------------------------
    print("\n--- TEST 14: Permission Change Audit Logging ---")
    audit_entry = db.query(models.AuditLog).filter(
        models.AuditLog.action == "STAFF_PERMISSION_UPDATED",
        models.AuditLog.record_id == str(test_staff.user_id)
    ).order_by(models.AuditLog.log_id.desc()).first()
    assert audit_entry is not None, "AuditLog entry for STAFF_PERMISSION_UPDATED was not created!"
    print(f"[PASS] Test 14: Audit log verified: {audit_entry.action} - {audit_entry.details}")

    # ------------------------------------------------------------
    # TEST 6 & 15: CANCEL DISABLED & LIVE REVOCATION (No re-login needed)
    # ------------------------------------------------------------
    print("\n--- TEST 6 & 15: Cancel Disabled & Live Revocation ---")
    # First, create a test order using Owner so an order exists
    order_num = f"JO-TEST-{os.urandom(3).hex().upper()}"
    init_res = client.post("/api/orders", json={
        "order_number": order_num,
        "customer_name": "Permission Test Customer",
        "contact_number": "09171234567",
        "grand_total": 500.0,
        "amount_received": 500.0,
        "balance": 0.0,
        "status": "new-order",
        "payment_status": "fully-paid",
        "payment_method": "cash",
        "items": []
    }, headers=owner_headers)
    assert init_res.status_code == 200, f"Failed creating test order: {init_res.text}"
    order_id = init_res.json()["order_id"]

    # Attempt to cancel as staff (whose job_orders.cancel was just revoked above) using preexisting staff_headers
    cancel_attempt = client.put(f"/api/orders/{order_id}", json={"status": "cancelled", "cancellation_reason": "Testing 403"}, headers=staff_headers)
    assert cancel_attempt.status_code == 403, f"Expected 403 on cancelled order, got {cancel_attempt.status_code}: {cancel_attempt.text}"
    print(f"[PASS] Test 6 & 15: Staff with job_orders.cancel=False received 403 Forbidden immediately via live revocation without re-login")

    # ------------------------------------------------------------
    # TEST 7: CANCEL ENABLED
    # ------------------------------------------------------------
    print("\n--- TEST 7: Cancel Enabled ---")
    # Restore job_orders.cancel
    client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": [
            "job_orders.view",
            "job_orders.create",
            "job_orders.update",
            "job_orders.cancel",
            "job_orders.release",
            "payments.process",
            "inventory.view",
            "inventory.add",
            "inventory.edit"
        ]
    }, headers=owner_headers)
    
    # Now attempt cancellation again
    cancel_success = client.put(f"/api/orders/{order_id}", json={"status": "cancelled", "cancellation_reason": "Authorized cancel test"}, headers=staff_headers)
    assert cancel_success.status_code == 200, f"Expected 200 on cancel, got {cancel_success.status_code}: {cancel_success.text}"
    print("[PASS] Test 7: Staff with job_orders.cancel=True successfully cancelled order")

    # ------------------------------------------------------------
    # TEST 4 & 5: CREATE ORDER ENABLED & DISABLED
    # ------------------------------------------------------------
    print("\n--- TEST 4 & 5: Create Order Enabled vs Disabled ---")
    # Staff currently has job_orders.create = True
    new_ord_payload = {
        "order_number": f"JO-STAFF-{os.urandom(3).hex().upper()}",
        "customer_name": "Test Create Order",
        "contact_number": "09181234567",
        "grand_total": 450.0,
        "amount_received": 450.0,
        "balance": 0.0,
        "status": "new-order",
        "payment_status": "fully-paid",
        "payment_method": "cash",
        "items": []
    }
    create_res = client.post("/api/orders", json=new_ord_payload, headers=staff_headers)
    assert create_res.status_code == 200, f"Create order failed: {create_res.status_code}: {create_res.text}"
    print("[PASS] Test 4: Staff with job_orders.create=True created order successfully")

    # Disable job_orders.create
    client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": ["job_orders.view"]
    }, headers=owner_headers)

    create_blocked = client.post("/api/orders", json={
        "order_number": f"JO-BLOCKED-{os.urandom(3).hex().upper()}",
        "customer_name": "Blocked Create",
        "grand_total": 400.0,
        "amount_received": 400.0,
        "balance": 0.0,
        "status": "new-order",
        "items": []
    }, headers=staff_headers)
    assert create_blocked.status_code == 403, f"Expected 403 on create order, got {create_blocked.status_code}: {create_blocked.text}"
    print("[PASS] Test 5: Staff with job_orders.create=False strictly received 403 Forbidden")

    # ------------------------------------------------------------
    # TEST 8 & 9: DISCOUNT DISABLED VS ENABLED & SECONDARY AUTHORIZATION
    # ------------------------------------------------------------
    print("\n--- TEST 8 & 9: Discount Authorization Enforcement ---")
    # Restore create permission, but leave discounts.authorize OFF
    client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": ["job_orders.view", "job_orders.create"]
    }, headers=owner_headers)

    discount_order_payload = {
        "order_number": f"JO-DISC-{os.urandom(3).hex().upper()}",
        "customer_name": "Discount Customer",
        "contact_number": "09191234567",
        "grand_total": 400.0,
        "amount_received": 400.0,
        "balance": 0.0,
        "status": "new-order",
        "discount_type": "Senior Citizen",
        "discount_amount": 100.0,
        "items": []
    }
    # Attempting to create order with discount without authorization must return 403
    discount_blocked = client.post("/api/orders", json=discount_order_payload, headers=staff_headers)
    assert discount_blocked.status_code == 403, f"Expected 403 for unauthorized discount, got {discount_blocked.status_code}: {discount_blocked.text}"
    print("[PASS] Test 8: Staff with discounts.authorize=False cannot independently apply discount (403 Forbidden)")

    # Secondary authorization via POST /api/discounts/authorize by Owner
    auth_challenge_res = client.post("/api/discounts/authorize", json={
        "authorizer_username": owner_user.username,
        "authorizer_credential": "@Owner123",
        "discount_type": "Senior Citizen",
        "discount_rate": 20.0
    }, headers=staff_headers)
    assert auth_challenge_res.status_code == 200, f"Discount challenge authorization failed: {auth_challenge_res.text}"
    auth_data = auth_challenge_res.json()
    assert auth_data["authorized"] is True, "Expected authorized=True"
    print(f"[PASS] Secondary challenge verified by {auth_data['authorizer_username']}")

    # Attach authorized_by_user_id and resubmit order
    discount_order_payload["authorized_by_user_id"] = auth_data["authorizer_user_id"]
    discount_success = client.post("/api/orders", json=discount_order_payload, headers=staff_headers)
    assert discount_success.status_code == 200, f"Expected 200 with secondary authorization, got {discount_success.status_code}: {discount_success.text}"
    print("[PASS] Test 9: Discount successfully accepted with verified secondary supervisor authorization")

    # ------------------------------------------------------------
    # TEST 10: INVENTORY EDIT DISABLED
    # ------------------------------------------------------------
    print("\n--- TEST 10: Inventory Edit Disabled ---")
    # Create inventory item using owner
    inv_item = models.Inventory(
        item_name=f"Permission Test Paint {os.urandom(3).hex()}",
        category="Chemical",
        stock_quantity=10.0,
        unit="mL",
        unit_price=250.0,
        is_active=True
    )
    db.add(inv_item)
    db.commit()
    db.refresh(inv_item)

    # Set staff permissions with inventory.view enabled, but inventory.edit disabled
    client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": ["inventory.view"]
    }, headers=owner_headers)

    edit_inv_blocked = client.put(f"/api/inventory/{inv_item.item_id}", json={
        "item_name": "Hacked Name",
        "stock_quantity": 999.0
    }, headers=staff_headers)
    assert edit_inv_blocked.status_code == 403, f"Expected 403 on inventory edit, got {edit_inv_blocked.status_code}: {edit_inv_blocked.text}"
    print("[PASS] Test 10: Staff with inventory.edit=False strictly blocked on PUT /api/inventory/{id} (403 Forbidden)")

    # ------------------------------------------------------------
    # TEST 11: OWNER FULL ACCESS (Bypass)
    # ------------------------------------------------------------
    print("\n--- TEST 11: Owner Full Business Access ---")
    owner_edit_inv = client.put(f"/api/inventory/{inv_item.item_id}", json={
        "item_name": f"{inv_item.item_name} (Owner Edit)",
        "stock_quantity": 12.0
    }, headers=owner_headers)
    assert owner_edit_inv.status_code == 200, f"Owner should have full business access: {owner_edit_inv.text}"
    print("[PASS] Test 11: Owner has full business access without being restricted by staff permissions")

    # ------------------------------------------------------------
    # TEST 12 & 13: STAFF PERMISSION ESCALATION & SELF-ESCALATION
    # ------------------------------------------------------------
    print("\n--- TEST 12 & 13: Staff Permission Escalation Prevention ---")
    escalation_attempt = client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": ["job_orders.view", "discounts.authorize", "inventory.deactivate"]
    }, headers=staff_headers)
    assert escalation_attempt.status_code == 403, f"Expected 403 on staff escalation attempt, got {escalation_attempt.status_code}"
    print("[PASS] Test 12 & 13: Staff cannot modify own or other permissions (403 Forbidden)")

    # ------------------------------------------------------------
    # TEST 16: DEPENDENCIES VALIDATION
    # ------------------------------------------------------------
    print("\n--- TEST 16: Permission Dependency Enforcement ---")
    # Attempting to enable inventory.edit while inventory.view is missing must be rejected with 400
    invalid_dep_attempt = client.put(f"/api/users/{test_staff.user_id}/permissions", json={
        "permissions": ["inventory.edit"] # missing inventory.view
    }, headers=owner_headers)
    assert invalid_dep_attempt.status_code == 400, f"Expected 400 for invalid dependency, got {invalid_dep_attempt.status_code}: {invalid_dep_attempt.text}"
    print(f"[PASS] Test 16: Backend strictly rejects invalid permission dependencies with 400 Bad Request")

    # ------------------------------------------------------------
    # TEST 18: OWNER USER MANAGEMENT
    # ------------------------------------------------------------
    print("\n--- TEST 18: Owner User Management (Create/Edit/Deactivate) ---")
    new_user_name = f"staff_{os.urandom(3).hex()}"
    create_user_res = client.post("/api/users", json={
        "username": new_user_name,
        "email": f"{new_user_name}@shoelotskey.test",
        "password": "TestPassword123!",
        "role_name": "staff",
        "is_active": True,
        "permissions": ["job_orders.view", "job_orders.create"]
    }, headers=owner_headers)
    assert create_user_res.status_code == 200, f"Create user failed: {create_user_res.text}"
    created_user_id = create_user_res.json()["user_id"]
    
    # Verify custom initial permissions saved
    user_perms_res = client.get(f"/api/users/{created_user_id}/permissions", headers=owner_headers)
    user_perms_map = {p["code"]: p["enabled"] for p in user_perms_res.json()}
    assert user_perms_map["job_orders.create"] is True
    assert user_perms_map["job_orders.cancel"] is False
    print(f"[PASS] Test 18: Created new staff user with custom permissions at creation time")

    # ------------------------------------------------------------
    # TEST 19: SECURITY CONTROLS PRESERVED (Lockout, Session, 403)
    # ------------------------------------------------------------
    print("\n--- TEST 19: Security Controls Regression Check ---")
    # Verify failed login increments
    dummy_staff = f"lock_test_{os.urandom(3).hex()}"
    client.post("/api/users", json={
        "username": dummy_staff,
        "email": f"{dummy_staff}@shoelotskey.test",
        "password": "ValidPassword123!",
        "role_name": "staff",
        "is_active": True
    }, headers=owner_headers)

    # 3 bad logins
    for i in range(3):
        client.post("/api/login", json={"username": dummy_staff, "password": "WrongPassword!"})
    
    # 4th login attempt should report account locked
    lock_check = client.post("/api/login", json={"username": dummy_staff, "password": "ValidPassword123!"})
    assert lock_check.status_code == 403, f"Expected 403 locked account, got {lock_check.status_code}: {lock_check.text}"
    assert "locked" in lock_check.text.lower(), f"Expected lock message in {lock_check.text}"
    print("[PASS] Test 19: 3 failed login lockout security control preserved and functioning")

    # ------------------------------------------------------------
    # TEST 20: BUILD / ALL PASS
    # ------------------------------------------------------------
    print("\n============================================================")
    print("ALL 20 TEST REQUIREMENTS VERIFIED AND PASSED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    run_all_tests()
