import sqlite3
import os

db_path = os.path.join('backend', 'db', 'shoelotskey.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("PRAGMA foreign_keys=off;")
c.execute("BEGIN TRANSACTION;")
c.execute("ALTER TABLE inventory RENAME TO inventory_old;")
c.execute("""
CREATE TABLE inventory (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    inventory_number VARCHAR(50) UNIQUE,
    category VARCHAR(50),
    stock_quantity FLOAT DEFAULT 0.0,
    unit VARCHAR(20),
    unit_price DECIMAL(10, 2) DEFAULT 0.0,
    status VARCHAR(30),
    is_active BOOLEAN DEFAULT 1,
    auto_deduct BOOLEAN DEFAULT 0,
    auto_deduct_trigger VARCHAR(50) DEFAULT 'Job Started',
    trigger_service VARCHAR(100) DEFAULT 'All',
    consumption_qty FLOAT DEFAULT 0.0,
    consumption_unit VARCHAR(20) DEFAULT '',
    package_size FLOAT DEFAULT 0.0,
    package_unit VARCHAR(20) DEFAULT '',
    low_stock_threshold FLOAT DEFAULT 0.0,
    is_retail BOOLEAN DEFAULT 0,
    retail_price DECIMAL(10, 2) DEFAULT 0.0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
""")
cols = [
    'item_id', 'item_name', 'inventory_number', 'category', 'stock_quantity', 'unit',
    'unit_price', 'status', 'is_active', 'auto_deduct', 'auto_deduct_trigger',
    'trigger_service', 'consumption_qty', 'consumption_unit', 'package_size',
    'package_unit', 'low_stock_threshold', 'is_retail', 'retail_price', 'created_at', 'updated_at'
]
c.execute(f"""
INSERT INTO inventory ({', '.join(cols)})
SELECT item_id, item_name, inventory_number, category, stock_quantity, unit,
    unit_price, status, is_active, auto_deduct, auto_deduct_trigger,
    trigger_service, consumption_qty, consumption_unit, package_size,
    package_unit, low_stock_threshold, is_retail, 
    CASE WHEN retail_price IS NULL OR retail_price = '' THEN 0.0 ELSE CAST(retail_price AS DECIMAL(10,2)) END,
    created_at, updated_at
FROM inventory_old;
""")
c.execute("DROP TABLE inventory_old;")
conn.commit()
print("SUCCESS: SQLite inventory table rebuilt with proper DECIMAL(10,2) retail_price.")
info = conn.execute("PRAGMA table_info(inventory)").fetchall()
for col in info:
    print(col)
