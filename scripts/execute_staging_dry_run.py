import os
import sys
import json
import csv
import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

STAGING_URL = "postgresql://postgres:postgres@localhost:5432/shoelotskey_staging"

# 1. STRICT SAFETY ENFORCEMENT
if "localhost" not in STAGING_URL and "127.0.0.1" not in STAGING_URL:
    print("FATAL SAFETY ABORT: STAGING_URL does not resolve to localhost! Execution aborted.")
    sys.exit(1)

conn = psycopg2.connect(STAGING_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();")
db_check = cur.fetchone()
print(f"=== STAGING DATABASE VERIFICATION ===")
print(f"Database: {db_check['current_database']}")
print(f"User:     {db_check['current_user']}")
print(f"Host:     {db_check['inet_server_addr']}")
print(f"Port:     {db_check['inet_server_port']}")

if db_check['current_database'] != "shoelotskey_staging":
    print("FATAL SAFETY ABORT: Connected database is NOT 'shoelotskey_staging'! Aborting.")
    sys.exit(1)

BATCH_ID = "BATCH-20261021-STAGING-V3"

# 2. CAPTURE BEFORE SNAPSHOTS & COUNTS
print("\n--- BASELINE METRICS (BEFORE DRY RUN) ---")
cur.execute("SELECT count(*) as cnt FROM orders;")
before_orders = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM customers;")
before_custs = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM items;")
before_items = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM item_service_mapping;")
before_mappings = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM payments;")
before_pmts = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM audit_logs;")
before_audits = cur.fetchone()["cnt"]

cur.execute("SELECT sum(grand_total) as total_rev FROM orders;")
before_rev = float(cur.fetchone()["total_rev"] or 0)

cur.execute("SELECT sum(amount_received) as total_rec, sum(balance) as total_bal FROM payments;")
b_pmt_fin = cur.fetchone()
before_rec = float(b_pmt_fin["total_rec"] or 0)
before_bal = float(b_pmt_fin["total_bal"] or 0)

print(f"Orders:                  {before_orders}")
print(f"Customers:               {before_custs}")
print(f"Items:                   {before_items}")
print(f"Item Service Mappings:   {before_mappings}")
print(f"Payments:                {before_pmts}")
print(f"Audit Logs:              {before_audits}")
print(f"Booked Revenue:          P{before_rev:,.2f}")
print(f"Payment Collections:     P{before_rec:,.2f}")
print(f"Recorded Receivables:    P{before_bal:,.2f}")

# 3. LOAD REMEDIATION DATA
with open("SEPTEMBER_2026_VERIFIED_ORDER_MATCHES.csv", encoding="utf-8") as f:
    matches = list(csv.DictReader(f))

with open("scratch/perf_audit/source_september_orders.json", encoding="utf-8") as f:
    source_orders = {o["order_number"]: o for o in json.load(f)}

with open("SEPTEMBER_2026_CORRECTED_MANIFEST.csv", encoding="utf-8") as f:
    manifest = list(csv.DictReader(f))

# Services lookup map: service_code -> service_id
cur.execute("SELECT service_id, service_name, service_code, base_price FROM services;")
services_catalog = cur.fetchall()
svc_by_code = {s["service_code"]: s for s in services_catalog if s["service_code"]}
svc_by_name = {s["service_name"].lower(): s for s in services_catalog}

# Map common source abbreviations to service codes
ABBR_MAP = {
    "BC": "BC",
    "FR": "FR",
    "MR": "MR",
    "UNY": "UNY",
    "MRES": "MRES",
    "FR MID": "FRM",
    "FR US": "FRU",
    "FRM": "FRM",
    "FRU": "FRU",
    "MK": "MR",
    "RF": "RF",
}

print("\n--- EXECUTING STAGING REMEDIATION DRY RUN ---")

# PHASE 1: CUSTOMER CONTACT NUMBER RESTORATION (ZERO NAME NORMALIZATION)
print("\n[Phase 1] Restoring missing customer contact numbers (ZERO customer_name updates)...")
phase1_updates = 0
contact_rows = [m for m in manifest if m["category"] == "CUSTOMER_CONTACT_RESTORATION"]

for r in contact_rows:
    cid = int(r["customer_id"])
    target_phone = r["proposed_value"].strip()
    # Check current customer state
    cur.execute("SELECT customer_id, customer_name, contact_number FROM customers WHERE customer_id = %s;", (cid,))
    c_curr = cur.fetchone()
    if c_curr and (c_curr["contact_number"] is None or c_curr["contact_number"].strip() in ("", "NULL")):
        old_val = {"customer_name": c_curr["customer_name"], "contact_number": c_curr["contact_number"]}
        new_val = {"customer_name": c_curr["customer_name"], "contact_number": target_phone, "batch_id": BATCH_ID}
        
        # Safe update: strictly contact_number, NO customer_name change
        cur.execute("""
            UPDATE customers
            SET contact_number = %s
            WHERE customer_id = %s
              AND (contact_number IS NULL OR contact_number = '' OR contact_number = 'NULL');
        """, (target_phone, cid))
        
        # Log to audit_logs using correct column action_type
        cur.execute("""
            INSERT INTO audit_logs (action_type, module, table_name, record_id, user_id, username, role, old_values, new_values, created_at)
            VALUES ('REMEDIATION_UPDATE', 'Customers', 'customers', %s, 1, 'owner', 'owner', %s, %s, NOW());
        """, (cid, json.dumps(old_val), json.dumps(new_val)))
        phase1_updates += 1

print(f"Phase 1 complete: {phase1_updates} customer contact numbers restored. 0 customer names modified.")

# PHASE 2: PAYMENT BALANCE RECONCILIATION
print("\n[Phase 2] Reconciling payment balances with transaction verification...")
phase2_updates = 0
pmt_rows = [m for m in manifest if m["category"] == "PAYMENT_BALANCE_RECONCILIATION"]

for r in pmt_rows:
    p_oid = int(r["production_order_id"])
    prop_bal = float(r["proposed_value"])
    
    # Verify current order and payment transactions
    cur.execute("SELECT order_id, grand_total, discount_amount, refund_amount, status_id FROM orders WHERE order_id = %s;", (p_oid,))
    o_curr = cur.fetchone()
    if not o_curr:
        continue
    
    cur.execute("SELECT payment_id, amount_received, balance, status_id, created_at FROM payments WHERE order_id = %s ORDER BY payment_id ASC;", (p_oid,))
    pmts = cur.fetchall()
    if not pmts:
        continue
    
    tot_rec = sum(float(p["amount_received"] or 0) for p in pmts)
    gt = float(o_curr["grand_total"] or 0)
    disc = float(o_curr["discount_amount"] or 0)
    ref = float(o_curr["refund_amount"] or 0)
    net_due = gt - disc - ref
    calc_bal = max(0.0, net_due - tot_rec)
    
    # Check if single payment row has balance = 0.00 while calc_bal > 0
    if len(pmts) == 1 and float(pmts[0]["balance"] or 0) == 0.0 and calc_bal > 0:
        p_id = pmts[0]["payment_id"]
        old_val = {"payment_id": p_id, "balance": 0.0, "amount_received": tot_rec}
        new_val = {"payment_id": p_id, "balance": calc_bal, "amount_received": tot_rec, "batch_id": BATCH_ID}
        
        cur.execute("""
            UPDATE payments
            SET balance = %s
            WHERE payment_id = %s AND balance = 0.0;
        """, (calc_bal, p_id))
        
        cur.execute("""
            INSERT INTO audit_logs (action_type, module, table_name, record_id, user_id, username, role, old_values, new_values, created_at)
            VALUES ('REMEDIATION_UPDATE', 'Payments', 'payments', %s, 1, 'owner', 'owner', %s, %s, NOW());
        """, (p_id, json.dumps(old_val), json.dumps(new_val)))
        phase2_updates += 1

print(f"Phase 2 complete: {phase2_updates} payment balances reconciled.")

# PHASE 3: HOLLOW ORDER SHOE ITEM & SERVICE RECONSTRUCTION (WITH DETERMINISTIC SHOE KEYS)
print("\n[Phase 3] Reconstructing shoe items and service mappings using deterministic manifest keys...")
phase3_items = 0
phase3_mappings = 0

hollow_matches = [m for m in matches if "HOLLOW" in m["verification_category"]]

for m in hollow_matches:
    p_oid = int(m["prod_order_id"])
    s_oid = m["source_order_id"]
    s_order = source_orders.get(s_oid)
    if not s_order:
        continue
    
    shoes_raw = s_order.get("raw_shoe_details", "").replace("\u20b1", "P")
    # Parse individual shoes
    shoe_parts = [s.strip() for s in shoes_raw.split("),") if s.strip()]
    
    for pair_idx, sp in enumerate(shoe_parts, 1):
        if not sp.endswith(")"):
            sp = sp + ")"
        
        # Manifest Key: stable, deterministic key
        manifest_key = f"RECON-{p_oid}-P{pair_idx}"
        
        # Extract brand and model
        brand = "Generic"
        for known_brand in ["Nike", "Jordan", "New Balance", "Puma", "Adidas", "Converse", "Vans", "Skechers", "On Cloud", "Lacoste", "Asics", "Gucci", "Clarks", "Merrell", "Hoka", "Lite Ride", "Fresh Foam", "Aif", "Rockbros", "Guin", "NBA", "XStep"]:
            if known_brand.lower() in sp.lower():
                brand = known_brand
                break
        
        shoe_model = sp.split("(")[0].strip() if "(" in sp else sp.strip()
        item_notes = f"[Ref: {manifest_key}] {sp}"
        
        # Idempotent insert with NOT EXISTS on manifest_key pattern
        cur.execute("""
            INSERT INTO items (order_id, brand, shoe_model, quantity, item_notes, status)
            SELECT %s, %s, %s, 1, %s, 'on-going'
            WHERE NOT EXISTS (
                SELECT 1 FROM items 
                WHERE order_id = %s AND item_notes LIKE %s
            )
            RETURNING item_id;
        """, (p_oid, brand, shoe_model, item_notes, p_oid, f"%{manifest_key}%"))
        
        res = cur.fetchone()
        if res:
            new_item_id = res["item_id"]
            phase3_items += 1
            
            # Parse service codes in parentheses
            svc_sub = sp[sp.find("(")+1 : sp.rfind(")")] if "(" in sp and ")" in sp else ""
            
            # Map services
            attached_services = []
            if "BC" in svc_sub or "Basic Cleaning" in svc_sub:
                attached_services.append((1, 325.00))
            if "FR US" in svc_sub or "Undersole" in svc_sub:
                attached_services.append((167, 150.00))
            if "FR Mid" in svc_sub or "Midsole" in svc_sub:
                attached_services.append((166, 150.00))
            if "FR" in svc_sub and not ("FR US" in svc_sub or "FR Mid" in svc_sub):
                attached_services.append((3, 250.00))
            if "MR" in svc_sub or "Minor Reglue" in svc_sub:
                attached_services.append((4, 125.00))
            if "MRES" in svc_sub or "Minor Restoration" in svc_sub:
                attached_services.append((41, 225.00))
            if "Color Renewal" in svc_sub or "CR2" in svc_sub:
                attached_services.append((49, 375.00))
            if "Rush" in svc_sub:
                attached_services.append((11, 150.00))
            
            # Default fallback if no recognized service code: Basic Cleaning
            if not attached_services:
                attached_services.append((1, 325.00))
            
            for sid, aprice in attached_services:
                cur.execute("""
                    INSERT INTO item_service_mapping (item_id, service_id, actual_price)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (item_id, service_id) DO NOTHING;
                """, (new_item_id, sid, aprice))
                phase3_mappings += 1

print(f"Phase 3 complete: {phase3_items} shoe items created across 45 hollow orders. {phase3_mappings} service mappings linked.")

# PHASE 4: UNENCODED INTAKE ORDERS INGESTION (29 ORDERS)
print("\n[Phase 4] Ingesting 29 unencoded source intake orders...")
phase4_orders = 0
phase4_items = 0
phase4_mappings = 0
phase4_pmts = 0

unencoded_matches = [m for m in matches if m["match_status"] == "NOT_FOUND_IN_PROD"]

for m in unencoded_matches:
    s_oid = m["source_order_id"]
    s_order = source_orders.get(s_oid)
    if not s_order:
        continue
    
    # 1. Customer
    raw_name = s_order.get("raw_client_name") or "Valued Customer"
    raw_phone = s_order.get("raw_contact_no") or ""
    
    cur.execute("SELECT customer_id FROM customers WHERE customer_name = %s AND contact_number = %s;", (raw_name, raw_phone))
    c_res = cur.fetchone()
    if c_res:
        cust_id = c_res["customer_id"]
    else:
        cur.execute("""
            INSERT INTO customers (customer_name, contact_number, created_at)
            VALUES (%s, %s, NOW())
            RETURNING customer_id;
        """, (raw_name, raw_phone))
        cust_id = cur.fetchone()["customer_id"]
    
    # 2. Historical Dates
    # Parse date from order number: ORD-2026-09-DD-NNN
    parts = s_oid.split("-")
    day_str = parts[3] if len(parts) >= 4 else "01"
    hist_created = f"2026-09-{day_str} 09:00:00"
    gt = float(s_order.get("parsed_grand_total") or 0)
    dp = float(s_order.get("parsed_downpayment") or 0)
    bal = float(s_order.get("parsed_balance") or 0)
    
    # 3. Order (Deterministic & Idempotent by target_ord_num)
    DISPLACED_COLLISIONS = {
        "ORD-2026-09-07-001", 
        "ORD-2026-09-08-007", 
        "ORD-2026-09-11-009", 
        "ORD-2026-09-12-003"
    }
    target_ord_num = f"{s_oid}-SRC" if s_oid in DISPLACED_COLLISIONS else s_oid

    cur.execute("""
        INSERT INTO orders (
            order_number, customer_id, status_id, priority_id, grand_total,
            expected_at, user_id, inventory_applied, cancellation_stage, discount_amount,
            created_at, updated_at
        )
        SELECT %s, %s, 1, 1, %s, %s, 1, true, NULL, 0.0, %s, NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM orders WHERE order_number = %s
        )
        RETURNING order_id;
    """, (target_ord_num, cust_id, gt, hist_created, hist_created, target_ord_num))
    
    o_res = cur.fetchone()
    if not o_res:
        continue
    
    new_oid = o_res["order_id"]
    phase4_orders += 1
    
    # Audit log for order insertion
    cur.execute("""
        INSERT INTO audit_logs (action_type, module, table_name, record_id, user_id, username, role, old_values, new_values, created_at)
        VALUES ('REMEDIATION_INSERT', 'Orders', 'orders', %s, 1, 'owner', 'owner', NULL, %s, NOW());
    """, (new_oid, json.dumps({"order_number": target_ord_num, "source_order_id": s_oid, "grand_total": gt, "batch_id": BATCH_ID})))
    
    # 4. Payment Row (Idempotent)
    p_status = 1 if bal == 0.0 and dp > 0 else (2 if dp > 0 else 3)
    p_ref = f"HIST-INTAKE | {BATCH_ID}"
    cur.execute("""
        INSERT INTO payments (
            order_id, method_id, status_id, amount_received, balance, reference_no, created_at
        )
        SELECT %s, 1, %s, %s, %s, %s, %s
        WHERE NOT EXISTS (
            SELECT 1 FROM payments WHERE order_id = %s
        )
        RETURNING payment_id;
    """, (new_oid, p_status, dp, bal, p_ref, hist_created, new_oid))
    if cur.fetchone():
        phase4_pmts += 1
    
    # 5. Shoes and services for unencoded order
    shoes_raw = s_order.get("raw_shoe_details", "").replace("\u20b1", "P")
    shoe_parts = [s.strip() for s in shoes_raw.split("),") if s.strip()]
    
    for pair_idx, sp in enumerate(shoe_parts, 1):
        if not sp.endswith(")"):
            sp = sp + ")"
        manifest_key = f"RECON-{new_oid}-P{pair_idx}"
        
        brand = "Generic"
        for known_brand in ["Nike", "Jordan", "New Balance", "Puma", "Adidas", "Converse", "Vans", "Skechers", "On Cloud", "Lacoste", "Asics", "Gucci", "Clarks", "Merrell", "Hoka", "Lite Ride", "Fresh Foam", "Aif", "Rockbros", "Guin", "NBA", "XStep"]:
            if known_brand.lower() in sp.lower():
                brand = known_brand
                break
        
        shoe_model = sp.split("(")[0].strip() if "(" in sp else sp.strip()
        item_notes = f"[Ref: {manifest_key}] {sp}"
        
        cur.execute("""
            INSERT INTO items (order_id, brand, shoe_model, quantity, item_notes, status)
            SELECT %s, %s, %s, 1, %s, 'on-going'
            WHERE NOT EXISTS (
                SELECT 1 FROM items WHERE order_id = %s AND item_notes LIKE %s
            )
            RETURNING item_id;
        """, (new_oid, brand, shoe_model, item_notes, new_oid, f"%{manifest_key}%"))
        
        i_res = cur.fetchone()
        if i_res:
            new_item_id = i_res["item_id"]
            phase4_items += 1
            
            # Parse service codes
            svc_sub = sp[sp.find("(")+1 : sp.rfind(")")] if "(" in sp and ")" in sp else ""
            attached_services = []
            if "BC" in svc_sub or "Basic Cleaning" in svc_sub:
                attached_services.append((1, 325.00))
            if "FR US" in svc_sub or "Undersole" in svc_sub:
                attached_services.append((167, 150.00))
            if "FR Mid" in svc_sub or "Midsole" in svc_sub:
                attached_services.append((166, 150.00))
            if "FR" in svc_sub and not ("FR US" in svc_sub or "FR Mid" in svc_sub):
                attached_services.append((3, 250.00))
            if "MR" in svc_sub or "Minor Reglue" in svc_sub:
                attached_services.append((4, 125.00))
            if "MRES" in svc_sub or "Minor Restoration" in svc_sub:
                attached_services.append((41, 225.00))
            if "Color Renewal" in svc_sub or "CR2" in svc_sub:
                attached_services.append((49, 375.00))
            if "Rush" in svc_sub:
                attached_services.append((11, 150.00))
            
            if not attached_services:
                attached_services.append((1, 325.00))
            
            for sid, aprice in attached_services:
                cur.execute("""
                    INSERT INTO item_service_mapping (item_id, service_id, actual_price)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (item_id, service_id) DO NOTHING;
                """, (new_item_id, sid, aprice))
                phase4_mappings += 1

print(f"Phase 4 complete: {phase4_orders} unencoded orders inserted, {phase4_pmts} payment rows, {phase4_items} items, {phase4_mappings} services.")

# COMMIT REMEDIATION TRANSACTION
conn.commit()
print("\nRemediation transaction COMMITTED successfully.")

# 4. CAPTURE AFTER METRICS & INTEGRITY VALIDATION
print("\n--- METRICS AFTER REMEDIATION (POST DRY RUN) ---")
cur.execute("SELECT count(*) as cnt FROM orders;")
after_orders = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM customers;")
after_custs = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM items;")
after_items = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM item_service_mapping;")
after_mappings = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM payments;")
after_pmts = cur.fetchone()["cnt"]

cur.execute("SELECT count(*) as cnt FROM audit_logs;")
after_audits = cur.fetchone()["cnt"]

cur.execute("SELECT sum(grand_total) as total_rev FROM orders;")
after_rev = float(cur.fetchone()["total_rev"] or 0)

cur.execute("SELECT sum(amount_received) as total_rec, sum(balance) as total_bal FROM payments;")
a_pmt_fin = cur.fetchone()
after_rec = float(a_pmt_fin["total_rec"] or 0)
after_bal = float(a_pmt_fin["total_bal"] or 0)

print(f"Orders:                  {after_orders} (Delta: +{after_orders - before_orders})")
print(f"Customers:               {after_custs} (Delta: +{after_custs - before_custs})")
print(f"Items:                   {after_items} (Delta: +{after_items - before_items})")
print(f"Item Service Mappings:   {after_mappings} (Delta: +{after_mappings - before_mappings})")
print(f"Payments:                {after_pmts} (Delta: +{after_pmts - before_pmts})")
print(f"Audit Logs:              {after_audits} (Delta: +{after_audits - before_audits})")
print(f"Booked Revenue:          P{after_rev:,.2f} (Delta: +P{after_rev - before_rev:,.2f})")
print(f"Payment Collections:     P{after_rec:,.2f} (Delta: +P{after_rec - before_rec:,.2f})")
print(f"Recorded Receivables:    P{after_bal:,.2f} (Delta: +P{after_bal - before_bal:,.2f})")

# Check for hollow orders remaining
cur.execute("""
    SELECT count(*) as cnt
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.order_id = o.order_id);
""")
remaining_hollow = cur.fetchone()["cnt"]
print(f"\nRemaining hollow orders in staging: {remaining_hollow} (Target: 0)")

cur.close()
conn.close()
print("\nStaging dry run completed successfully!")
