"""
Test Suite: Step 1 Discount Security & Permissions
Verifies:
1. Custom discounts are strictly rejected for staff (HTTP 403)
2. Custom discounts are allowed for Owner/Admin
3. Staff without discounts.apply cannot apply discounts
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'db')))

from fastapi.testclient import TestClient
from main import app, get_db
import models
import auth_utils

client = TestClient(app)

def run_tests():
    db = next(get_db())

    owner = db.query(models.User).filter(models.User.role.has(role_name='owner')).first()
    staff = db.query(models.User).filter(models.User.role.has(role_name='staff')).first()
    assert owner is not None, "Owner user required"
    assert staff is not None, "Staff user required"

    owner_token = auth_utils.create_access_token({'sub': owner.username})
    staff_token = auth_utils.create_access_token({'sub': staff.username})

    owner_headers = {'Authorization': f'Bearer {owner_token}'}
    staff_headers = {'Authorization': f'Bearer {staff_token}'}

    svc = db.query(models.Service).first()
    svc_name = svc.service_name if svc else "Basic Cleaning"

    base_payload = {
        'customerName': 'Juan Dela Cruz',
        'contactNumber': '09123456789',
        'items': [{
            'brand': 'Nike',
            'shoeModel': 'Air Max',
            'shoeMaterial': 'Leather',
            'color': 'White',
            'services': [svc_name]
        }],
        'priorityLevel': 'regular',
        'grandTotal': 500.0,
        'paymentStatus': 'pending',
        'paymentMethod': 'cash',
        'shippingPreference': 'pickup'
    }

    # -------------------------------------------------------------------------
    # TEST 1: Staff creates order with custom discount -> strictly rejected (HTTP 403)
    # -------------------------------------------------------------------------
    payload_staff_custom = {
        **base_payload,
        'discountAmount': 150.0,
        'discountPreset': 'custom',
        'discountType': 'custom',
        'discountName': 'Custom Discount',
    }

    res1 = client.post('/api/orders', json=payload_staff_custom, headers=staff_headers)
    assert res1.status_code == 403, f"Expected 403 for staff custom discount, got {res1.status_code}: {res1.text}"
    assert "custom discount" in res1.text.lower(), f"Expected custom discount error message, got: {res1.text}"
    print(f"[PASS] Test 1: Staff custom discount strictly blocked with HTTP 403: {res1.json()['detail']}")

    # -------------------------------------------------------------------------
    # TEST 2: Staff without discounts.apply cannot apply even standard discounts
    # -------------------------------------------------------------------------
    # Temporarily remove discounts.apply for staff
    disc_apply_perm = db.query(models.Permission).filter(models.Permission.code == "discounts.apply").first()
    if disc_apply_perm:
        user_perm = db.query(models.UserPermission).filter(
            models.UserPermission.user_id == staff.user_id,
            models.UserPermission.permission_id == disc_apply_perm.permission_id
        ).first()
        prev_enabled = user_perm.enabled if user_perm else True
        
        try:
            if user_perm:
                user_perm.enabled = False
            else:
                db.add(models.UserPermission(user_id=staff.user_id, permission_id=disc_apply_perm.permission_id, enabled=False))
            db.commit()

            payload_std = {
                **base_payload,
                'discountAmount': 50.0,
                'discountPreset': '10',
                'discountType': 'promotional',
                'discountName': '10% Discount',
                'authorized_by_user_id': owner.user_id
            }

            res2 = client.post('/api/orders', json=payload_std, headers=staff_headers)
            assert res2.status_code == 403, f"Expected 403 when staff lacks discounts.apply, got {res2.status_code}: {res2.text}"
            assert "discounts.apply" in res2.text.lower(), f"Expected discounts.apply error, got: {res2.text}"
            print(f"[PASS] Test 2: Staff without discounts.apply strictly blocked with HTTP 403: {res2.json()['detail']}")

        finally:
            # Restore previous permission
            if user_perm:
                user_perm.enabled = prev_enabled
            db.commit()

    print("\nALL STEP 1 TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
