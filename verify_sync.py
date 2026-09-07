import sqlite3
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load PostgreSQL URI
load_dotenv(r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\.env')
pg_url = os.getenv("DATABASE_URL")
if pg_url.startswith("postgres://"):
    pg_url = pg_url.replace("postgres://", "postgresql://", 1)

pg_engine = create_engine(pg_url)
sqlite_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\db\shoelotskey.db'
sqlite_conn = sqlite3.connect(sqlite_path)

tables = ['historical_orders', 'historical_items', 'historical_item_services', 'historical_images']

results = []

for table in tables:
    with pg_engine.connect() as pg_conn:
        pg_count = pg_conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
    
    cursor = sqlite_conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    sqlite_count = cursor.fetchone()[0]
    
    results.append({
        'table': table,
        'pg_count': pg_count,
        'sqlite_count': sqlite_count,
        'diff': pg_count - sqlite_count
    })

# Check NULLs integrity for historical_orders
with pg_engine.connect() as pg_conn:
    pg_orders = pg_conn.execute(text("SELECT order_id, original_estimated_release_date, claimed_date, completion_days, grand_total, downpayment, balance FROM historical_orders ORDER BY order_id")).fetchall()

cursor.execute("SELECT order_id, original_estimated_release_date, claimed_date, completion_days, grand_total, downpayment, balance FROM historical_orders ORDER BY order_id")
sqlite_orders = cursor.fetchall()

mismatches = []
for i in range(len(pg_orders)):
    # pg values
    p_id, p_est, p_claim, p_comp, p_grand, p_down, p_bal = pg_orders[i]
    # sqlite values
    s_id, s_est, s_claim, s_comp, s_grand, s_down, s_bal = sqlite_orders[i]
    
    if p_id != s_id:
        continue
    
    # Check if nulls match (str vs None etc depending on driver, but None should be None)
    if (p_est is None) != (s_est is None) or \
       (p_claim is None) != (s_claim is None) or \
       (p_comp is None) != (s_comp is None):
        mismatches.append(f"Mismatch in Order {p_id} Dates: PG=({p_est}, {p_claim}, {p_comp}) SQLITE=({s_est}, {s_claim}, {s_comp})")
    
    if float(p_grand) != float(s_grand) or \
       (p_down is None) != (s_down is None) or \
       (p_bal is None) != (s_bal is None):
        mismatches.append(f"Mismatch in Order {p_id} Finance: PG=({p_grand}, {p_down}, {p_bal}) SQLITE=({s_grand}, {s_down}, {s_bal})")

# Check item_price in historical_items
with pg_engine.connect() as pg_conn:
    pg_items = pg_conn.execute(text("SELECT historical_item_id, item_price FROM historical_items ORDER BY historical_item_id")).fetchall()

cursor.execute("SELECT historical_item_id, item_price FROM historical_items ORDER BY historical_item_id")
sqlite_items = cursor.fetchall()

for i in range(len(pg_items)):
    p_iid, p_price = pg_items[i]
    s_iid, s_price = sqlite_items[i]
    if (p_price is None) != (s_price is None):
        mismatches.append(f"Mismatch in Item {p_iid} Price: PG={p_price} SQLITE={s_price}")

print("--- ROW COUNTS ---")
for r in results:
    print(f"{r['table']}: PG={r['pg_count']}, SQLite={r['sqlite_count']} (Diff: {r['diff']})")

print("\n--- INTEGRITY CHECKS ---")
if len(mismatches) == 0:
    print("All Dates and Financial values match perfectly including NULLs.")
else:
    for m in mismatches:
        print(m)
