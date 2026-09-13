import os
import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_inventory_audit_trail():
    session = requests.Session()

    # 1. Authenticate as Owner
    login_res = session.post(f"{BASE_URL}/api/login", json={"username": "owner", "password": "@Owner123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[OK] Authenticated as owner via live server API", flush=True)

    test_item_name = f"Audit Trail Test Item {os.urandom(3).hex()}"

    # 2. CREATE INVENTORY ITEM
    print("\n--- Testing Inventory CREATE logging ---", flush=True)
    create_res = session.post(f"{BASE_URL}/api/inventory", json={
        "item_name": test_item_name,
        "category": "Supplies",
        "stock_quantity": 25.0,
        "unit": "Can",
        "unit_price": 150.0,
        "is_active": True,
        "package_size": 1.0,
        "package_unit": "Can",
        "low_stock_threshold": 5.0,
        "is_retail": True,
        "retail_price": 200.0,
        "auto_deduct": False
    }, headers=headers)
    assert create_res.status_code == 200, f"Create inventory failed: {create_res.text}"
    created_data = create_res.json()
    item_id = created_data["item_id"]
    print(f"[OK] Inventory item created successfully (ID: {item_id}, Name: {test_item_name})", flush=True)

    # 3. UPDATE INVENTORY ITEM
    print("\n--- Testing Inventory UPDATE logging ---", flush=True)
    update_res = session.put(f"{BASE_URL}/api/inventory/{item_id}", json={
        "item_name": f"{test_item_name} Updated",
        "unit_price": 185.0,
        "stock_quantity": 30.0,
        "low_stock_threshold": 8.0
    }, headers=headers)
    assert update_res.status_code == 200, f"Update inventory failed: {update_res.text}"
    print(f"[OK] Inventory item updated successfully", flush=True)

    # 4. RESTOCK INVENTORY ITEM (Adjustment)
    print("\n--- Testing Inventory RESTOCK adjustment logging ---", flush=True)
    restock_res = session.post(f"{BASE_URL}/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 10.0,
        "action": "restock"
    }, headers=headers)
    assert restock_res.status_code == 200, f"Restock failed: {restock_res.text}"
    print(f"[OK] Inventory item restocked successfully", flush=True)

    # 5. DEDUCT INVENTORY ITEM (Adjustment)
    print("\n--- Testing Inventory DEDUCT adjustment logging ---", flush=True)
    deduct_res = session.post(f"{BASE_URL}/api/inventory/adjust", json={
        "item_id": item_id,
        "amount": 4.0,
        "action": "deduction"
    }, headers=headers)
    assert deduct_res.status_code == 200, f"Deduct failed: {deduct_res.text}"
    print(f"[OK] Inventory item deducted successfully", flush=True)

    # 6. DELETE (SOFT-DELETE) INVENTORY ITEM
    print("\n--- Testing Inventory DELETE logging ---", flush=True)
    delete_res = session.delete(f"{BASE_URL}/api/inventory/{item_id}", headers=headers)
    assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
    print(f"[OK] Inventory item deleted successfully", flush=True)

    # 7. FETCH ACTIVITIES API WITH MODULE=Inventory
    print("\n--- Testing GET /api/activities with module filter ---", flush=True)
    time.sleep(1) # brief pause to ensure all records flushed
    act_res = session.get(f"{BASE_URL}/api/activities?module=Inventory&limit=20", headers=headers)
    assert act_res.status_code == 200, f"GET activities failed: {act_res.text}"
    act_data = act_res.json()
    items = act_data.get("items", [])
    assert len(items) >= 5, f"Expected at least 5 inventory activity items, got {len(items)}"
    
    # Filter to activities for our specific created item
    item_activities = [a for a in items if a.get("recordId") == item_id or (a.get("newValues") and a["newValues"].get("item_id") == item_id)]
    print(f"Found {len(item_activities)} audit activities for item_id={item_id}:")
    for a in item_activities:
        det = str(a.get('details') or '').encode('ascii', 'replace').decode('ascii')
        print(f" - [{a.get('actionRaw')}] {a.get('action')}: {det} (by {a.get('user')})", flush=True)

    actions_found = [a["actionRaw"] for a in item_activities]
    for exp_act in ["CREATE", "UPDATE", "RESTOCK", "DEDUCT", "DELETE"]:
        assert exp_act in actions_found, f"Expected action {exp_act} in audit activities for item {item_id}! Found: {actions_found}"

    # Check payload enrichments
    create_act = next(a for a in item_activities if a["actionRaw"] == "CREATE")
    assert create_act["newValues"]["item_name"] == test_item_name
    assert float(create_act["newValues"]["stock_quantity"]) == 25.0

    restock_act = next(a for a in item_activities if a["actionRaw"] == "RESTOCK")
    assert float(restock_act["newValues"]["amount"]) == 10.0

    deduct_act = next(a for a in item_activities if a["actionRaw"] == "DEDUCT")
    assert float(deduct_act["newValues"]["amount"]) == 4.0

    delete_act = next(a for a in item_activities if a["actionRaw"] == "DELETE")
    assert delete_act["newValues"]["soft_delete"] is True

    print("\n[SUCCESS] ALL INVENTORY CRUD & ADJUSTMENT AUDIT TRAIL CHECKS PASSED EMPIRICALLY!")

if __name__ == "__main__":
    test_inventory_audit_trail()
