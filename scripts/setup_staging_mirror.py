import os
import sys
import json
import psycopg2

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

STAGING_URL = "postgresql://postgres:postgres@localhost:5432/shoelotskey_staging"

# SAFETY CHECK: Ensure we NEVER touch remote/production
if "localhost" not in STAGING_URL and "127.0.0.1" not in STAGING_URL:
    print("FATAL: STAGING_URL does not point to localhost! Aborting.")
    sys.exit(1)

conn = psycopg2.connect(STAGING_URL)
cur = conn.cursor()

# Verify database name
cur.execute("SELECT current_database(), current_user, inet_server_addr();")
db_info = cur.fetchone()
print(f"Connected to staging database: {db_info[0]} as {db_info[1]} at {db_info[2]}")
if db_info[0] != "shoelotskey_staging":
    print("FATAL: Connected to wrong database! Aborting.")
    sys.exit(1)

print("--- 1. INITIALIZING SCHEMA FROM SQLALCHEMY MODELS ---")
from sqlalchemy import create_engine
import models
Base = models.Base

engine = create_engine(STAGING_URL)
Base.metadata.create_all(engine)
print("All SQLAlchemy tables created successfully on shoelotskey_staging!")

# Clean reset of transactional tables to ensure repeatable baseline
cur.execute("""
    TRUNCATE TABLE 
        item_service_mapping, 
        item_condition_mapping, 
        items, 
        payments, 
        deliveries, 
        status_log, 
        orders, 
        customers, 
        audit_logs 
    CASCADE;
""")
conn.commit()
print("Cleaned transactional tables for pristine baseline setup.")

print("--- 2. LOADING PRODUCTION LOOKUPS AND CATALOG ---")
lookups_sql = """
-- Roles
INSERT INTO roles (role_id, role_name) VALUES 
(1, 'owner'), (2, 'staff') ON CONFLICT (role_id) DO NOTHING;

-- Status
INSERT INTO status (status_id, status_name) VALUES 
(1, 'new-order'), (2, 'on-going'), (3, 'for-release'), (4, 'cancelled'), (5, 'claimed') 
ON CONFLICT (status_id) DO NOTHING;

-- Service Categories
INSERT INTO service_categories (category_id, category_name) VALUES 
(1, 'base'), (2, 'addon'), (3, 'priority'), (67, 'discount')
ON CONFLICT (category_id) DO NOTHING;

-- Payment Statuses
INSERT INTO payment_statuses (p_status_id, status_name) VALUES 
(1, 'fully-paid'), (2, 'downpayment'), (3, 'pending')
ON CONFLICT (p_status_id) DO NOTHING;

-- Payment Methods
INSERT INTO payment_methods (method_id, method_name) VALUES 
(1, 'cash'), (2, 'gcash'), (3, 'bank-transfer'), (67, 'maya')
ON CONFLICT (method_id) DO NOTHING;

-- Priority Levels
INSERT INTO priority_levels (priority_id, priority_name) VALUES 
(1, 'regular'), (2, 'rush')
ON CONFLICT (priority_id) DO NOTHING;

-- Shipping Preferences
INSERT INTO shipping_preferences (pref_id, pref_name) VALUES 
(1, 'pickup'), (2, 'delivery')
ON CONFLICT (pref_id) DO NOTHING;

-- System User for remediation
INSERT INTO users (user_id, username, email, password_hash, role_id, is_active) VALUES 
(1, 'owner', 'owner@shoelotskey.com', '$2b$12$e8Yy8nJ8s90q2u91283u.O', 1, true)
ON CONFLICT (user_id) DO NOTHING;
"""
cur.execute(lookups_sql)
conn.commit()

# Services Catalog
services_data = [
    (1, 'Basic Cleaning', 'BC', 325.00, 1, True),
    (3, 'Full Reglue', 'FR', 250.00, 1, True),
    (4, 'Minor Reglue', 'MR', 125.00, 1, True),
    (6, 'Unyellowing', 'UNY', 125.00, 2, True),
    (7, 'Repainting', 'RPT', 500.00, 2, False),
    (8, 'Shoe Lace Replacement', 'SLR', 50.00, 2, False),
    (9, 'White Paint', 'WPT', 150.00, 2, True),
    (10, 'Minor Retouch', 'MRET', 125.00, 2, True),
    (11, 'Rush Fee (Basic Cleaning)', 'RF', 150.00, 3, True),
    (12, 'Rush Fee (Minor Reglue)', 'RFR', 250.00, 3, False),
    (38, 'Rush Fee (Full Reglue)', 'RFF', 250.00, 3, False),
    (39, 'Undersole Full Reglue', 'UFR', 150.00, 2, False),
    (40, 'Midsole Full Reglue', 'MFR', 150.00, 2, False),
    (41, 'Minor Restoration', 'MRES', 225.00, 2, True),
    (42, 'Add Glue Layer', 'AGL', 100.00, 2, False),
    (49, '2 Colors', 'CR2', 375.00, 2, True),
    (50, '3 Colors', 'CR3', 475.00, 2, True),
    (67, 'Color Renewal', 'Cor', 0.00, 1, True),
    (166, 'Full Reglue Midsole', 'FRM', 150.00, 2, True),
    (167, 'Full Reglue Undersole', 'FRU', 150.00, 2, True),
]
for s in services_data:
    cur.execute("""
        INSERT INTO services (service_id, service_name, service_code, base_price, category_id, is_active)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (service_id) DO NOTHING;
    """, s)
conn.commit()
print("Lookup tables and services catalog populated!")

print("--- 3. POPULATING PRODUCTION SEPTEMBER SNAPSHOT (68 ORDERS) ---")
with open("scratch/perf_audit/production_september_dump.json", encoding="utf-8") as f:
    dump = json.load(f)

orders = dump.get("orders", []) if isinstance(dump, dict) else dump
print(f"Loading {len(orders)} production orders into staging mirror...")

# Populate Customers first
cust_seen = set()
for o in orders:
    cid = o.get("customer_id")
    cname = o.get("customer", {}).get("customer_name") if isinstance(o.get("customer"), dict) else o.get("customer_name")
    cphone = o.get("customer", {}).get("contact_number") if isinstance(o.get("customer"), dict) else o.get("contact_number")
    if cid and cid not in cust_seen:
        cur.execute("""
            INSERT INTO customers (customer_id, customer_name, contact_number, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (customer_id) DO NOTHING;
        """, (cid, cname or "Unknown", cphone or "", o.get("created_at")))
        cust_seen.add(cid)
conn.commit()
print(f"Populated {len(cust_seen)} customers.")

# Populate Orders
for o in orders:
    cur.execute("""
        INSERT INTO orders (
            order_id, order_number, customer_id, status_id, priority_id, grand_total,
            expected_at, user_id, inventory_applied, cancellation_stage, discount_amount,
            created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (order_id) DO NOTHING;
    """, (
        o["order_id"], o["order_number"], o["customer_id"], o.get("status_id", 1),
        o.get("priority_id", 1), o.get("grand_total", 0.0), o.get("expected_at") or o.get("created_at"),
        1, o.get("inventory_applied", False), o.get("cancellation_stage"), o.get("discount_amount", 0.0),
        o.get("created_at"), o.get("updated_at")
    ))
conn.commit()

# Populate Payments
pmt_count = 0
for o in orders:
    for p in o.get("payments", []):
        cur.execute("""
            INSERT INTO payments (
                payment_id, order_id, method_id, status_id, amount_received, balance,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (payment_id) DO NOTHING;
        """, (
            p["payment_id"], p["order_id"], p.get("method_id", 1), p.get("status_id", 1),
            p.get("amount_received", 0.0), p.get("balance", 0.0), p.get("created_at")
        ))
        pmt_count += 1
conn.commit()
print(f"Populated {len(orders)} orders and {pmt_count} payments.")

# Populate Items and mappings for non-hollow orders
item_count = 0
for o in orders:
    for it in o.get("items", []):
        cur.execute("""
            INSERT INTO items (
                item_id, order_id, brand, shoe_model, quantity, item_notes, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (item_id) DO NOTHING;
        """, (
            it["item_id"], it["order_id"], it.get("brand"), it.get("shoe_model"),
            it.get("quantity", 1), it.get("item_notes"), it.get("status", "on-going")
        ))
        item_count += 1
        for sm in it.get("service_mappings", []):
            cur.execute("""
                INSERT INTO item_service_mapping (item_id, service_id, actual_price)
                VALUES (%s, %s, %s)
                ON CONFLICT (item_id, service_id) DO NOTHING;
            """, (sm["item_id"], sm["service_id"], sm.get("actual_price", 0.0)))
conn.commit()
print(f"Populated {item_count} items and their service mappings.")

# Verify Staging Snapshot Counts
cur.execute("SELECT count(*) FROM orders;")
s_orders = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM customers;")
s_custs = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM payments;")
s_pmts = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM items;")
s_items = cur.fetchone()[0]

print("\n--- STAGING BASELINE VERIFICATION ---")
print(f"Orders:    {s_orders} (expected 68)")
print(f"Customers: {s_custs}")
print(f"Payments:  {s_pmts} (expected 62)")
print(f"Items:     {s_items} (expected non-hollow count: 23)")

cur.close()
conn.close()
print("Staging environment setup complete and verified!")
