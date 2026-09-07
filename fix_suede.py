import os
import sys

# Set up the path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from db.database import SessionLocal
from models import HistoricalItem

def fix_suede_material():
    db = SessionLocal()
    try:
        items = db.query(HistoricalItem).filter(HistoricalItem.model.ilike('%suede%')).all()
        print(f"Found {len(items)} items with 'suede' in model.")
        
        count = 0
        for item in items:
            if item.model and item.model.lower() == "suede":
                item.material = "Suede"
                item.model = None
                count += 1
            elif item.model and "suede" in item.model.lower():
                item.material = "Suede"
                item.model = item.model.lower().replace("suede", "").strip()
                count += 1
                
        db.commit()
        print(f"Successfully fixed {count} historical items where Suede was marked as Model.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_suede_material()
