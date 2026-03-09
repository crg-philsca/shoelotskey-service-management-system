from database import SessionLocal
from models import Service

def list_addons():
    db = SessionLocal()
    try:
        addons = db.query(Service).filter(Service.category == 'addon').all()
        print("ADDONS_START")
        for s in addons:
            print(f"{s.service_id}|{s.service_name}|{s.base_price}")
        print("ADDONS_END")
    finally:
        db.close()

if __name__ == "__main__":
    list_addons()
