import json
import urllib.request
import urllib.error

users = [
    ('owner', '@Owner123'),
    ('ownerowner', '@Owner123'),
    ('staff', '@Staff123'),
    ('admin', '@Admin123!'),
]

for u, p in users:
    req = urllib.request.Request(
        'http://localhost:8000/api/login',
        data=json.dumps({'username': u, 'password': p}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            print(f"SUCCESS: '{u}' logged in! Role: {data.get('role')}")
    except urllib.error.HTTPError as e:
        print(f"FAILED: '{u}' -> {e.code}: {e.read().decode()}")
    except Exception as ex:
        print(f"ERROR: {ex}")
