import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def view_data():
    load_dotenv(os.path.join('backend', '.env'))
    db_url = os.getenv("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    if not db_url:
        db_url = "sqlite:///./backend/shoelotskey.db"
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("\n=== PAYMENTS ===")
        res = conn.execute(text("SELECT order_id, amount_received, balance FROM payments")).fetchall()
        for r in res: print(r)
        
        print("\n=== DELIVERIES ===")
        res = conn.execute(text("SELECT order_id, pref_id, city FROM deliveries")).fetchall()
        for r in res: print(r)

if __name__ == "__main__":
    view_data()
