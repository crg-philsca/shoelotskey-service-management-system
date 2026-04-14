import os
from database import SessionLocal
from models import Inventory

def seed_inventory():
    db = SessionLocal()
    
    items = [
        {"item_name": "Cleaner", "stock_quantity": 500, "category": "Chemical", "unit": "ml", "unit_price": 0, "status": "In Stock", "is_active": True},
        {"item_name": "Bleach", "stock_quantity": 350, "category": "Chemical", "unit": "ml", "unit_price": 0, "status": "In Stock", "is_active": True},
        {"item_name": "Stain Remover", "stock_quantity": 480, "category": "Chemical", "unit": "ml", "unit_price": 0, "status": "In Stock", "is_active": True},
        {"item_name": "Deodorizer", "stock_quantity": 150, "category": "Chemical", "unit": "ml", "unit_price": 0, "status": "In Stock", "is_active": True},
        {"item_name": "Leather Conditioner", "stock_quantity": 280, "category": "Chemical", "unit": "ml", "unit_price": 0, "status": "In Stock", "is_active": True},
    ]
    
    # Loop over items and see if they exist, if not, add them. If exist, maybe update stock?
    try:
        from sqlalchemy.orm import Session
        for item_data in items:
            existing = db.query(Inventory).filter(Inventory.item_name == item_data["item_name"]).first()
            if existing:
                print(f"[{item_data['item_name']}] exists, updating stock to {item_data['stock_quantity']}")
                existing.stock_quantity = item_data["stock_quantity"]
            else:
                print(f"[{item_data['item_name']}] adding to database")
                new_item = Inventory(**item_data)
                db.add(new_item)
        db.commit()
        print("Inventory seeded successfully!")
    except Exception as e:
        print(f"Error seeding inventory: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_inventory()
