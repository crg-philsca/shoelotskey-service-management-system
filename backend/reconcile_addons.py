from database import SessionLocal
from models import Service

def reconcile_addons():
    db = SessionLocal()
    try:
        # Define the "Correct" list of add-ons based on "old content" + new requirements
        correct_addons = [
            {"name": "Unyellowing", "price": 125, "code": "UNY"},
            {"name": "White Paint", "price": 150, "code": "WPT"},
            {"name": "Minor Retouch", "price": 125, "code": "MRT"},
            {"name": "Add Glue Layer", "price": 150, "code": "AGL"},
            {"name": "Minor Restoration", "price": 225, "code": "MRS"},
            {"name": "2 Colors", "price": 375, "code": "CR2"},
            {"name": "3 Colors", "price": 475, "code": "CR3"},
            {"name": "Premium Glue", "price": 1530, "code": "PMG"},
            {"name": "Midsole", "price": 150, "code": "MID"},
            {"name": "Undersole", "price": 150, "code": "UND"},
            {"name": "Others", "price": 0, "code": "OTH"}
        ]

        # Get existing add-ons
        existing_addons = db.query(Service).filter(Service.category == 'addon').all()
        existing_names = [s.service_name for s in existing_addons]

        print("--- RECONCILING ADD-ONS ---")

        # 1. Remove/Deactivate what's NOT on the correct list
        correct_names = [a["name"] for a in correct_addons]
        for s in existing_addons:
            if s.service_name not in correct_names:
                print(f"Removing/Deactivating: {s.service_name}")
                # We can delete if there are no FK constraints from items, but usually safer to delete if it's unused or deactivate.
                # Since this is a "fix" script, I'll delete to keep the UI clean if it's not on the list.
                db.delete(s)

        # 2. Add or Update what's on the correct list
        for addon in correct_addons:
            found = db.query(Service).filter(Service.service_name == addon["name"], Service.category == 'addon').first()
            if not found:
                print(f"Adding Missing Add-on: {addon['name']}")
                new_svc = Service(
                    service_name=addon["name"],
                    base_price=addon["price"],
                    category="addon",
                    duration_days=0,
                    service_code=addon["code"],
                    is_active=True
                )
                db.add(new_svc)
            else:
                print(f"Ensuring correct details for: {addon['name']}")
                found.base_price = addon["price"]
                found.is_active = True
                if not found.service_code:
                    found.service_code = addon["code"]

        db.commit()
        print("Done!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reconcile_addons()
