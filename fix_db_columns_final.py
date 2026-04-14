import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv
from pathlib import Path

def fix_database():
    # Load .env from backend folder
    env_path = Path(__file__).parent / "backend" / ".env"
    load_dotenv(dotenv_path=env_path)
    
    url = os.getenv("DATABASE_URL")
    if not url:
        print("[ERROR] DATABASE_URL not found!")
        return

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    print(f"Connecting to: {url.split('@')[-1] if '@' in url else url}")
    engine = create_engine(url)
    inspector = inspect(engine)
    
    with engine.begin() as conn:
        # Fix ORDERS table
        if 'orders' in inspector.get_table_names():
            cols = [c['name'] for c in inspector.get_columns('orders')]
            if 'inventory_applied' not in cols:
                print(" -> Adding orders.inventory_applied")
                conn.execute(text("ALTER TABLE orders ADD COLUMN inventory_applied BOOLEAN DEFAULT FALSE"))
            if 'inventory_used' not in cols:
                print(" -> Adding orders.inventory_used")
                conn.execute(text("ALTER TABLE orders ADD COLUMN inventory_used JSONB DEFAULT '[]'::jsonb"))
        
        # Fix ITEMS table
        if 'items' in inspector.get_table_names():
            cols = [c['name'] for c in inspector.get_columns('items')]
            if 'inventory_used' not in cols:
                print(" -> Adding items.inventory_used")
                conn.execute(text("ALTER TABLE items ADD COLUMN inventory_used JSONB DEFAULT '[]'::jsonb"))

    print("\nSUCCESS: Database columns updated for PostgreSQL.")

if __name__ == "__main__":
    fix_database()
