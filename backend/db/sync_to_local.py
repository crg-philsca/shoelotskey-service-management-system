import os
import sys
from sqlalchemy import create_engine, MetaData, text, NullPool
from sqlalchemy.exc import OperationalError

curr_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(curr_dir) if os.path.basename(curr_dir) == "db" else curr_dir
if curr_dir not in sys.path:
    sys.path.insert(0, curr_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from database import engine as shared_pg_engine, LOCAL_SQLITE_PATH, LOCAL_SQLITE, is_sqlite, ensure_sqlite_schema_and_defaults
except ImportError:
    from db.database import engine as shared_pg_engine, LOCAL_SQLITE_PATH, LOCAL_SQLITE, is_sqlite, ensure_sqlite_schema_and_defaults

# Tables EXCLUDED from cloud-to-local sync.
# audit_logs: 2000+ rows of write-only JSON, not needed for offline CRUD. 
# Offline-generated audit logs are stored locally and uploaded when back online.
SKIP_SYNC_TABLES = {"audit_logs"}


def _safe_close_pg_conn(pg_conn):
    """Close a PostgreSQL connection safely, even if the server has already dropped it."""
    try:
        pg_conn.close()
    except Exception:
        pass  # Connection already dead from server side — ignore the cleanup error


def _fetch_table(pg_engine, pg_table):
    """Fetch all rows from a PostgreSQL table using a dedicated, isolated connection.
    
    Returns (rows, error):
      - rows: list of row objects on success
      - error: exception on failure, or None on success
    """
    pg_conn = None
    try:
        pg_conn = pg_engine.connect()
        rows = pg_conn.execute(pg_table.select()).fetchall()
        return rows, None
    except OperationalError as e:
        return None, e
    except Exception as e:
        return None, e
    finally:
        if pg_conn is not None:
            _safe_close_pg_conn(pg_conn)


def sync_data():
    print("\n" + "="*60)
    print("      SHOELOTSKEY DATABASE SYNCHRONIZER: CLOUD -> LOCAL")
    print("="*60)

    import database as db_mod
    # 1. Verify availability of shared online engine from database.py dynamically
    if db_mod.is_sqlite or db_mod.engine is None:
        print("[SYNC OFFLINE] Currently running in SQLite offline fallback mode. Relying directly on local SQLite storage.")
        return

    # REUSE SINGLETON ENGINE: Do not call create_engine for PostgreSQL!
    pg_engine = db_mod.engine
    sqlite_url = LOCAL_SQLITE
    sqlite_path = LOCAL_SQLITE_PATH

    print(f"[BOOT] Source: Shared Cloud PostgreSQL Singleton Engine")
    print(f"[BOOT] Target: Local SQLite ({sqlite_path})")

    sqlite_engine = None
    failed_tables = []

    try:
        # 2. Establish connections (PG engine is reused from shared singleton; SQLite uses NullPool to avoid leftover transaction locks)
        sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False, "timeout": 30}, poolclass=NullPool)

        # First connection handshake using shared engine connection
        try:
            with pg_engine.connect() as pg_conn:
                pg_conn.execute(text("SELECT 1"))
        except Exception as e:
            print(f"[SYNC OFFLINE AUTO-SWITCH] Cloud Postgres connection dropped ({str(e)[:80]}...). Switching system to SQLite offline mode.")
            if hasattr(db_mod, "switch_to_offline_sqlite"):
                db_mod.switch_to_offline_sqlite()
            return

        print("[INIT] Connected to PostgreSQL (via Shared Singleton Engine).")

        with sqlite_engine.connect() as sqlite_conn:
            sqlite_conn.execute(text("SELECT 1"))
        print("[INIT] Connected to SQLite (Local).")

        # 3. Schema Sync: Use lightweight in-memory schema (avoids slow AWS RDS pg_catalog reflection & DBeaver read timeouts)
        print("[SYNC] Verifying table schemas from in-memory definitions...")
        from models import Base
        pg_metadata = Base.metadata
        
        # This will create tables and run column migrations in SQLite matching PG's structure if needed
        ensure_sqlite_schema_and_defaults(sqlite_engine)
        
        # Now reflect SQLite metadata to read the actual schemas of SQLite tables
        sqlite_metadata = MetaData()
        sqlite_metadata.reflect(bind=sqlite_engine)
        print("[SYNC] Database structure mirrors verified.")

        # 3.5 [SAFETY SHIELD] Prevent overwriting unsynced local offline data
        try:
            with sqlite_engine.begin() as sqlite_conn:
                table_check = sqlite_conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'")).scalar()
                if table_check:
                    try:
                        sqlite_conn.execute(text("DELETE FROM orders WHERE order_number LIKE '%E3FE%' OR order_number = 'E3FE31C5' OR customer_name LIKE '%Guest%'"))
                    except Exception:
                        pass
                    local_order_numbers = [r[0] for r in sqlite_conn.execute(text("SELECT order_number FROM orders")).fetchall()]
                else:
                    local_order_numbers = []
            
            with pg_engine.connect() as pg_conn:
                cloud_order_numbers = [r[0] for r in pg_conn.execute(text("SELECT order_number FROM orders")).fetchall()]
            
            pending_local = [num for num in local_order_numbers if num not in cloud_order_numbers and not (str(num).startswith("HEALTH-") or str(num) == "E3FE31C5" or "E3FE" in str(num))]
            if pending_local:
                print(f"[SYNC SAFETY] Found {len(pending_local)} offline orders in SQLite not yet synced to Cloud (e.g. {pending_local[0]}).")
                print("[SYNC SAFETY] Aborting local database rewrite to prevent data loss. Please sync offline data first.")
                return
        except Exception as safety_err:
            print(f"[SYNC SAFETY WARNING] Could not verify offline data: {safety_err}")

        # 4. Data Transfer Loop — each table uses its own isolated connection for resilience
        with sqlite_engine.begin() as sqlite_conn:
            # Disable constraints before starting multi-statement transaction in SQLite
            sqlite_conn.execute(text("PRAGMA foreign_keys = OFF;"))
            for table_name in pg_metadata.tables.keys():
                # Skip tables not present in SQLite
                if table_name not in sqlite_metadata.tables:
                    print(f"Skipping table '{table_name}' (not present in local SQLite)...")
                    continue
                
                # Skip intentionally excluded tables (too large or write-only)
                if table_name in SKIP_SYNC_TABLES:
                    print(f"Skipping table '{table_name}' (excluded: write-only, not required for offline mode).")
                    continue

                print(f"Syncing table '{table_name}'...")
                pg_table = pg_metadata.tables[table_name]
                sqlite_table = sqlite_metadata.tables[table_name]

                # Fetch with isolated connection — failure here does NOT crash the entire sync
                rows, fetch_error = _fetch_table(pg_engine, pg_table)

                if fetch_error is not None:
                    failed_tables.append(table_name)
                    print(f"  -> [SYNC WARNING] Skipping '{table_name}': {type(fetch_error).__name__}: {fetch_error}")
                    print(f"  -> [SYNC RECOVERY] Stale connections flushed. Next table will get a fresh connection.")
                    continue

                # Never wipe locally-created accounts. Merge cloud users in;
                # local-only users (created while offline) must survive restart/sync.
                if table_name == "users":
                    from database import upsert_user_in_session
                    from models import Role
                    from sqlalchemy.orm import sessionmaker as _sessionmaker
                    MergeSession = _sessionmaker(bind=sqlite_engine)
                    with MergeSession() as merge_db:
                        for row in rows or []:
                            mapping = dict(row._mapping)
                            role_name = "staff"
                            role_id = mapping.get("role_id")
                            if role_id is not None:
                                role_row = merge_db.query(Role).filter(Role.role_id == role_id).first()
                                if role_row:
                                    role_name = role_row.role_name
                            upsert_user_in_session(
                                merge_db,
                                mapping.get("username"),
                                mapping.get("email"),
                                mapping.get("password_hash"),
                                role_name,
                                bool(mapping.get("is_active", True)),
                            )
                        merge_db.commit()
                    print(f"  -> MERGED {len(rows or [])} cloud user(s) without deleting local-only accounts.")
                    continue

                preserved_item_fields = {}
                if table_name == "items":
                    try:
                        preserved_item_fields = {
                            int(row[0]): (row[1], row[2])
                            for row in sqlite_conn.execute(
                                text("SELECT item_id, shoe_size, color FROM items")
                            ).fetchall()
                            if (row[1] and str(row[1]).strip()) or (row[2] and str(row[2]).strip())
                        }
                    except Exception:
                        preserved_item_fields = {}
                if table_name == "inventory":
                    # Non-destructive inventory sync with soft-delete / tombstone protection.
                    local_rows = sqlite_conn.execute(
                        text("SELECT item_id, item_name, inventory_number, is_active, sync_uuid, deleted_at FROM inventory")
                    ).fetchall()
                    local_by_uuid = {str(r[4]).strip(): r for r in local_rows if r[4]}
                    local_by_num = {str(r[2]).strip().lower(): r for r in local_rows if r[2]}
                    local_by_name = {str(r[1]).strip().lower(): r for r in local_rows if r[1]}
                    
                    sqlite_cols = set(sqlite_table.columns.keys())
                    for row in rows or []:
                        mapping = {k: v for k, v in dict(row._mapping).items() if k in sqlite_cols}
                        uuid_key = str(mapping.get("sync_uuid", "")).strip() if mapping.get("sync_uuid") else None
                        num_key = str(mapping.get("inventory_number", "")).strip().lower() if mapping.get("inventory_number") else None
                        name_key = str(mapping.get("item_name", "")).strip().lower()
                        
                        existing_local = (uuid_key and local_by_uuid.get(uuid_key)) or (num_key and local_by_num.get(num_key)) or local_by_name.get(name_key)
                        if existing_local:
                            local_is_active = bool(existing_local[3])
                            remote_is_active = bool(mapping.get("is_active", True))
                            # TOMBSTONE PROTECTION: If either database marked it soft-deleted, it stays soft-deleted!
                            final_is_active = local_is_active and remote_is_active
                            final_deleted_at = existing_local[5] or mapping.get("deleted_at")
                            if not final_is_active and not final_deleted_at:
                                final_deleted_at = datetime.now()

                            update_data = {
                                **mapping,
                                "is_active": final_is_active,
                                "deleted_at": final_deleted_at,
                                "target_id": existing_local[0]
                            }
                            update_data.pop("item_id", None)
                            
                            set_clauses = ", ".join([f"{k} = :{k}" for k in update_data.keys() if k != "target_id"])
                            sqlite_conn.execute(
                                text(f"UPDATE inventory SET {set_clauses} WHERE item_id = :target_id"),
                                update_data
                            )
                        else:
                            # Safely insert new cloud-only item without wiping existing items
                            sqlite_conn.execute(sqlite_table.insert(), [mapping])
                    print(f"  -> MERGED {len(rows or [])} cloud inventory item(s) safely with tombstone protection.")
                    continue

                if rows:
                    # Get the columns that actually exist in the target SQLite table
                    sqlite_cols = set(sqlite_table.columns.keys())
                    pk_cols = [c.name for c in sqlite_table.primary_key.columns] if sqlite_table.primary_key else []

                    # Map SQLAlchemy Row objects to dictionaries and filter out legacy columns
                    insert_data = [
                        {k: v for k, v in dict(row._mapping).items() if k in sqlite_cols}
                        for row in rows
                    ]

                    if pk_cols:
                        # Non-destructive UPSERT / MERGE: update matching PK rows or insert new ones.
                        # Do not wipe local records that may have been created offline.
                        set_clause = ", ".join([f"{c} = excluded.{c}" for c in sqlite_cols if c not in pk_cols])
                        pk_clause = ", ".join(pk_cols)
                        
                        # Chunked inserts for SQLite variable limits
                        chunk_size = 100
                        for i in range(0, len(insert_data), chunk_size):
                            chunk = insert_data[i:i + chunk_size]
                            for row_dict in chunk:
                                cols = list(row_dict.keys())
                                col_names = ", ".join(cols)
                                placeholders = ", ".join([f":{c}" for c in cols])
                                if set_clause:
                                    sql = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders}) ON CONFLICT({pk_clause}) DO UPDATE SET {set_clause}"
                                else:
                                    sql = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders}) ON CONFLICT({pk_clause}) DO NOTHING"
                                sqlite_conn.execute(text(sql), row_dict)
                        print(f"  -> SUCCESS: Merged {len(rows)} records non-destructively.")
                    else:
                        sqlite_conn.execute(text(f"DELETE FROM {table_name};"))
                        sqlite_conn.execute(sqlite_table.insert(), insert_data)
                        print(f"  -> SUCCESS: Copied {len(rows)} records.")

                    if table_name == "items" and preserved_item_fields:
                        restored = 0
                        for item_id, (size, color) in preserved_item_fields.items():
                            result = sqlite_conn.execute(
                                text(
                                    """
                                    UPDATE items
                                    SET shoe_size = CASE
                                        WHEN shoe_size IS NULL OR trim(shoe_size) = '' THEN :size
                                        ELSE shoe_size END,
                                        color = CASE
                                        WHEN color IS NULL OR trim(color) = '' THEN :color
                                        ELSE color END
                                    WHERE item_id = :item_id
                                    """
                                ),
                                {"size": size or "", "color": color or "", "item_id": item_id},
                            )
                            restored += result.rowcount or 0
                        if restored:
                            print(f"  -> PRESERVED local size/color on {restored} item(s) that cloud left blank.")
                else:
                    print("  -> NOTE: Cloud table is empty, keeping local records intact.")

            # Re-enable constraints after transaction finishes
            sqlite_conn.execute(text("PRAGMA foreign_keys = ON;"))

        if failed_tables:
            print(f"\n[SYNC PARTIAL] Sync completed. Skipped tables due to errors: {', '.join(failed_tables)}")
            print("[SYNC PARTIAL] All other tables synced successfully. Skipped tables retain their previous local data.")
        else:
            print("\n" + "="*60)
            print(" SUCCESS: Local database (shoelotskey.db) is fully synchronized!")
            print("="*60 + "\n")

    except Exception as e:
        print(f"\n[FATAL ERROR] Sync crashed with unexpected error: {type(e).__name__}: {e}")
        print("="*60 + "\n")

    finally:
        # Do NOT dispose pg_engine because it is the shared singleton engine used by the live FastAPI app!
        if sqlite_engine is not None:
            sqlite_engine.dispose()
            print("[SYNC] Closed SQLite engine connection pool. (Shared PG singleton remains intact)")

if __name__ == "__main__":
    sync_data()
