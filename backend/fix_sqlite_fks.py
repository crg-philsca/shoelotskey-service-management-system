import sqlite3

conn = sqlite3.connect('backend/db/shoelotskey.db')
c = conn.cursor()

# Check current inventory_logs schema
row = c.execute("SELECT sql FROM sqlite_master WHERE name='inventory_logs'").fetchone()
print("Current schema:", row[0] if row else "None")

if row and "inventory_old" in row[0]:
    print("Fixing inventory_logs table...")
    c.execute("PRAGMA foreign_keys = OFF;")
    c.execute("CREATE TABLE inventory_logs_new (\n\tlog_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, \n\titem_id INTEGER NOT NULL, \n\tchange_amount FLOAT NOT NULL, \n\taction_type VARCHAR(20) NOT NULL, \n\torder_id INTEGER, \n\tuser_id INTEGER NOT NULL, \n\tcreated_at TIMESTAMP, \n\tFOREIGN KEY(item_id) REFERENCES inventory (item_id), \n\tFOREIGN KEY(order_id) REFERENCES orders (order_id) ON DELETE SET NULL, \n\tFOREIGN KEY(user_id) REFERENCES users (user_id)\n);")
    c.execute("INSERT INTO inventory_logs_new SELECT * FROM inventory_logs;")
    c.execute("DROP TABLE inventory_logs;")
    c.execute("ALTER TABLE inventory_logs_new RENAME TO inventory_logs;")
    c.execute("PRAGMA foreign_keys = ON;")
    conn.commit()
    print("inventory_logs successfully recreated and references 'inventory'!")

# Verify
new_row = c.execute("SELECT sql FROM sqlite_master WHERE name='inventory_logs'").fetchone()
print("New schema:", new_row[0] if new_row else "None")
conn.close()
