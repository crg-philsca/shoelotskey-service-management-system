
import sqlite3
import os

db_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\shoelotskey.db'

def check():
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {tables}")
        
        for table in tables:
            t_name = table[0]
            cursor.execute(f"PRAGMA table_info({t_name})")
            cols = [col[1] for col in cursor.fetchall()]
            print(f"Table {t_name} columns: {cols}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check()
