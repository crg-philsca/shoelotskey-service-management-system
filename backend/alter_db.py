import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db', 'shoelotskey.db')

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE historical_items ADD COLUMN item_price DECIMAL(10, 2)")
    conn.commit()
    print("Successfully added item_price column to historical_items.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column already exists.")
    else:
        print(f"Database error: {e}")
finally:
    conn.close()
