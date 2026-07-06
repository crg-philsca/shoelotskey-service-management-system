import os
import sys
from sqlalchemy import create_engine, MetaData, text
from dotenv import load_dotenv

# Path normalization for local dev imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
sys.path.append(backend_dir)

def sync_data():
    print("\n" + "="*60)
    print("      SHOELOTSKEY DATABASE SYNCHRONIZER: CLOUD -> LOCAL")
    print("="*60)

    # 1. Load configuration
    load_dotenv(os.path.join(backend_dir, ".env"), override=True)
    pg_url = os.getenv("DATABASE_URL")
    
    if not pg_url:
        print("[ERROR] DATABASE_URL not found in backend/.env")
        return

    if pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    # Dedicate path to the local fallback in the root directory
    sqlite_path = os.path.join(root_dir, "shoelotskey.db")
    sqlite_url = f"sqlite:///{sqlite_path}"

    print(f"[BOOT] Source: Cloud PostgreSQL ({pg_url.split('@')[-1]})")
    print(f"[BOOT] Target: Local SQLite ({sqlite_path})")

    try:
        # 2. Establish connections
        pg_engine = create_engine(pg_url)
        sqlite_engine = create_engine(sqlite_url)

        # First connection handshake
        with pg_engine.connect() as pg_conn:
            pg_conn.execute(text("SELECT 1"))
        print("[INIT] Connected to PostgreSQL (Cloud).")

        with sqlite_engine.connect() as sqlite_conn:
            sqlite_conn.execute(text("SELECT 1"))
        print("[INIT] Connected to SQLite (Local).")

        # 3. Schema Sync: Reflect PG tables & make sure they exist in SQLite
        print("[SYNC] Reflecting database tables...")
        pg_metadata = MetaData()
        pg_metadata.reflect(bind=pg_engine)
        
        # This will create tables in SQLite matching PG's structure if they don't exist
        pg_metadata.create_all(bind=sqlite_engine)
        
        # Now reflect SQLite metadata to read the actual schemas of SQLite tables
        sqlite_metadata = MetaData()
        sqlite_metadata.reflect(bind=sqlite_engine)
        print("[SYNC] Database structure mirrors verified.")

        # 3.5 [SAFETY SHIELD] Prevent overwriting unsynced local offline data
        try:
            with sqlite_engine.connect() as sqlite_conn:
                table_check = sqlite_conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'")).scalar()
                if table_check:
                    local_order_numbers = [r[0] for r in sqlite_conn.execute(text("SELECT order_number FROM orders")).fetchall()]
                else:
                    local_order_numbers = []
            
            with pg_engine.connect() as pg_conn:
                cloud_order_numbers = [r[0] for r in pg_conn.execute(text("SELECT order_number FROM orders")).fetchall()]
            
            pending_local = [num for num in local_order_numbers if num not in cloud_order_numbers and not num.startswith("HEALTH-")]
            if pending_local:
                print(f"[SYNC SAFETY] Found {len(pending_local)} offline orders in SQLite not yet synced to Cloud (e.g. {pending_local[0]}).")
                print("[SYNC SAFETY] Aborting local database rewrite to prevent data loss. Please sync offline data first.")
                return
        except Exception as safety_err:
            print(f"[SYNC SAFETY WARNING] Could not verify offline data: {safety_err}")

        # 4. Data Transfer Loop
        with sqlite_engine.begin() as sqlite_conn:
            # Disable constraints temporarily to prevent foreign key errors during wipe/rewrite
            sqlite_conn.execute(text("PRAGMA foreign_keys = OFF;"))
            
            for table_name in pg_metadata.tables.keys():
                if table_name not in sqlite_metadata.tables:
                    print(f"Skipping table '{table_name}' (not present in local SQLite)...")
                    continue
                
                print(f"Syncing table '{table_name}'...")
                pg_table = pg_metadata.tables[table_name]
                sqlite_table = sqlite_metadata.tables[table_name]
                
                # Retrieve records from Postgres
                with pg_engine.connect() as pg_conn:
                    rows = pg_conn.execute(pg_table.select()).fetchall()
                
                # Delete existing local records
                sqlite_conn.execute(text(f"DELETE FROM {table_name};"))
                
                if rows:
                    # Get the columns that actually exist in the target SQLite table
                    sqlite_cols = set(sqlite_table.columns.keys())
                    
                    # Map SQLAlchemy Row objects to dictionaries and filter out legacy columns
                    insert_data = []
                    for row in rows:
                        row_dict = dict(row._mapping)
                        # Keep only keys that exist in the target SQLite database columns
                        filtered_dict = {k: v for k, v in row_dict.items() if k in sqlite_cols}
                        insert_data.append(filtered_dict)
                    
                    # Insert the filtered records into SQLite
                    sqlite_conn.execute(sqlite_table.insert(), insert_data)
                    print(f"  -> SUCCESS: Copied {len(rows)} records.")
                else:
                    print("  -> NOTE: Table is empty.")

            # Re-enable constraints
            sqlite_conn.execute(text("PRAGMA foreign_keys = ON;"))

        print("\n" + "="*60)
        print(" SUCCESS: Local database (shoelotskey.db) is fully synchronized!")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n[FATAL ERROR] Sync crashed: {e}")
        print("="*60 + "\n")

if __name__ == "__main__":
    sync_data()
