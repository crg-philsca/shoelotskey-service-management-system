import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def test_query():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
    db_url = os.getenv("DATABASE_URL") or "sqlite:///./backend/shoelotskey.db"
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"DATABASE_URL: {db_url}")
    try:
        engine = create_engine(db_url)
        with Session(engine) as db:
            from models import Condition
            
            c_map = {
                "scratches": "scratches", 
                "yellowing": "yellowing", 
                "ripsHoles": "ripsholes", 
                "deepStains": "deepstains", 
                "soleSeparation": "soleseparation", 
                "wornOut": "wornout"
            }
            
            for key, val in c_map.items():
                c_obj = db.query(Condition).filter(Condition.condition_name == val).first()
                if c_obj:
                    print(f"Match found for '{val}': ID={c_obj.condition_id}, Name='{c_obj.condition_name}'")
                else:
                    print(f"!!!! NO MATCH FOR '{val}' !!!!")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_query()
