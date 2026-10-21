# Shoelotskey SMS — September 2026 Production Database Remediation Plan
**Document Identifier:** PLAN-REMED-2026-09-V2  
**Date of Formulation:** 21 October 2026  
**Lead Engineer:** Senior PostgreSQL Database Integrity Auditor & FastAPI Backend Developer  
**Target Environment:** Production PostgreSQL (`shoelotskey-villamor-pasay` on AWS RDS `d6281rp0p4pg8c`)  
**Status:** **PROPOSED ARCHITECTURE ONLY — STRICTLY ON HOLD PENDING USER AUTHORIZATION**  
**Safety Mandate:** Zero Production Modification during Audit | Idempotent & Transaction-Safe Protocol  

---

## 1. Remediation Scope & Prerequisites

This plan outlines the technical protocol required to remediate data defects identified during the September 2026 audit, including:
1. **45 Hollow Orders:** Populating missing shoe items in `items` and service relationships in `item_service_mapping`.
2. **48 Missing Customer Contact Numbers:** Populating verified mobile numbers for affected customer records.
3. **46 Customer Name Normalizations:** Correcting OCR and transcription spelling artifacts.
4. **10 Payment Balance Zeroing Fixes:** Correcting recorded balances in the `payments` table to restore ₱5,575.00 in accounts receivable.
5. **6 Unpaid Order Payment Row Initializations:** Initializing pending payment rows for unpaid orders (₱9,400.00).
6. **29 Un-Encoded Early & Missing Pilot Orders:** Safely ingesting verified historical intake orders.

### Mandatory Pre-Conditions Before Execution:
* [ ] Explicit written authorization received from the project owner.
* [ ] Fresh Heroku database snapshot captured and verified.
* [ ] Isolated staging dry-run successfully completed with zero constraint violations.
* [ ] All transactions wrapped in atomic blocks with automatic rollback on failure.

---

## 2. Production Backup Verification Protocol

Prior to executing any SQL commands against the live RDS cluster, a fresh database dump must be taken and verified:

```bash
# 1. Capture fresh Heroku PostgreSQL snapshot
heroku pg:backups:capture --app shoelotskey-villamor-pasay

# 2. Download snapshot to protected local storage
heroku pg:backups:download --app shoelotskey-villamor-pasay -o backend/backups/pre_remediation_20261021.dump

# 3. Verify dump integrity via pg_restore list verification
pg_restore --list backend/backups/pre_remediation_20261021.dump | head -n 30
```

Existing verified cold backups on file:
* `backend/backups/Heroku Backup/30e46a10-7a6f-4c5d-8d96-d64be6c374e3/heroku_postgres_backup_b2.dump` (414 KB)
* `backend/backups/pre_remediation_backup.sql`

---

## 3. Isolated Staging Test & Dry-Run Protocol

To prevent unexpected table locks or foreign key violations on live production, the complete remediation script must be validated in an isolated staging environment:

```bash
# 1. Spin up an isolated staging PostgreSQL database (local or Docker container)
createdb -U postgres shoelotskey_staging

# 2. Restore the production snapshot into the staging environment
pg_restore -U postgres -d shoelotskey_staging -v backend/backups/pre_remediation_20261021.dump

# 3. Execute remediation migration script in dry-run mode
python backend/scripts/execute_remediation_dry_run.py --db-url postgresql://postgres:password@localhost:5432/shoelotskey_staging

# 4. Run automated integrity verification suite
python backend/tests/verify_post_remediation_integrity.py --db-url postgresql://postgres:password@localhost:5432/shoelotskey_staging
```

---

## 4. Idempotent & Transaction-Safe Script Architecture

All remediation logic is designed to be **100% idempotent** (safe to execute multiple times without duplicating data or corrupting state):

### Safety Rules Enforced in SQL:
1. **Duplicate Prevention:** All order insertions use `ON CONFLICT (order_number) DO NOTHING` or verify `WHERE NOT EXISTS (SELECT 1 FROM orders WHERE order_number = ...)`.
2. **Item-Service Composite Key Protection:** `item_service_mapping` uses composite primary keys `(item_id, service_id)` preventing duplicate service attachments.
3. **Inventory Isolation:** Historical remediation must NOT deduct current live physical inventory. In the `orders` table, `inventory_applied` is set to `FALSE` to protect physical stock levels.
4. **Denormalized Audit Trail Logging:** Every modified or inserted row generates an immutable `audit_logs` record capturing:
   * `action`: `REMEDIATION_UPDATE` / `REMEDIATION_INSERT`
   * `module`: `Pilot Remediation`
   * `table_name`: Target table
   * `record_id`: Modified primary key
   * `old_values`: JSON representation of previous state
   * `new_values`: JSON representation of updated state
   * `user_id`: Authorized administrator ID

---

## 5. Phased Remediation Execution Architecture

```mermaid
graph TD
    A[Pre-Execution Backup & Verification] --> B[Phase 1: Customer Normalization & Contacts]
    B --> C[Phase 2: Payment Balances Reconciliation]
    C --> D[Phase 3: Hollow Order Item & Service Reconstruction]
    D --> E[Phase 4: Missing Order Ingestion]
    E --> F[Phase 5: Post-Remediation Verification & Reconciliation]
    F -->|Pass| G[Commit Transaction]
    F -->|Fail| H[Immediate Rollback & Diagnostics]
```

### Phase 1: Customer Contact & Name Normalization
Updates `customers` table with verified contact numbers and standardizes OCR name spellings without altering customer IDs.

```sql
BEGIN;

-- Example: Restore verified contact number
UPDATE customers 
SET contact_number = '09926225988',
    customer_name = 'Bea B. Chavez'
WHERE customer_id = 1946 AND (contact_number IS NULL OR customer_name = 'Ben Chavez');

-- Log audit trail for customer update
INSERT INTO audit_logs (action, module, table_name, record_id, user_id, old_values, new_values, created_at)
VALUES (
    'REMEDIATION_UPDATE', 'Customers', 'customers', 1946, 1,
    '{"customer_name": "Ben Chavez", "contact_number": null}',
    '{"customer_name": "Bea B. Chavez", "contact_number": "09926225988"}',
    NOW()
);

COMMIT;
```

### Phase 2: Payment Balance Reconciliation
Corrects the 10 partially paid orders where `payments.balance` was set to `0.00`, restoring live accounts receivable.

```sql
BEGIN;

-- Example: Correct balance on Order 1045 (Bea B. Chavez)
UPDATE payments
SET balance = 100.00
WHERE payment_id = 958 AND order_id = 1045 AND balance = 0.00;

-- Example: Correct balance on Order 1049 (Kathlyn Rose Aguila)
UPDATE payments
SET balance = 275.00
WHERE payment_id = 962 AND order_id = 1049 AND balance = 0.00;

COMMIT;
```

### Phase 3: Hollow Order Item & Service Reconstruction
Populates child `items` and `item_service_mapping` rows for the 45 hollow orders.

```sql
BEGIN;

-- Example: Reconstruct shoes for Order 1045 (5 pairs)
-- Item 1: Gucci
INSERT INTO items (order_id, brand, shoe_model, quantity, item_notes, created_at)
VALUES (1045, 'Gucci', 'Classic Sneaker', 1, 'No insole', NOW())
RETURNING item_id; -- e.g. item_id = 501

-- Attach Full Reglue (service_id = 3, actual_price = 575.00)
INSERT INTO item_service_mapping (item_id, service_id, actual_price)
VALUES (501, 3, 575.00);

-- Items 2, 3, 4: Clarks & Nike Basic Cleaning (service_id = 1, actual_price = 325.00)
-- Item 5: Nike Brown Minor Restoration (service_id = 4, actual_price = 550.00)

COMMIT;
```

### Phase 4: Missing Order Ingestion
Inserts the 29 un-encoded pilot intake orders with corresponding customer, order, items, and payment installment rows.

---

## 6. Rollback Procedures & Contingency

If any constraint error, table lock timeout, or validation mismatch occurs during execution, the transaction block automatically triggers an immediate `ROLLBACK`:

```sql
-- Immediate Rollback Command
ROLLBACK;
```

### Targeted Rollback Script (Post-Commit Reversion):
If an unforeseen defect is detected after commit, the targeted reversal script restores the exact pre-remediation state using the logged `old_values` from the `audit_logs` table:

```sql
BEGIN;

-- Revert customer updates from audit trail
UPDATE customers c
SET customer_name = (a.old_values->>'customer_name'),
    contact_number = (a.old_values->>'contact_number')
FROM audit_logs a
WHERE a.table_name = 'customers' 
  AND a.record_id = c.customer_id 
  AND a.action = 'REMEDIATION_UPDATE'
  AND a.created_at >= '2026-10-21 00:00:00';

-- Revert payment balances
UPDATE payments p
SET balance = 0.00
WHERE payment_id IN (958, 962, 963, 964, 965, 975, 976, 978, 990, 1003)
  AND p.created_at < '2026-10-08 00:00:00';

COMMIT;
```

---

## 7. Post-Remediation Verification Queries

Upon execution of any approved migration, the following verification queries must be run to guarantee 100% database health:

```sql
-- 1. Verify that 0 hollow orders remain in September orders
SELECT count(*) AS remaining_hollow_orders
FROM orders o
LEFT JOIN items i ON o.order_id = i.order_id
WHERE o.order_number LIKE 'ORD-2026-09%'
  AND i.item_id IS NULL;
-- EXPECTED RESULT: 0

-- 2. Verify that all payments balances equal (grand_total - amount_received)
SELECT o.order_number, o.grand_total, p.amount_received, p.balance,
       (o.grand_total - p.amount_received) AS calculated_balance
FROM orders o
JOIN payments p ON o.order_id = p.order_id
WHERE o.order_number LIKE 'ORD-2026-09%'
  AND p.balance != (o.grand_total - p.amount_received);
-- EXPECTED RESULT: 0 rows

-- 3. Verify total customer contact restoration count
SELECT count(*) AS customers_with_contacts
FROM customers
WHERE contact_number IS NOT NULL AND contact_number != '';
-- EXPECTED RESULT: +48 increase

-- 4. Verify audit trail event registration
SELECT action, count(*) 
FROM audit_logs 
WHERE module = 'Pilot Remediation'
GROUP BY action;
-- EXPECTED RESULT: Matches total manifest execution count
```

---

## 8. Summary of Approval Gate

> [!IMPORTANT]
> **REMEDIATION EXECUTION IS CURRENTLY BLOCKED.**  
> In accordance with project instructions, **no SQL changes, migrations, or database updates will be applied** until the user reviews and explicitly authorizes this remediation plan.
