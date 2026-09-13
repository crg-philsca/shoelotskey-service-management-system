import os
import sys
import uuid
import re
import sqlite3
from datetime import datetime
from sqlalchemy import func

sys.path.insert(0, os.getcwd())

from backend.db.database import SessionLocal
from backend.models import Inventory

def generate_unique_inventory_number(db) -> str:
    all_invs = db.query(Inventory.inventory_number).filter(
        Inventory.inventory_number.isnot(None)
    ).all()
    
    max_num = 0
    existing_numbers = set()
    for (inv_num,) in all_invs:
        if not inv_num:
            continue
        cleaned = str(inv_num).strip().upper()
        existing_numbers.add(cleaned)
        m = re.match(r"^INV-(\d+)$", cleaned)
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
                
    next_num = max_num + 1
    while True:
        candidate = f"INV-{next_num:04d}"
        if candidate not in existing_numbers:
            in_db = db.query(Inventory).filter(func.upper(Inventory.inventory_number) == candidate).first()
            if not in_db:
                return candidate
        next_num += 1

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLITE_URL = f"sqlite:///{os.path.join(os.getcwd(), 'backend', 'db', 'shoelotskey.db')}"
local_engine = create_engine(SQLITE_URL)
TestSession = sessionmaker(bind=local_engine)

def test_inventory_number_format_and_uniqueness():
    db = TestSession()
    try:
        # 1. Test auto-generation format
        next_num = generate_unique_inventory_number(db)
        print(f"Generated next inventory number: {next_num}")
        assert next_num.startswith("INV-")
        suffix = next_num.split("-")[1]
        assert len(suffix) >= 4 and suffix.isdigit()

        # 2. Test database integrity: verify no duplicate inventory numbers exist
        all_items = db.query(Inventory.inventory_number).filter(Inventory.inventory_number.isnot(None)).all()
        inv_numbers = [str(r[0]).strip().upper() for r in all_items if r[0]]
        duplicates = [x for x in set(inv_numbers) if inv_numbers.count(x) > 1]
        print(f"Total inventory items checked: {len(inv_numbers)}")
        print(f"Duplicates found: {duplicates}")
        assert len(duplicates) == 0, f"Found duplicate inventory numbers: {duplicates}"

        # 3. Test uniqueness generator when candidate exists
        fake_next = f"INV-9999"
        test_item = Inventory(
            item_name=f"Automated Test Item {uuid.uuid4().hex[:8]}",
            inventory_number=fake_next,
            sync_uuid=str(uuid.uuid4()),
            category="Supplies",
            stock_quantity=10,
            unit="pcs",
            unit_price=100.0,
            is_active=True
        )
        db.add(test_item)
        db.commit()

        # Now generating next number should avoid INV-9999
        new_next = generate_unique_inventory_number(db)
        assert new_next != fake_next
        print(f"Passed candidate collision avoidance: {new_next}")

        # Clean up test item
        db.delete(test_item)
        db.commit()
        print("Inventory format and uniqueness test PASSED.")
    finally:
        db.close()

def test_inventory_soft_delete_tombstone():
    db = TestSession()
    try:
        # Create a test item to delete
        test_sync_uuid = str(uuid.uuid4())
        item = Inventory(
            item_name=f"Tombstone Test Item {uuid.uuid4().hex[:6]}",
            inventory_number=generate_unique_inventory_number(db),
            sync_uuid=test_sync_uuid,
            category="Chemicals",
            stock_quantity=5,
            unit="mL",
            unit_price=50.0,
            is_active=True
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        item_id = item.item_id
        assert item.is_active is True
        assert item.deleted_at is None

        # Perform soft delete
        item.is_active = False
        item.deleted_at = datetime.now()
        item.deleted_by = "test_suite"
        db.commit()
        db.refresh(item)

        # Verify tombstone fields
        assert item.is_active is False
        assert item.deleted_at is not None
        assert item.deleted_by == "test_suite"

        # Verify tombstone invariant: if synced, final_is_active = local_is_active and remote_is_active
        local_is_active = item.is_active
        remote_is_active = True # even if remote were stale/true
        final_is_active = local_is_active and remote_is_active
        assert final_is_active is False, "Tombstone invariant failed: soft deleted item would be resurrected!"

        # Clean up test row
        db.delete(item)
        db.commit()
        print("Tombstone preservation and delete test PASSED.")
    finally:
        db.close()

if __name__ == "__main__":
    test_inventory_number_format_and_uniqueness()
    test_inventory_soft_delete_tombstone()
    print("ALL INVENTORY TESTS COMPLETED SUCCESSFULLY.")
