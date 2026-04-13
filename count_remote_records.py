import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def count_records():
    load_dotenv(os.path.join('backend', '.env'))
    db_url = os.getenv("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    if not db_url:
        db_url = "sqlite:///./backend/shoelotskey.db"
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        tables = ['orders', 'payments', 'deliveries', 'items', 'customers']
        for t in tables:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"{t}: {count}")
            except Exception as e:
                print(f"{t}: Error {e}")

if __name__ == "__main__":
    count_records()
