import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

def check_active_db_schema():
    load_dotenv(os.path.join('backend', '.env'))
    db_url = os.getenv("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    if not db_url:
        db_url = "sqlite:///./backend/shoelotskey.db"
    
    print(f"Connecting to: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    if "orders" in inspector.get_table_names():
        columns = inspector.get_columns("orders")
        print(f"Table 'orders' has {len(columns)} columns:")
        for col in columns:
            print(f" - {col['name']} ({col['type']})")
    else:
        print("Table 'orders' not found!")

if __name__ == "__main__":
    check_active_db_schema()
