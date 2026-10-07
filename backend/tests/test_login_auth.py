import sys
sys.path.insert(0, 'backend')
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

tests = [
    ('owner', '@Owner123'),
    ('ownerowner', '@Owner123'),
    ('owner', '@Owner123 '),
    ('staff', '@Staff123'),
    ('admin', '@Admin123!'),
]

all_passed = True
for u, p in tests:
    res = client.post('/api/login', json={'username': u, 'password': p})
    data = res.json()
    success = res.status_code == 200 and 'access_token' in data
    print(f"[{'PASS' if success else 'FAIL'}] User: '{u}' with password '{p}' -> status {res.status_code}, role: {data.get('role')}")
    if not success:
        all_passed = False

if all_passed:
    print("\nALL LOGIN TESTS PASSED SUCCESSFULLY!")
else:
    print("\nSOME LOGIN TESTS FAILED!")
