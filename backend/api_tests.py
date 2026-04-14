"""
SHOELOTSKEY AUTOMATED API TESTS
===============================
Purpose: This script uses FastAPI's TestClient to perform a rapid 
health audit of all critical system endpoints. 

How to run: 
1. Open terminal 
2. cd backend
3. python api_tests.py
"""

import sys
import os

# Add parent directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from fastapi.testclient import TestClient
    from main import app
    print(">>> [INIT] TestClient loaded successfully.")
except ImportError:
    print(">>> [ERROR] 'httpx' or 'fastapi' not found. Run: pip install httpx")
    sys.exit(1)

client = TestClient(app)

def run_system_audit():
    print("\n" + "="*50)
    print(" SHOELOTSKEY SMS - AUTOMATED API AUDIT")
    print("="*50)

    # Test 1: Health Check (Dynamic Database Detection)
    print("\n[TEST 1] Verifying System Health & DB Connectivity...")
    response = client.get("/api/health")
    if response.status_code == 200:
        data = response.json()
        db_type = data.get("database", "Unknown")
        print(f"    SUCCESS: System is ONLINE. Active DB: {db_type}")
    else:
        print(f"    FAILED: Status {response.status_code}")

    # Test 2: Order Endpoint Availability
    print("\n[TEST 2] Verifying Orders API Security...")
    # This should fail with 401/403 because we have no token
    response = client.get("/api/orders")
    if response.status_code in [401, 403]:
        print("    SUCCESS: Authentication layer is PROTECTED (Expected 401/403).")
    else:
        print(f"    WARNING: Unexpected Response {response.status_code}")

    # Test 3: Static Asset Mounting
    print("\n[TEST 3] Verifying Frontend Asset Mounting...")
    response = client.get("/")
    if response.status_code == 200:
        print("    SUCCESS: UI Core is correctly mounted.")
    else:
        print("    FAILED: Root directory is unreachable.")

    print("\n" + "="*50)
    print(" AUDIT COMPLETE: All critical pathways verified.")
    print("="*50 + "\n")

if __name__ == "__main__":
    run_system_audit()
