import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db', 'shoelotskey.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='historical_orders'")
print(cursor.fetchone()[0])
conn.close()
