
import os
import sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Path normalization for backend
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def rescue():
    # Load env from backend/.env
    env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
    load_dotenv(env_path)
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("[ERROR] DATABASE_URL not found in .env")
        return

    print(f"[RESCUE] Using DB: {db_url.split('@')[-1]}")
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    print("\n" + "="*50)
    print(" SHOELOTSKEY SMS - RESCUE MIGRATION v3.1")
    print("="*50)

    try:
        with engine.begin() as conn:
            # 1. Check PAYMENTS table
            if "payments" in inspector.get_table_names():
                print("[1/3] Verifying PAYMENTS table...")
                cols = [c['name'] for c in inspector.get_columns("payments")]
                
                # Check for method_id
                if "method_id" not in cols:
                    print(" -> Adding method_id to payments")
                    # Ensure payment_methods table exists first
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS payment_methods (
                            method_id SERIAL PRIMARY KEY,
                            method_name VARCHAR(30) UNIQUE NOT NULL
                        )
                    """))
                    conn.execute(text("INSERT INTO payment_methods (method_name) VALUES ('cash'), ('gcash'), ('bank-transfer') ON CONFLICT DO NOTHING"))
                    conn.execute(text("ALTER TABLE payments ADD COLUMN method_id INTEGER REFERENCES payment_methods(method_id)"))
                    conn.execute(text("UPDATE payments SET method_id = 1 WHERE method_id IS NULL"))

                # Check for status_id (for p_status)
                if "status_id" not in cols:
                    print(" -> Adding status_id to payments")
                    # Ensure payment_statuses table exists
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS payment_statuses (
                            p_status_id SERIAL PRIMARY KEY,
                            status_name VARCHAR(30) UNIQUE NOT NULL
                        )
                    """))
                    conn.execute(text("INSERT INTO payment_statuses (status_name) VALUES ('fully-paid'), ('downpayment'), ('pending') ON CONFLICT DO NOTHING"))
                    conn.execute(text("ALTER TABLE payments ADD COLUMN status_id INTEGER REFERENCES payment_statuses(p_status_id)"))
                    conn.execute(text("UPDATE payments SET status_id = 1 WHERE status_id IS NULL"))

                # Check for created_at
                if "created_at" not in cols:
                    print(" -> Adding created_at to payments")
                    conn.execute(text("ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))

            # 2. Check DELIVERIES table
            if "deliveries" in inspector.get_table_names():
                print("[2/3] Verifying DELIVERIES table...")
                cols = [c['name'] for c in inspector.get_columns("deliveries")]
                
                # Check for pref_id
                if "pref_id" not in cols:
                    print(" -> Adding pref_id to deliveries")
                    # Ensure shipping_preferences exists
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS shipping_preferences (
                            pref_id SERIAL PRIMARY KEY,
                            pref_name VARCHAR(30) UNIQUE NOT NULL
                        )
                    """))
                    conn.execute(text("INSERT INTO shipping_preferences (pref_name) VALUES ('pickup'), ('delivery') ON CONFLICT DO NOTHING"))
                    conn.execute(text("ALTER TABLE deliveries ADD COLUMN pref_id INTEGER REFERENCES shipping_preferences(pref_id)"))
                    conn.execute(text("UPDATE deliveries SET pref_id = 1 WHERE pref_id IS NULL"))

            # 3. Check ITEMS Table for new columns (just in case)
            if "items" in inspector.get_table_names():
                print("[3/3] Verifying ITEMS table...")
                cols = [c['name'] for c in inspector.get_columns("items")]
                needed = [
                    ("cond_scratches", "BOOLEAN DEFAULT FALSE"),
                    ("cond_yellowing", "BOOLEAN DEFAULT FALSE"),
                    ("cond_ripsholes", "BOOLEAN DEFAULT FALSE"),
                    ("cond_deepstains", "BOOLEAN DEFAULT FALSE"),
                    ("cond_soleseparation", "BOOLEAN DEFAULT FALSE"),
                    ("cond_wornout", "BOOLEAN DEFAULT FALSE")
                ]
                for col, ctype in needed:
                    if col not in cols:
                        print(f" -> Adding {col} to items")
                        conn.execute(text(f"ALTER TABLE items ADD COLUMN {col} {ctype}"))

        print("\n" + "="*50)
        print(" SUCCESS: Database Rescue Complete.")
        print("="*50 + "\n")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] Rescue failed: {e}")

if __name__ == "__main__":
    rescue()
