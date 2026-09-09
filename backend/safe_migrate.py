import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv
import sqlite3

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# 1. PostgreSQL Migration
PG_URL = os.getenv("DATABASE_URL")
if PG_URL and (PG_URL.startswith("postgresql://") or PG_URL.startswith("postgres://")):
    # SQLAlchemy requires postgresql://
    if PG_URL.startswith("postgres://"):
        PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)
        
    try:
        print("[PostgreSQL] Connecting to Cloud PostgreSQL...")
        pg_engine = create_engine(PG_URL, isolation_level="AUTOCOMMIT")
        with pg_engine.connect() as conn:
            # 1a. Add item_price to historical_items
            print("[PostgreSQL] Adding item_price to historical_items if missing...")
            try:
                conn.execute(text("ALTER TABLE historical_items ADD COLUMN item_price DECIMAL(10,2) NULL;"))
                print("[PostgreSQL] item_price added successfully.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print("[PostgreSQL] item_price already exists.")
                else:
                    print(f"[PostgreSQL] Error adding item_price: {e}")

            print("[PostgreSQL] Adding claimed_date to historical_items if missing...")
            try:
                conn.execute(text("ALTER TABLE historical_items ADD COLUMN claimed_date TIMESTAMP NULL;"))
                print("[PostgreSQL] claimed_date added successfully.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print("[PostgreSQL] claimed_date already exists.")
                else:
                    print(f"[PostgreSQL] Error adding claimed_date: {e}")

            # 1b. Fix expected_release_date -> original_estimated_release_date
            print("[PostgreSQL] Checking historical_orders expected_release_date...")
            try:
                conn.execute(text("ALTER TABLE historical_orders ALTER COLUMN expected_release_date DROP NOT NULL;"))
                print("[PostgreSQL] Dropped NOT NULL on expected_release_date.")
            except Exception as e:
                print(f"Error: {e}")
            
            try:
                conn.execute(text("ALTER TABLE historical_orders RENAME COLUMN expected_release_date TO original_estimated_release_date;"))
                print("[PostgreSQL] Renamed expected_release_date to original_estimated_release_date.")
            except Exception as e:
                print(f"Error: {e}")
            
            # Just in case it was already original_estimated_release_date but with NOT NULL
            try:
                conn.execute(text("ALTER TABLE historical_orders ALTER COLUMN original_estimated_release_date DROP NOT NULL;"))
                print("[PostgreSQL] Dropped NOT NULL on original_estimated_release_date.")
            except Exception as e:
                print(f"Error: {e}")

        print("[PostgreSQL] Migration completed.\n")
    except Exception as e:
        print(f"[PostgreSQL] Connection or Migration failed: {e}\n")

# 2. SQLite Migration
sqlite_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db', 'shoelotskey.db')
if os.path.exists(sqlite_db_path):
    try:
        print(f"[SQLite] Connecting to {sqlite_db_path}...")
        conn = sqlite3.connect(sqlite_db_path)
        cursor = conn.cursor()
        
        # 2a. Add item_price to historical_items
        cursor.execute("PRAGMA table_info(historical_items);")
        columns = [row[1] for row in cursor.fetchall()]
        if 'item_price' not in columns:
            print("[SQLite] Adding item_price to historical_items...")
            cursor.execute("ALTER TABLE historical_items ADD COLUMN item_price DECIMAL(10,2) NULL;")
        else:
            print("[SQLite] item_price already exists in historical_items.")
        if 'claimed_date' not in columns:
            print("[SQLite] Adding claimed_date to historical_items...")
            cursor.execute("ALTER TABLE historical_items ADD COLUMN claimed_date DATETIME NULL;")
        else:
            print("[SQLite] claimed_date already exists in historical_items.")
            
        # 2b. Rebuild historical_orders to fix expected_release_date NOT NULL
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='historical_orders'")
        create_stmt = cursor.fetchone()[0]
        if 'expected_release_date' in create_stmt or 'NOT NULL' in create_stmt.upper():
            print("[SQLite] Rebuilding historical_orders to fix schema mismatch and remove NOT NULL constraint...")
            cursor.execute("PRAGMA foreign_keys=off;")
            cursor.execute("BEGIN TRANSACTION;")
            
            # Rename old table
            cursor.execute("ALTER TABLE historical_orders RENAME TO historical_orders_old;")
            
            # Create new table with exact schema as models.py but with correct column name and nullable
            new_create_stmt = """
            CREATE TABLE historical_orders (
                historical_order_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                order_id VARCHAR(50) NOT NULL,
                customer_id INTEGER NOT NULL,
                branch VARCHAR(100),
                date_received DATETIME NOT NULL,
                original_estimated_release_date DATETIME,
                claimed_date DATETIME,
                completion_days INTEGER,
                total_pairs INTEGER,
                grand_total DECIMAL(10, 2) NOT NULL,
                downpayment DECIMAL(10, 2),
                balance DECIMAL(10, 2),
                priority VARCHAR(30),
                payment_method VARCHAR(50),
                sync_status VARCHAR(20),
                ocr_status VARCHAR(50),
                audit_trail JSON,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY(customer_id) REFERENCES customers (customer_id)
            );
            """
            cursor.execute(new_create_stmt)
            
            # Copy data
            # Check what columns old table had
            cursor.execute("PRAGMA table_info(historical_orders_old);")
            old_cols = [row[1] for row in cursor.fetchall()]
            
            # Build insert statement dynamically mapping expected_release_date -> original_estimated_release_date
            insert_cols = []
            select_cols = []
            for col in old_cols:
                if col == 'expected_release_date':
                    insert_cols.append('original_estimated_release_date')
                    select_cols.append(col)
                elif col in new_create_stmt:
                    insert_cols.append(col)
                    select_cols.append(col)
                    
            cursor.execute(f"INSERT INTO historical_orders ({', '.join(insert_cols)}) SELECT {', '.join(select_cols)} FROM historical_orders_old;")
            cursor.execute("DROP TABLE historical_orders_old;")
            cursor.execute("COMMIT;")
            cursor.execute("PRAGMA foreign_keys=on;")
            print("[SQLite] historical_orders rebuilt successfully.")
        else:
            print("[SQLite] historical_orders schema appears correct.")
            
        conn.commit()
        conn.close()
        print("[SQLite] Migration completed.\n")
    except Exception as e:
        print(f"[SQLite] Migration failed: {e}\n")
        try:
            conn.rollback()
        except: pass
else:
    print("[SQLite] Local DB not found.\n")

print("Migration script finished.")
