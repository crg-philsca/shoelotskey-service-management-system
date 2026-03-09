
from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

def update_schema():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Checking services table...")
        try:
            # Check and add columns
            columns = [
                ("description", "TEXT NULL"),
                ("duration_days", "INT DEFAULT 0"),
                ("service_code", "VARCHAR(20) NULL")
            ]
            
            for col_name, col_type in columns:
                result = conn.execute(text(f"SHOW COLUMNS FROM services LIKE '{col_name}'"))
                if not result.fetchone():
                    print(f"Adding '{col_name}' column to services...")
                    conn.execute(text(f"ALTER TABLE services ADD COLUMN {col_name} {col_type}"))
                    print(f"Column '{col_name}' added successfully.")
            
            # Check items table for quantity
            result = conn.execute(text("SHOW COLUMNS FROM items LIKE 'quantity'"))
            if not result.fetchone():
                print("Adding 'quantity' column to items...")
                conn.execute(text("ALTER TABLE items ADD COLUMN quantity INT DEFAULT 1"))
                print("Column 'quantity' added successfully.")
                
            # Clear services to trigger re-seed
            print("Refreshing service catalog via re-seed...")
            conn.execute(text("DELETE FROM services"))
            print("Services cleared.")
        except Exception as e:
            print(f"Error updating schema: {e}")
        finally:
            conn.commit()

if __name__ == "__main__":
    update_schema()
