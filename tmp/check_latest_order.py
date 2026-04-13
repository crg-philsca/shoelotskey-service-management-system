import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def check_latest_order():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
    db_url = os.getenv("DATABASE_URL") or "sqlite:///./backend/shoelotskey.db"
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"DATABASE_URL: {db_url}")
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Get latest order
            res = conn.execute(text("SELECT order_id, order_number FROM orders ORDER BY created_at DESC LIMIT 1;"))
            order = res.fetchone()
            if not order:
                print("No orders found.")
                return
            
            order_id = order[0]
            print(f"\nOrder: {order[1]} (ID: {order_id})")
            
            # Get items
            res = conn.execute(text(f"SELECT item_id, brand, shoe_model, item_notes FROM items WHERE order_id = {order_id};"))
            items = res.fetchall()
            for item in items:
                item_id = item[0]
                print(f"  Item: {item[1]} {item[2]} (ID: {item_id}), Notes: {item[3]}")
                
                # Get conditions for this item
                res = conn.execute(text(f"""
                    SELECT c.condition_name 
                    FROM conditions c
                    JOIN item_condition_mapping icm ON c.condition_id = icm.condition_id
                    WHERE icm.item_id = {item_id};
                """))
                conditions = res.fetchall()
                print(f"    Conditions: {[c[0] for c in conditions]}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_latest_order()
