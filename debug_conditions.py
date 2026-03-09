import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database import SessionLocal
from models import Condition, Item, Order
import json

db = SessionLocal()
try:
    print("--- CONDITIONS TABLE ---")
    conds = db.query(Condition).all()
    for c in conds:
        print(f"ID: {c.condition_id}, Name: '{c.condition_name}'")

    print("\n--- RECENT ITEMS & THEIR CONDITIONS ---")
    recent_items = db.query(Item).order_by(Item.item_id.desc()).limit(5).all()
    for item in recent_items:
        print(f"Item ID: {item.item_id}, Brand: {item.brand}, Conditions: {[c.condition_name for c in item.conditions]}")
finally:
    db.close()
