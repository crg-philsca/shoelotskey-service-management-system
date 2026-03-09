from database import SessionLocal
from models import Service

def list_services():
    db = SessionLocal()
    try:
        services = db.query(Service).all()
        print("CURRENT SERVICES IN DATABASE:")
        for s in services:
            print(f"ID: {s.service_id} | Name: {s.service_name} | Cat: {s.category} | Active: {s.is_active} | Price: {s.base_price}")
    finally:
        db.close()

if __name__ == "__main__":
    list_services()
