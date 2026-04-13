import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def check_conditions():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
    db_url = os.getenv("DATABASE_URL") or "sqlite:///./backend/shoelotskey.db"
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"DATABASE_URL: {db_url}")
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT * FROM conditions;"))
            print("\nConditions in DB:")
            for row in res:
                print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_conditions()
