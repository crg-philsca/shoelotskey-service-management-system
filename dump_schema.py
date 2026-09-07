import sqlite3
import json

db_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\db\shoelotskey.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

result = {}
for name, sql in tables:
    result[name] = sql

with open(r'c:\Users\charm\Desktop\Shoelotskey Service Management System\sqlite_schema_dump.json', 'w') as f:
    json.dump(result, f, indent=2)
