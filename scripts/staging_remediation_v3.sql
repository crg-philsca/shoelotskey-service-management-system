-- =========================================================================
-- Shoelotskey Service Management System
-- Staging Remediation Script V3 (Audit-Verified & Safeguarded)
-- Date: 2026-10-21
-- Target Environment: shoelotskey_staging (STRICT LOCALHOST ONLY)
-- Mode: Idempotent Execution Block
-- Production Safety: STRICT NO-GO FOR LIVE PRODUCTION
-- =========================================================================

BEGIN;

-- Safety Check: Verify Database Identity
DO $$
BEGIN
    IF current_database() != 'shoelotskey_staging' THEN
        RAISE EXCEPTION 'FATAL SAFETY ABORT: Database is not shoelotskey_staging!';
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- PHASE 1: CUSTOMER CONTACT NUMBER RESTORATION (ZERO NAME NORMALIZATION)
-- -------------------------------------------------------------------------
-- Updates missing phone numbers strictly; preserves existing customer_name.
-- Example parameterized statement:
-- UPDATE customers
-- SET contact_number = :verified_phone
-- WHERE customer_id = :target_customer_id
--   AND (contact_number IS NULL OR contact_number = '' OR contact_number = 'NULL');

-- Forensic Audit Logging for Phase 1
-- INSERT INTO audit_logs (action_type, module, table_name, record_id, user_id, username, role, old_values, new_values, created_at)
-- VALUES ('REMEDIATION_UPDATE', 'Customers', 'customers', :target_customer_id, 1, 'owner', 'owner', :old_val, :new_val, NOW());


-- -------------------------------------------------------------------------
-- PHASE 2: PAYMENT BALANCE RECONCILIATION (TRANSACTION LEVEL)
-- -------------------------------------------------------------------------
-- Reconciles net debt against total amount received across all payment records.
-- Updates balance only if amount_received < net_due, current balance is 0.00, and single payment row exists.
-- UPDATE payments
-- SET balance = :calculated_balance
-- WHERE payment_id = :target_payment_id
--   AND balance = 0.00;

-- Forensic Audit Logging for Phase 2
-- INSERT INTO audit_logs (action_type, module, table_name, record_id, user_id, username, role, old_values, new_values, created_at)
-- VALUES ('REMEDIATION_UPDATE', 'Payments', 'payments', :target_payment_id, 1, 'owner', 'owner', :old_val, :new_val, NOW());


-- -------------------------------------------------------------------------
-- PHASE 3: HOLLOW ORDER SHOE ITEM & SERVICE RECONSTRUCTION (DETERMINISTIC KEYS)
-- -------------------------------------------------------------------------
-- Reconstructs shoes using deterministic manifest keys: RECON-{order_id}-P{pair_idx}
-- Prevents dropping multi-pair items (Pairs 1 to 5) and avoids duplicate creation.
-- INSERT INTO items (order_id, brand, shoe_model, quantity, item_notes, status)
-- SELECT :order_id, :brand, :shoe_model, 1, :item_notes, 'on-going'
-- WHERE NOT EXISTS (
--     SELECT 1 FROM items 
--     WHERE order_id = :order_id AND item_notes LIKE :manifest_pattern
-- )
-- RETURNING item_id;

-- INSERT INTO item_service_mapping (item_id, service_id, actual_price)
-- VALUES (:item_id, :service_id, :actual_price)
-- ON CONFLICT (item_id, service_id) DO NOTHING;


-- -------------------------------------------------------------------------
-- PHASE 4: UNENCODED INTAKE ORDERS INGESTION (29 ORDERS)
-- -------------------------------------------------------------------------
-- Ingests 29 unencoded orders with inventory_applied = true and historical timestamps.
-- Disambiguates displaced collisions (ORD-09-07-001, 008-007, 011-009, 012-003) as {order_number}-SRC.
-- INSERT INTO orders (
--     order_number, customer_id, status_id, priority_id, grand_total,
--     expected_at, user_id, inventory_applied, cancellation_stage, discount_amount,
--     created_at, updated_at
-- )
-- SELECT :target_ord_num, :customer_id, 1, 1, :grand_total, :hist_created, 1, true, NULL, 0.0, :hist_created, NOW()
-- WHERE NOT EXISTS (
--     SELECT 1 FROM orders WHERE order_number = :target_ord_num
-- )
-- RETURNING order_id;

-- INSERT INTO payments (
--     order_id, method_id, status_id, amount_received, balance, reference_no, created_at
-- )
-- SELECT :new_order_id, 1, :payment_status, :downpayment, :balance, :reference_no, :hist_created
-- WHERE NOT EXISTS (
--     SELECT 1 FROM payments WHERE order_id = :new_order_id
-- );

COMMIT;
