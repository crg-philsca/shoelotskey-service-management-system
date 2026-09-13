"""
Migration: Add sync_uuid, deleted_at, deleted_by to inventory table in both SQLite and PostgreSQL.
Also backfills unique fixed-format inventory numbers (INV-XXXX) and stable sync_uuids.
Non-destructive: DOES NOT DELETE ANY DATA.
"""
import os
import sys
import uuid
import sqlite3
import datetime
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "db", "shoelotskey.db")
DATABASE_URL = os.getenv("DATABASE_URL")

# Deterministic namespace for inventory sync UUIDs
INV_NAMESPACE = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")

def deterministic_uuid(name: str) -> str:
    cleaned = name.strip().lower()
    return str(uuid.uuid5(INV_NAMESPACE, cleaned))

# Item-specific mapping for exact deterministic matching
# item_id 7 = Cleaner (active), item_id 34 = CLEANER (inactive soft-deleted)
SPECIFIC_INV_MAP = {
    7: ("INV-0001", "3fa85f64-5717-4562-b3fc-2c963f660001"),
    8: ("INV-0002", "3fa85f64-5717-4562-b3fc-2c963f660002"),
    9: ("INV-0003", "3fa85f64-5717-4562-b3fc-2c963f660003"),
    10: ("INV-0004", "3fa85f64-5717-4562-b3fc-2c963f660004"),
    11: ("INV-0005", "3fa85f64-5717-4562-b3fc-2c963f660005"),
    68: ("INV-0006", "3fa85f64-5717-4562-b3fc-2c963f660006"), # Shoe Laces (SQLite)
    100: ("INV-0006", "3fa85f64-5717-4562-b3fc-2c963f660006"), # Shoe Laces (PG)
    69: ("INV-0007", "3fa85f64-5717-4562-b3fc-2c963f660007"), # Shoe Whitener
    34: ("INV-0008", "3fa85f64-5717-4562-b3fc-2c963f660008"), # CLEANER (inactive)
    67: ("INV-0009", "3fa85f64-5717-4562-b3fc-2c963f660009"), # CLEANER (PINK) (inactive)
    166: ("INV-0010", "3fa85f64-5717-4562-b3fc-2c963f660010"), # Test Cleaner XYZ (PG)
    133: ("INV-0011", "3fa85f64-5717-4562-b3fc-2c963f660011"), # test item eduardo (PG)
    134: ("INV-0012", "3fa85f64-5717-4562-b3fc-2c963f660012"), # QA CRUD Cleaner (PG)
}

def migrate_sqlite():
    print(f"\n--- Migrating SQLite at {SQLITE_PATH} ---")
    conn = sqlite3.connect(SQLITE_PATH)
    cur = conn.cursor()

    # Inspect columns
    cur.execute("PRAGMA table_info(inventory)")
    existing_cols = {row[1] for row in cur.fetchall()}

    if "sync_uuid" not in existing_cols:
        print("Adding column sync_uuid to SQLite inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN sync_uuid VARCHAR(64)")
    if "deleted_at" not in existing_cols:
        print("Adding column deleted_at to SQLite inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN deleted_at TIMESTAMP")
    if "deleted_by" not in existing_cols:
        print("Adding column deleted_by to SQLite inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN deleted_by VARCHAR(50)")

    # Fetch rows
    cur.execute("SELECT item_id, item_name, inventory_number, is_active, sync_uuid, deleted_at FROM inventory")
    rows = cur.fetchall()

    counter = 20
    for item_id, name, inv_no, is_active, sync_uid, del_at in rows:
        norm_name = (name or "").strip().lower()
        new_uuid = sync_uid or deterministic_uuid(norm_name)
        
        if item_id in SPECIFIC_INV_MAP:
            new_inv_no, new_uuid = SPECIFIC_INV_MAP[item_id]
        elif inv_no and inv_no.startswith("INV-"):
            new_inv_no = inv_no
        else:
            new_inv_no = f"INV-{counter:04d}"
            counter += 1

        new_del_at = del_at
        new_del_by = None
        if not is_active and not new_del_at:
            new_del_at = datetime.datetime.now().isoformat()
            new_del_by = "system_migration"

        cur.execute("""
            UPDATE inventory 
            SET sync_uuid = ?, inventory_number = ?, deleted_at = ?, deleted_by = COALESCE(deleted_by, ?)
            WHERE item_id = ?
        """, (new_uuid, new_inv_no, new_del_at, new_del_by, item_id))

    conn.commit()
    print("SQLite migration successfully committed.")
    
    cur.execute("SELECT item_id, item_name, inventory_number, sync_uuid, is_active, deleted_at FROM inventory")
    for r in cur.fetchall():
        print(f"SQLite Row: id={r[0]}, name={r[1]}, inv={r[2]}, sync_uuid={r[3]}, active={r[4]}, del_at={r[5]}")
    conn.close()

def migrate_postgres():
    if not DATABASE_URL:
        print("No DATABASE_URL set, skipping PostgreSQL migration.")
        return

    print("\n--- Migrating PostgreSQL ---")
    import psycopg

    clean_url = DATABASE_URL
    # Remove unsupported direct negotiation or driver wrappers if raw psycopg is used
    clean_url = clean_url.replace("postgresql+psycopg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
    if "sslnegotiation" in clean_url:
        import urllib.parse
        parsed = urllib.parse.urlparse(clean_url)
        qs = urllib.parse.parse_qs(parsed.query)
        qs.pop("sslnegotiation", None)
        new_query = urllib.parse.urlencode(qs, doseq=True)
        clean_url = urllib.parse.urlunparse(parsed._replace(query=new_query))

    conn = psycopg.connect(clean_url)
    cur = conn.cursor()

    # Check existing columns
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory'
    """)
    pg_cols = {r[0] for r in cur.fetchall()}

    if "sync_uuid" not in pg_cols:
        print("Adding column sync_uuid to PostgreSQL inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN sync_uuid VARCHAR(64)")
    if "deleted_at" not in pg_cols:
        print("Adding column deleted_at to PostgreSQL inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN deleted_at TIMESTAMP")
    if "deleted_by" not in pg_cols:
        print("Adding column deleted_by to PostgreSQL inventory...")
        cur.execute("ALTER TABLE inventory ADD COLUMN deleted_by VARCHAR(50)")

    # Fetch rows
    cur.execute("SELECT item_id, item_name, inventory_number, is_active, sync_uuid, deleted_at FROM inventory")
    rows = cur.fetchall()

    counter = 50
    for item_id, name, inv_no, is_active, sync_uid, del_at in rows:
        norm_name = (name or "").strip().lower()
        new_uuid = sync_uid or deterministic_uuid(norm_name)
        
        # Check if this item is soft-deleted in local SQLite (e.g. Shoe Laces)
        # Enforce tombstone invariant
        is_active_flag = is_active
        new_del_at = del_at
        new_del_by = None
        if norm_name in ("shoe laces", "cleaner", "cleaner (pink)") and not is_active:
            is_active_flag = False
        elif norm_name == "shoe laces":
            # Shoe Laces was soft-deleted locally in SQLite! Mirror tombstone
            is_active_flag = False
            new_del_at = del_at or datetime.datetime.now()
            new_del_by = "tombstone_reconciliation"

        if not is_active_flag and not new_del_at:
            new_del_at = datetime.datetime.now()
            new_del_by = "system_migration"

        if item_id in SPECIFIC_INV_MAP:
            new_inv_no, new_uuid = SPECIFIC_INV_MAP[item_id]
        elif inv_no and inv_no.startswith("INV-"):
            new_inv_no = inv_no
        else:
            new_inv_no = f"INV-{counter:04d}"
            counter += 1

        cur.execute("""
            UPDATE inventory 
            SET sync_uuid = %s, inventory_number = %s, is_active = %s, deleted_at = %s, deleted_by = COALESCE(deleted_by, %s)
            WHERE item_id = %s
        """, (new_uuid, new_inv_no, is_active_flag, new_del_at, new_del_by, item_id))

    conn.commit()
    print("PostgreSQL migration successfully committed.")

    cur.execute("SELECT item_id, item_name, inventory_number, sync_uuid, is_active, deleted_at FROM inventory ORDER BY item_id")
    for r in cur.fetchall():
        print(f"PostgreSQL Row: id={r[0]}, name={r[1]}, inv={r[2]}, sync_uuid={r[3]}, active={r[4]}, del_at={r[5]}")
    conn.close()

if __name__ == "__main__":
    migrate_sqlite()
    try:
        migrate_postgres()
    except Exception as e:
        print(f"Error migrating PostgreSQL: {e}")
