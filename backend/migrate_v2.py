
from sqlalchemy import create_engine, text
try:
    from database import SQLALCHEMY_DATABASE_URL
except ImportError:
    SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost/shoelotskey_db"

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Migrating tables for final fields...")
        
        # Order fields
        order_cols = [
            ("reference_no", "VARCHAR(100) NULL"),
            ("shelf_location", "VARCHAR(50) NULL"),
            ("deposit_amount", "DECIMAL(10, 2) DEFAULT 0.0"),
            ("release_time", "VARCHAR(20) NULL"),
            ("province", "VARCHAR(100) NULL"),
            ("city", "VARCHAR(100) NULL"),
            ("barangay", "VARCHAR(100) NULL"),
            ("zip_code", "VARCHAR(20) NULL")
        ]
        for col_name, col_type in order_cols:
            try:
                result = conn.execute(text(f"SHOW COLUMNS FROM orders LIKE '{col_name}'"))
                if not result.fetchone():
                    conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                    print(f"Added {col_name} to orders.")
            except Exception as e: print(f"Error: {e}")

        # Item fields
        item_cols = [
            ("item_notes", "TEXT NULL"),
            ("shoe_type", "VARCHAR(50) NULL")
        ]
        for col_name, col_type in item_cols:
            try:
                result = conn.execute(text(f"SHOW COLUMNS FROM items LIKE '{col_name}'"))
                if not result.fetchone():
                    conn.execute(text(f"ALTER TABLE items ADD COLUMN {col_name} {col_type}"))
                    print(f"Added {col_name} to items.")
            except Exception as e: print(f"Error: {e}")
        
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
