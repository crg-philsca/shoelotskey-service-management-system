"""
Comprehensive Unit & Integration Test for the 4 Core Architectural Improvements:
1. Strict Backend API Validation (Defense-in-Depth)
2. Login IP Rate Limiting (Brute-Force Mitigation)
3. Cache Service (Redis/Memory & Invalidation)
4. Weekly ML Retraining Pipeline
"""

import sys
import os

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from pydantic import ValidationError
from schemas import OrderCreatePayloadSchema, OrderItemCreateSchema
from rate_limiter import SlidingWindowRateLimiter
from cache import InMemoryCache, CacheService
from scripts.retrain_weekly import run_weekly_retraining


def test_order_schema_rejects_empty_payload():
    """Verify empty dictionary {} is strictly rejected (preventing ORD-2026-09-19-001 scenario)."""
    try:
        OrderCreatePayloadSchema()
        assert False, "Should have raised ValidationError on empty payload"
    except ValidationError as e:
        errors = e.errors()
        field_names = [err["loc"][0] for err in errors]
        assert "customerName" in field_names
        assert "contactNumber" in field_names
        assert "grandTotal" in field_names
        print(f"[PASS] Empty payload rejection: Caught {len(errors)} missing required fields.")


def test_order_schema_rejects_zero_or_negative_grand_total():
    """Verify grand total <= 0.00 is rejected."""
    payload = {
        "customerName": "Juan Dela Cruz",
        "contactNumber": "09123456789",
        "grandTotal": 0.0,
        "items": [{"brand": "Nike", "baseService": ["Basic Cleaning"]}]
    }
    try:
        OrderCreatePayloadSchema(**payload)
        assert False, "Should have rejected 0.00 grand total"
    except ValidationError as e:
        print("[PASS] 0.00 Grand Total rejected as expected.")


def test_order_schema_rejects_missing_items():
    """Verify order with no items is rejected."""
    payload = {
        "customerName": "Juan Dela Cruz",
        "contactNumber": "09123456789",
        "grandTotal": 500.0,
        "items": []
    }
    try:
        OrderCreatePayloadSchema(**payload)
        assert False, "Should have rejected empty items list"
    except ValidationError as e:
        print("[PASS] Empty items list rejected as expected.")


def test_order_schema_accepts_valid_payload():
    """Verify valid payload passes validation cleanly."""
    payload = {
        "customerName": "Juan Dela Cruz",
        "contactNumber": "09171234567",
        "grandTotal": 450.0,
        "paymentStatus": "downpayment",
        "depositAmount": 200.0,
        "balance": 250.0,
        "items": [{
            "brand": "Adidas",
            "shoeModel": "Samba",
            "quantity": 1,
            "baseService": ["Basic Cleaning"]
        }]
    }
    order = OrderCreatePayloadSchema(**payload)
    assert order.customerName == "Juan Dela Cruz"
    assert order.grandTotal == 450.0
    assert len(order.items) == 1
    print("[PASS] Valid order payload verified successfully.")


def test_login_rate_limiter():
    """Verify rate limiter allows 5 requests and blocks request 6."""
    limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)
    test_ip = "192.168.1.100"

    # First 5 attempts should be allowed
    for i in range(5):
        allowed, retry = limiter.check(test_ip)
        assert allowed is True
        assert retry == 0

    # 6th attempt should be blocked
    allowed, retry = limiter.check(test_ip)
    assert allowed is False
    assert retry > 0
    print(f"[PASS] Rate Limiter: Request #6 blocked, retry_after={retry}s.")

    # Reset allows again
    limiter.reset(test_ip)
    allowed, retry = limiter.check(test_ip)
    assert allowed is True
    print("[PASS] Rate Limiter: Reset restored access.")


def test_cache_service():
    """Verify in-memory cache get, set, and prefix invalidation."""
    cache = InMemoryCache()
    cache.set("orders:test_1", {"orderNumber": "ORD-001"}, ttl=10)
    cache.set("orders:test_2", {"orderNumber": "ORD-002"}, ttl=10)
    cache.set("sales:daily", {"total": 5000.0}, ttl=10)

    assert cache.get("orders:test_1") == {"orderNumber": "ORD-001"}
    assert cache.get("sales:daily") == {"total": 5000.0}

    # Invalidate orders prefix
    count = cache.invalidate_prefix("orders:")
    assert count == 2
    assert cache.get("orders:test_1") is None
    assert cache.get("sales:daily") == {"total": 5000.0}
    print("[PASS] Cache Service: Set, get, and prefix invalidation verified.")


def test_weekly_retraining_dry_run():
    """Verify weekly retraining dry run runs cleanly without errors."""
    res = run_weekly_retraining(dry_run=True)
    assert "status" in res
    print(f"[PASS] Weekly Retraining Pipeline Dry Run: {res}")


if __name__ == "__main__":
    print("\n--- RUNNING ARCHITECTURAL IMPROVEMENTS TESTS ---")
    test_order_schema_rejects_empty_payload()
    test_order_schema_rejects_zero_or_negative_grand_total()
    test_order_schema_rejects_missing_items()
    test_order_schema_accepts_valid_payload()
    test_login_rate_limiter()
    test_cache_service()
    test_weekly_retraining_dry_run()
    print("\nALL ARCHITECTURAL IMPROVEMENTS TESTS PASSED SUCCESSFULLY! (6/6)\n")
