import sqlite3
import os

db_path = r"c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\shoelotskey.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM status")
    rows = cursor.fetchall()
    print("STATUS TABLE CONTENT:")
    for row in rows:
        print(row)
    
    cursor.execute("SELECT * FROM priority_levels")
    rows = cursor.fetchall()
    print("\nPRIORITY_LEVELS TABLE CONTENT:")
    for row in rows:
        print(row)
    conn.close()
else:
    print(f"ERROR: DB not found at {db_path}")
