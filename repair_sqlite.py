import sqlite3
import json
import shutil
import datetime
import os

db_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\db\shoelotskey.db'
backup_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\db\shoelotskey_backup_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S') + '.db'

print(f"PHASE 3: Backing up database to {backup_path}")
shutil.copy2(db_path, backup_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Phase 1 & 2: Identify and check rows
tables_to_check = ['historical_images', 'historical_items', 'historical_predictions', 'historical_item_services']
affected = []

for table in tables_to_check:
    cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
    row = cursor.fetchone()
    if row:
        sql = row[0]
        if 'historical_orders_old' in sql or table == 'historical_item_services':
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            affected.append({"table": table, "count": count, "sql": sql})

print("\nPHASE 1 & 2: Affected Tables Data")
print(json.dumps(affected, indent=2))

# Phase 4: Repair
# Drop tables in correct order (child first)
tables_to_drop = ['historical_item_services', 'historical_predictions', 'historical_images', 'historical_items']

print("\nPHASE 4: Dropping affected historical tables")
for table in tables_to_drop:
    print(f"Dropping {table}...")
    cursor.execute(f"DROP TABLE IF EXISTS {table}")

conn.commit()
conn.close()
print("Repair completed successfully. Tables dropped.")
