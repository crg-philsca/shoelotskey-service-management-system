import requests
import json

BASE_URL = "http://localhost:8000"

def test_search():
    login_res = requests.post(f"{BASE_URL}/api/login", json={
        "username": "owner",
        "password": "@Owner123"
    })
    if login_res.status_code != 200:
        login_res = requests.post(f"{BASE_URL}/api/login", json={
            "username": "owner",
            "password": "owner123"
        })
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.status_code} {login_res.text}")
        return False
    
    token = login_res.json().get("access_token") or login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in successfully as owner.")

    # 2. Test queries
    test_queries = [
        "0911",
        "001",
        "Joshua",
        "Garcia",
        "Joshua Garcia"
    ]

    print("\n--- Testing Search Queries ---")
    for q in test_queries:
        res = requests.get(f"{BASE_URL}/api/orders/search", headers=headers, params={"q": q, "status_filter": "all"})
        if res.status_code == 200:
            data = res.json()
            print(f"Query '{q}': {len(data)} results found.")
            for item in data[:2]:
                print(f"   -> #{item['orderNumber']} | {item['customerName']} | Status: {item['status']}")
        else:
            print(f"Query '{q}' FAILED: {res.status_code} {res.text}")

    # 3. Test filters
    test_filters = [
        ("active", "Active Orders"),
        ("new_order", "New Order"),
        ("on_going", "On-Going"),
        ("for_release", "For Release"),
        ("claimed", "Claimed"),
        ("all", "All Orders")
    ]

    print("\n--- Testing Status Filters ---")
    for sf, label in test_filters:
        res = requests.get(f"{BASE_URL}/api/orders/search", headers=headers, params={"status_filter": sf, "limit": 10})
        if res.status_code == 200:
            data = res.json()
            print(f"Filter '{label}' ({sf}): {len(data)} results.")
            if data:
                statuses = set(item['status'] for item in data)
                print(f"   -> Observed statuses: {statuses}")
        else:
            print(f"Filter '{label}' FAILED: {res.status_code} {res.text}")

    print("\nAll verification checks completed.")
    return True

if __name__ == "__main__":
    test_search()
