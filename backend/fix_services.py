from database import SessionLocal
from models import Service

def fix_services():
    db = SessionLocal()
    try:
        # 1. Base Services: Keep only 4 (Basic Cleaning, Minor Reglue, Full Reglue, Color Renewal)
        # Deep Cleaning is to be removed/deactivated
        deep_cleaning = db.query(Service).filter(Service.service_name == "Deep Cleaning").first()
        if deep_cleaning:
            print(f"Removing Deep Cleaning (ID: {deep_cleaning.service_id})")
            db.query(Service).filter(Service.service_id == deep_cleaning.service_id).delete()

        # 2. Add-ons: Must have Midsole, Undersole, and Others
        required_addons = [
            {"name": "Midsole", "price": 150, "code": "MID"},
            {"name": "Undersole", "price": 150, "code": "UND"},
            {"name": "Others", "price": 0, "code": "OTH"}
        ]
        
        for addon in required_addons:
            exists = db.query(Service).filter(Service.service_name == addon["name"], Service.category == 'addon').first()
            if not exists:
                print(f"Adding Add-on: {addon['name']}")
                new_addon = Service(
                    service_name=addon["name"],
                    base_price=addon["price"],
                    category="addon",
                    duration_days=0,
                    service_code=addon["code"],
                    is_active=True
                )
                db.add(new_addon)
            else:
                print(f"Add-on {addon['name']} already exists.")
                exists.is_active = True # Ensure it's active

        # 3. Priority Fees: Only Rush Fee for Basic Cleaning active. Minor and Full Reglue inactive.
        priority_fees = [
            {"name": "Rush Fee (Basic Cleaning)", "price": 150, "code": "RFC", "active": True},
            {"name": "Rush Fee (Minor Reglue)", "price": 250, "code": "RFR_MIN", "active": False},
            {"name": "Rush Fee (Full Reglue)", "price": 250, "code": "RFR_FULL", "active": False},
        ]

        for pf in priority_fees:
            # Check by name
            exists = db.query(Service).filter(Service.service_name == pf["name"], Service.category == 'priority').first()
            if not exists:
                print(f"Adding Priority Fee: {pf['name']}")
                new_pf = Service(
                    service_name=pf["name"],
                    base_price=pf["price"],
                    category="priority",
                    duration_days=-1, # Typical reduction
                    service_code=pf["code"],
                    is_active=pf["active"]
                )
                db.add(new_pf)
            else:
                print(f"Updating Priority Fee: {pf['name']} to active={pf['active']}")
                exists.is_active = pf["active"]
                exists.base_price = pf["price"]

        db.commit()
        print("Database services fixed successfully!")
        
        # Verify the list
        all_services = db.query(Service).all()
        print("\nFINAL SERVICES LIST:")
        for s in all_services:
            print(f"[{s.category.upper()}] {s.service_name} | Price: {s.base_price} | Active: {s.is_active}")

    except Exception as e:
        db.rollback()
        print(f"Error fixing services: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_services()
