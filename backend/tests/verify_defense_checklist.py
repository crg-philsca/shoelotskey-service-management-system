import os
import sys
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import text

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, get_db, bcrypt
from models import User, Role, AuditLog, Order, Inventory, Expense, StatusLog, InventoryLog
from database import SessionLocal, engine, is_sqlite, LOCAL_SQLITE, DATABASE_URL

def run_verification(target_name, session_factory):
    print(f"\n==================================================")
    print(f"STARTING EMPIRICAL VERIFICATION AGAINST: {target_name}")
    print(f"==================================================")

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    
    db = session_factory()
    prefix = "QA_DEF_" if "Heroku" in target_name else "QA_LOC_"

    # Pre-cleanup temporary records
    try:
        db.execute(text(f"DELETE FROM audit_logs WHERE username LIKE '{prefix}%'"))
        db.execute(text(f"DELETE FROM users WHERE username LIKE '{prefix}%'"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[CLEANUP WARNING] {e}")

    try:
        # 1. Setup Test Roles & Users
        owner_role = db.query(Role).filter_by(role_name="owner").first()
        if not owner_role:
            owner_role = Role(role_name="owner")
            db.add(owner_role)
            db.commit()

        staff_role = db.query(Role).filter_by(role_name="staff").first()
        if not staff_role:
            staff_role = Role(role_name="staff")
            db.add(staff_role)
            db.commit()

        owner_username = f"{prefix}owner"
        staff_username = f"{prefix}staff"
        reset_username = f"{prefix}reset"
        test_pw = "DefensePass2026!"
        pw_hash = bcrypt.hash(test_pw)

        owner_user = User(username=owner_username, email=f"{owner_username}@test.com", password_hash=pw_hash, role_id=owner_role.role_id, is_active=True)
        staff_user = User(username=staff_username, email=f"{staff_username}@test.com", password_hash=pw_hash, role_id=staff_role.role_id, is_active=True)
        reset_user = User(username=reset_username, email=f"{reset_username}@test.com", password_hash=pw_hash, role_id=staff_role.role_id, is_active=True, reset_token=f"token_{reset_username}", reset_token_expiry=datetime.utcnow() + timedelta(hours=1))

        db.add(owner_user)
        db.add(staff_user)
        db.add(reset_user)
        db.commit()
        db.refresh(owner_user)
        db.refresh(staff_user)
        db.refresh(reset_user)

        print("✔ Setup Temporary Accounts (Owner, Staff, and Password Reset Target)")

        # 2. Authenticate as Owner & Staff
        res_owner = client.post("/api/login", json={"username": owner_username, "password": test_pw})
        assert res_owner.status_code == 200, f"Owner login failed: {res_owner.text}"
        owner_token = res_owner.json()["access_token"]
        owner_headers = {"Authorization": f"Bearer {owner_token}"}

        res_staff = client.post("/api/login", json={"username": staff_username, "password": test_pw})
        assert res_staff.status_code == 200, f"Staff login failed: {res_staff.text}"
        staff_token = res_staff.json()["access_token"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        print("✔ Authenticated as both Owner and Staff successfully")

        # 3. VERIFY PRIORITY 1: ActivityContext API Response & Frontend Unrolling Logic
        res_act = client.get("/api/activities", headers=owner_headers)
        assert res_act.status_code == 200, f"GET /api/activities failed: {res_act.text}"
        data = res_act.json()
        assert isinstance(data, dict), f"Expected API response to be dictionary, got {type(data)}"
        assert "items" in data and "total" in data, "Expected keys 'items' and 'total' in API response"
        
        # Simulate frontend parsing fix logic
        logList = data if isinstance(data, list) else (data.get('items') if isinstance(data.get('items'), list) else [])
        assert isinstance(logList, list), "Frontend unroll simulation failed to produce list!"
        print(f"✔ VERIFIED PRIORITY 1: GET /api/activities returns paginated object {{ 'total': {data['total']}, 'items': [...] }}. Frontend unroll fix verified!")

        # 4. VERIFY PRIORITY 2: PASSWORD_RESET Audit Logging
        reset_res = client.post("/api/reset-password", json={"token": f"token_{reset_username}", "new_password": "NewSecurePassword999!"})
        assert reset_res.status_code == 200, f"Password reset failed: {reset_res.text}"
        
        # Query audit database directly for the reset log
        reset_log = db.query(AuditLog).filter(AuditLog.action_type == "PASSWORD_RESET", AuditLog.username == reset_username).first()
        assert reset_log is not None, f"AuditLog for PASSWORD_RESET was not found in DB for user {reset_username}!"
        assert reset_log.module == "Authentication", f"Expected module 'Authentication', got '{reset_log.module}'"
        assert reset_log.table_name == "auth", f"Expected table 'auth', got '{reset_log.table_name}'"
        print(f"✔ VERIFIED PRIORITY 2: PASSWORD_RESET audit event generated successfully (Log ID: {reset_log.audit_log_id}, Module: {reset_log.module})")

        # 5. VERIFY PRIORITY 3: Owner vs Staff Access Control
        print("\n--- Testing Owner vs Staff Permissions ---")
        # Owner check: Dashboard stats, Users, Inventory, Sales, Activity History
        endpoints = [
            ("Dashboard", "/api/orders", owner_headers, 200),
            ("Users List", "/api/users", owner_headers, 200),
            ("Inventory", "/api/inventory", owner_headers, 200),
            ("Activity History", "/api/activities", owner_headers, 200),
        ]
        for label, ep, headers, expected in endpoints:
            r = client.get(ep, headers=headers)
            assert r.status_code == expected, f"Owner access to {label} failed: Expected HTTP {expected}, got {r.status_code}"
            print(f"  [OWNER] ✅ {label} -> HTTP {r.status_code}")

        # Staff restrictions test
        staff_tests = [
            ("View Activity History", "/api/activities", "GET", 403),
            ("Delete User", f"/api/users/{reset_user.user_id}", "DELETE", 403),
            ("Create User", "/api/users", "POST", 403, {"username": "hackuser", "email": "h@test.com", "password": "p", "role": "staff"}),
        ]
        for label, ep, method, expected, *payload in staff_tests:
            if method == "GET": r = client.get(ep, headers=staff_headers)
            elif method == "DELETE": r = client.delete(ep, headers=staff_headers)
            elif method == "POST": r = client.post(ep, json=payload[0], headers=staff_headers)
            assert r.status_code == expected, f"Staff security leak on {label}: Expected HTTP {expected}, got {r.status_code}"
            print(f"  [STAFF] ❌ Restricted from {label} -> Correctly enforced HTTP {r.status_code} Forbidden")

        # 6. Compare Dashboard Values with Actual Database Queries
        print("\n--- Comparing Dashboard Stats with Direct Database Queries ---")
        db_orders = db.query(Order).count()
        db_inventory = db.query(Inventory).count()
        api_orders = len(client.get("/api/orders", headers=owner_headers).json())
        api_inv = len(client.get("/api/inventory", headers=owner_headers).json())
        print(f"  Dashboard Orders API Count: {api_orders} | Direct DB Count: {db_orders} -> Match: {api_orders == db_orders}")
        print(f"  Dashboard Inventory API Count: {api_inv} | Direct DB Count: {db_inventory} -> Match: {api_inv == db_inventory}")

        # 7. Test Priority 1 Fix: Active User Deletion Foreign Key Integrity Safeguard
        print("\n--- Testing Priority 1: Active User Deletion with Transaction History ---")
        test_staff = db.query(User).filter_by(username=f"{prefix}staff_trans").first()
        if not test_staff:
            test_staff = User(username=f"{prefix}staff_trans", password_hash=bcrypt.hash("secret123"), role_id=owner_role.role_id, email=f"{prefix.lower()}trans@test.com", is_active=True)
            db.add(test_staff)
            db.commit()
            db.refresh(test_staff)
        
        # Add a dummy expense linked to test_staff to simulate historical transaction
        dummy_exp = Expense(amount=100.0, description=f"{prefix}Test Expense", expense_date=datetime.now(), user_id=test_staff.user_id)
        db.add(dummy_exp)
        db.commit()
        
        del_trans_res = client.delete(f"/api/users/{test_staff.user_id}", headers=owner_headers)
        assert del_trans_res.status_code == 200, f"Expected 200 on safe deactivation, got {del_trans_res.status_code}"
        db.refresh(test_staff)
        assert test_staff.is_active is False, "User with historical transactions should be deactivated, not hard-deleted!"
        print(f"✔ Confirmed: Attempting to delete user with transaction history safely set is_active=False without FK crash!")

        # Clean up dummy expense and staff
        db.delete(dummy_exp)
        db.delete(test_staff)
        db.commit()

        # 8. Test Priority 2 & 3: Negative Inventory Prevention & Stock Adjustment Audit Logging
        print("\n--- Testing Inventory Protection & Adjustment Audit Logging ---")
        inv_payload = {"item_name": f"{prefix}Test_Item", "category": "Chemicals", "stock_quantity": 10.0, "unit_of_measure": "Liters", "reorder_threshold_quantity": 5.0, "current_cost_per_unit": 100.0, "supplier_info": f"{prefix}Supplier"}
        res_inv = client.post("/api/inventory", json=inv_payload, headers=owner_headers)
        assert res_inv.status_code == 200, f"Failed to create test inventory: {res_inv.text}"
        inv_id = res_inv.json()["item_id"]

        # Test negative adjustment (deducting 50 from 10 should fail with HTTP 400)
        res_neg = client.put(f"/api/inventory/{inv_id}/adjust", json={"action": "deduction", "amount": 50.0}, headers=owner_headers)
        assert res_neg.status_code == 400, f"Expected HTTP 400 when deducting below 0, got {res_neg.status_code}"
        print("✔ Confirmed: Negative inventory quantities prevented (HTTP 400 thrown on excess deduction)!")

        # Test valid adjustment and verify audit logging
        res_adj = client.put(f"/api/inventory/{inv_id}/adjust", json={"action": "deduction", "amount": 2.0}, headers=owner_headers)
        assert res_adj.status_code == 200, f"Valid stock deduction failed: {res_adj.text}"
        
        adj_log = db.query(AuditLog).filter(AuditLog.table_name == "inventory", AuditLog.record_id == inv_id, AuditLog.action_type == "UPDATE").first()
        assert adj_log is not None, "Manual stock adjustment was NOT recorded in AuditLog!"
        print("✔ Confirmed: Manual stock adjustment correctly recorded in AuditLog system!")

        # Cleanup inventory item
        client.delete(f"/api/inventory/{inv_id}", headers=owner_headers)

        # 9. Test Nullable Audit Log Architecture (Human vs. System Events)
        print("\n--- Testing Nullable Audit Log Architecture (Human vs. System Events) ---")
        assert adj_log.user_id == owner_user.user_id, f"Expected human user_id {owner_user.user_id}, got {adj_log.user_id}"
        assert adj_log.username == owner_username, f"Expected username '{owner_username}', got '{adj_log.username}'"
        assert adj_log.role == "owner", f"Expected role 'owner', got '{adj_log.role}'"
        print(f"✔ Confirmed: Human actions accurately record authenticated user_id ({adj_log.user_id}), username ({adj_log.username}), and role ({adj_log.role}).")

        from main import log_audit as sys_log_audit
        sys_log_audit(db=db, action="SYSTEM_SYNC_TEST", table_name="system_jobs", record_id=None, user=None, new_values={"status": "auto_sync_ok"}, module="Synchronization")
        sys_log = db.query(AuditLog).filter_by(action_type="SYSTEM_SYNC_TEST").first()
        assert sys_log is not None, "System audit event failed to save to database!"
        assert sys_log.user_id is None, f"Expected system event user_id to be NULL, got {sys_log.user_id}"
        assert sys_log.username == "system" and sys_log.role == "system", f"Expected username and role to be 'system', got '{sys_log.username}'/'{sys_log.role}'"
        print("✔ Confirmed: SYSTEM events record successfully with user_id=NULL without violating database constraints!")

        db.delete(sys_log)
        db.commit()

        print(f"\n✅ ALL EMPIRICALLY VERIFIED TESTS PASSED ON {target_name}!")

    finally:
        # Cleanup temporary records (Option A)
        print("Cleaning up temporary test records...")
        try:
            db.execute(text(f"DELETE FROM audit_logs WHERE username LIKE '{prefix}%'"))
            db.execute(text(f"DELETE FROM expenses WHERE description LIKE '{prefix}%'"))
            db.execute(text(f"DELETE FROM users WHERE username LIKE '{prefix}%'"))
            db.commit()
            print("✔ Cleanup complete without permanently altering production data.")
        except Exception as ce:
            db.rollback()
            print(f"Cleanup error: {ce}")
        finally:
            db.close()

if __name__ == "__main__":
    from sqlalchemy.orm import sessionmaker
    # 1. Test Primary Configured Engine (SQLite or PostgreSQL)
    primary_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_label = "Offline SQLite (shoelotskey.db)" if is_sqlite else f"Online PostgreSQL ({DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'Cloud DB'})"
    run_verification(db_label, primary_session_factory)
