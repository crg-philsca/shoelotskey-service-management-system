import os
import sys
import sqlite3
import requests

BASE_URL = "http://127.0.0.1:8000"

def verify_all_data_persistence():
    session = requests.Session()

    # 1. Login
    login_res = session.post(f"{BASE_URL}/api/login", json={"username": "owner", "password": "@Owner123"})
    if login_res.status_code != 200:
        print(f"[FAIL] Login failed: {login_res.status_code} {login_res.text}")
        return
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] Authenticated as owner")

    # 2. Check Orders API
    orders_res = session.get(f"{BASE_URL}/api/orders?limit=200", headers=headers)
    orders_count = len(orders_res.json()) if orders_res.status_code == 200 else 0
    print(f"[API] Orders retrieved: {orders_count}")

    # 3. Check Services API
    services_res = session.get(f"{BASE_URL}/api/services", headers=headers)
    services_count = len(services_res.json()) if services_res.status_code == 200 else 0
    print(f"[API] Services retrieved: {services_count}")

    # 4. Check Inventory API
    inv_res = session.get(f"{BASE_URL}/api/inventory", headers=headers)
    inv_count = len(inv_res.json()) if inv_res.status_code == 200 else 0
    print(f"[API] Inventory items retrieved: {inv_count}")

    # 5. Check Expenses API
    exp_res = session.get(f"{BASE_URL}/api/expenses", headers=headers)
    exp_count = len(exp_res.json()) if exp_res.status_code == 200 else 0
    print(f"[API] Expenses retrieved: {exp_count}")

    # 6. Check Users API
    users_res = session.get(f"{BASE_URL}/api/users", headers=headers)
    users_count = len(users_res.json()) if users_res.status_code == 200 else 0
    print(f"[API] Users retrieved: {users_count}")

    # 7. Check Activities / Audit Logs API
    act_res = session.get(f"{BASE_URL}/api/activities?limit=100", headers=headers)
    act_count = len(act_res.json().get("items", [])) if act_res.status_code == 200 else 0
    print(f"[API] Activities / Audit Logs retrieved: {act_count}")

    # 8. Check Historical Records API (Admin only endpoint)
    admin_login = session.post(f"{BASE_URL}/api/login", json={"username": "admin", "password": "@Admin123"})
    if admin_login.status_code == 200:
        admin_token = admin_login.json()["access_token"]
        hist_res = session.get(f"{BASE_URL}/api/historical/orders?limit=10", headers={"Authorization": f"Bearer {admin_token}"})
        hist_total = hist_res.json().get("total", 0) if hist_res.status_code == 200 else (f"Error {hist_res.status_code}: {hist_res.text[:100]}")
    else:
        hist_total = f"Admin Login Error {admin_login.status_code}: {admin_login.text[:100]}"
    print(f"[API] Historical orders total: {hist_total}")

    # 9. Verify SQLite database directly
    sqlite_path = "backend/db/shoelotskey.db"
    if os.path.exists(sqlite_path):
        conn = sqlite3.connect(sqlite_path)
        cur = conn.cursor()
        print("\n--- Direct Local SQLite Database Verification ---")
        tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        key_tables = ['orders', 'items', 'payments', 'deliveries', 'inventory', 'expenses', 'audit_logs', 'historical_orders', 'users', 'services']
        for t in key_tables:
            if t in tables:
                cnt = cur.execute(f"SELECT COUNT(*) FROM \"{t}\"").fetchone()[0]
                print(f"  [SQLite] {t}: {cnt} rows")
            else:
                print(f"  [SQLite] {t}: MISSING TABLE")

    # 10. Check Database mode reported by health-check
    hc_res = session.get(f"{BASE_URL}/api/health-check")
    if hc_res.status_code == 200:
        print(f"\n[Health Check] {hc_res.json()}")

if __name__ == "__main__":
    verify_all_data_persistence()
