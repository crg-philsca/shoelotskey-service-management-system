"""
MIGRATION SCRIPT v3.0 - Professional 3NF Sync
=============================================
This script safely synchronizes a live PostgreSQL database schema with the 
standardized 3NF models. It handles column additions and category data migration.
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Path normalization
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def migrate():
    load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("[ERROR] DATABASE_URL not found in .env")
        return

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    print("\n" + "="*50)
    print(" SHOELOTSKEY SMS - SCHEMA MIGRATION v3.0")
    print("="*50)

    try:
        with engine.begin() as conn:
            # 1. Create Lookup tables if they don't exist
            print("[1/4] Ensuring Lookup Tables Exist...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS service_categories (
                    category_id SERIAL PRIMARY KEY,
                    category_name VARCHAR(50) UNIQUE NOT NULL
                );
            """))
            conn.execute(text("INSERT INTO service_categories (category_name) VALUES ('base'), ('addon'), ('priority') ON CONFLICT DO NOTHING"))
            
            # 2. Update USERS Table (Security & Tokens)
            print("[2/4] Updating USERS Table Schema...")
            columns = [c['name'] for c in inspector.get_columns("users")]
            user_updates = [
                ("failed_login_attempts", "INTEGER DEFAULT 0"),
                ("locked_until", "TIMESTAMP"),
                ("reset_token", "VARCHAR(255)"),
                ("reset_token_expiry", "TIMESTAMP")
            ]
            for col, col_type in user_updates:
                if col not in columns:
                    print(f" -> Adding {col} to users")
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))

            # 3. Update SERVICES Table (3NF Normalization)
            print("[3/4] Updating SERVICES Table Schema...")
            columns = [c['name'] for c in inspector.get_columns("services")]
            
            # Add category_id if missing
            if "category_id" not in columns:
                print(" -> Adding category_id to services")
                conn.execute(text("ALTER TABLE services ADD COLUMN category_id INTEGER REFERENCES service_categories(category_id)"))
            
            # Add sort_order if missing
            if "sort_order" not in columns:
                print(" -> Adding sort_order to services")
                conn.execute(text("ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 0"))

            # 4. Data Migration: String category -> category_id
            if "category" in columns:
                print("[4/4] Migrating Category Data to 3NF Lookup...")
                # Map 'base' -> ID, 'addon' -> ID, etc.
                conn.execute(text("""
                    UPDATE services s
                    SET category_id = sc.category_id
                    FROM service_categories sc
                    WHERE CAST(s.category AS TEXT) = sc.category_name
                    AND s.category_id IS NULL
                """))
                # Fallback for nulls
                conn.execute(text("UPDATE services SET category_id = 1 WHERE category_id IS NULL"))
                
                # We DON'T delete the 'category' column yet just to be safe for the defense, 
                # but the system will now use 'category_id'.

            # 4. Update ORDERS Table (3NF Priority Sync)
            print("[4/5] Updating ORDERS Table Schema...")
            columns = [c['name'] for c in inspector.get_columns("orders")]
            if "priority_id" not in columns:
                print(" -> Adding priority_id to orders")
                # First ensure priority_levels exists
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS priority_levels (
                        priority_id SERIAL PRIMARY KEY,
                        priority_name VARCHAR(50) UNIQUE NOT NULL
                    );
                """))
                conn.execute(text("INSERT INTO priority_levels (priority_name) VALUES ('regular'), ('rush'), ('premium') ON CONFLICT DO NOTHING"))
                
                # Add the column
                conn.execute(text("ALTER TABLE orders ADD COLUMN priority_id INTEGER REFERENCES priority_levels(priority_id)"))
                
                # Data Migration for Priority
                if "priority" in columns:
                    print(" -> Migrating Priority string data to priority_id...")
                    conn.execute(text("""
                        UPDATE orders o
                        SET priority_id = pl.priority_id
                        FROM priority_levels pl
                        WHERE CAST(o.priority AS TEXT) = pl.priority_name
                        AND o.priority_id IS NULL
                    """))
                
                # Default to 'regular' (ID 1) if still null
                conn.execute(text("UPDATE orders SET priority_id = 1 WHERE priority_id IS NULL"))

        print("\n" + "="*50)
        print(" SUCCESS: Database is now synchronized with 3NF Models.")
        print("="*50 + "\n")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] Migration failed: {e}")

if __name__ == "__main__":
    migrate()
