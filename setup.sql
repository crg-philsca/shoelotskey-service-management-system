-- ====================================================================
-- SHOELOTSKEY SERVICE MANAGEMENT SYSTEM (SMS) - FINALIZED 3NF SCHEMA
-- ====================================================================
-- Compatible with PostgreSQL (Heroku) and MySQL/MariaDB (phpMyAdmin).
-- This script enforces Third Normal Form (3NF) for maximum data integrity.
--
-- INSTRUCTIONS FOR MYSQL/PHPMYADMIN Users:
-- Replace 'SERIAL' with 'INT AUTO_INCREMENT'
-- Replace 'JSONB' with 'JSON'
-- Replace 'ON CONFLICT DO NOTHING' with 'IGNORE' (within INTENT TO INSERT)
-- ====================================================================

-- ====================================================================
-- SECTION 0: DATA MIGRATION (Run this FIRST on existing databases)
-- Renames old Title-Case lookup values to lowercase frontend-matching values.
-- Safe to run multiple times - only changes rows that still have old values.
-- ====================================================================

-- 0.1 STATUS MIGRATION (old -> new)
UPDATE status SET status_name = 'new-order'    WHERE status_name = 'Pending';
UPDATE status SET status_name = 'on-going'     WHERE status_name = 'In Progress';
UPDATE status SET status_name = 'for-release'  WHERE status_name = 'Completed';
UPDATE status SET status_name = 'claimed'      WHERE status_name = 'Claimed';
UPDATE status SET status_name = 'cancelled'    WHERE status_name = 'Cancelled';

-- 0.2 PRIORITY LEVELS MIGRATION
UPDATE priority_levels SET priority_name = 'regular' WHERE priority_name = 'Regular';
UPDATE priority_levels SET priority_name = 'rush'    WHERE priority_name = 'Rush';
UPDATE priority_levels SET priority_name = 'premium' WHERE priority_name = 'Premium';

-- 0.3 PAYMENT METHODS MIGRATION
UPDATE payment_methods SET method_name = 'cash'          WHERE method_name = 'Cash';
UPDATE payment_methods SET method_name = 'gcash'         WHERE method_name = 'GCash';
UPDATE payment_methods SET method_name = 'bank-transfer' WHERE method_name = 'Bank Transfer';

-- 0.4 PAYMENT STATUSES MIGRATION
UPDATE payment_statuses SET status_name = 'fully-paid'   WHERE status_name = 'Fully Paid';
UPDATE payment_statuses SET status_name = 'downpayment'  WHERE status_name = 'Downpayment';
UPDATE payment_statuses SET status_name = 'pending'      WHERE status_name = 'Pending';

-- 0.5 SHIPPING PREFERENCES MIGRATION
UPDATE shipping_preferences SET pref_name = 'pickup'   WHERE pref_name = 'Pickup';
UPDATE shipping_preferences SET pref_name = 'delivery' WHERE pref_name = 'Delivery';

-- ====================================================================
-- END MIGRATION SECTION
-- ====================================================================

-- 1. LOOKUP TABLES (3NF - Categorical Data)

CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS status (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS service_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS conditions (
    condition_id SERIAL PRIMARY KEY,
    condition_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_methods (
    method_id SERIAL PRIMARY KEY,
    method_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_statuses (
    p_status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_preferences (
    pref_id SERIAL PRIMARY KEY,
    pref_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS priority_levels (
    priority_id SERIAL PRIMARY KEY,
    priority_name VARCHAR(50) UNIQUE NOT NULL
);

-- 2. CORE SYSTEM TABLES

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(role_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    category_id INTEGER REFERENCES service_categories(category_id),
    description TEXT,
    duration_days INTEGER DEFAULT 0,
    service_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    expense_date TIMESTAMP NOT NULL,
    user_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    status_id INTEGER NOT NULL REFERENCES status(status_id),
    priority_id INTEGER NOT NULL REFERENCES priority_levels(priority_id),
    grand_total DECIMAL(10, 2) NOT NULL,
    expected_at TIMESTAMP NOT NULL,
    released_at TIMESTAMP,
    claimed_at TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TRANSACTIONS & SHIPPING

CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    method_id INTEGER NOT NULL REFERENCES payment_methods(method_id),
    status_id INTEGER NOT NULL REFERENCES payment_statuses(p_status_id),
    amount_received DECIMAL(10, 2) DEFAULT 0.0,
    balance DECIMAL(10, 2) DEFAULT 0.0,
    reference_no VARCHAR(100),
    deposit_amount DECIMAL(10, 2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    pref_id INTEGER NOT NULL REFERENCES shipping_preferences(pref_id),
    delivery_address TEXT,
    delivery_courier VARCHAR(50),
    release_time VARCHAR(20),
    province VARCHAR(100),
    city VARCHAR(100),
    barangay VARCHAR(100),
    zip_code VARCHAR(20)
);

-- 4. ITEMS & BRIDGE TABLES (ML-Ready Granularity)

CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    brand VARCHAR(50),
    material VARCHAR(50),
    shoe_model VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    item_notes TEXT
);

CREATE TABLE IF NOT EXISTS item_service_mapping (
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(service_id),
    actual_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (item_id, service_id)
);

CREATE TABLE IF NOT EXISTS item_condition_mapping (
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    condition_id INTEGER REFERENCES conditions(condition_id),
    PRIMARY KEY (item_id, condition_id)
);

CREATE TABLE IF NOT EXISTS status_log (
    status_log_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    status_id INTEGER NOT NULL REFERENCES status(status_id),
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(20), 
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSON, -- Universal JSON type support
    new_values JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. INITIAL SEED DATA (Lookup Values)

-- Roles
INSERT INTO roles (role_name) VALUES ('owner'), ('staff');

-- Statuses (must match frontend JobStatus: 'new-order' | 'on-going' | 'for-release' | 'claimed')
INSERT INTO status (status_name) VALUES ('new-order'), ('on-going'), ('for-release'), ('claimed'), ('cancelled');

-- Service Categories (must match frontend: 'base' | 'addon' | 'priority')
INSERT INTO service_categories (category_name) VALUES ('base'), ('addon'), ('priority');

-- Conditions
INSERT INTO conditions (condition_name) VALUES ('Scratches'), ('Yellowing'), ('Rips/Holes'), ('Deep Stains'), ('Sole Separation'), ('Worn Out');

-- Payment Methods (must match frontend: 'cash' | 'gcash' | 'bank-transfer')
INSERT INTO payment_methods (method_name) VALUES ('cash'), ('gcash'), ('bank-transfer');

-- Payment Statuses (must match frontend: 'fully-paid' | 'downpayment')
INSERT INTO payment_statuses (status_name) VALUES ('fully-paid'), ('downpayment'), ('pending');

-- Shipping Preferences (must match frontend: 'pickup' | 'delivery')
INSERT INTO shipping_preferences (pref_name) VALUES ('pickup'), ('delivery');

-- Priority Levels (must match frontend: 'regular' | 'rush' | 'premium')
INSERT INTO priority_levels (priority_name) VALUES ('regular'), ('rush'), ('premium');

-- Default Users
INSERT INTO users (username, email, password_hash, role_id) VALUES 
('owner', 'owner@shoelotskey.com', 'owner123', 1),
('staff', 'staff@shoelotskey.com', 'staff123', 2);

-- Standard Services (Initial Sync)
INSERT INTO services (service_name, base_price, category_id, duration_days, service_code, sort_order) VALUES
('Basic Cleaning', 325, 1, 10, 'BCN', 1),
('Minor Reglue', 150, 1, 25, 'MRG', 2),
('Full Reglue', 250, 1, 25, 'FRG', 3),
('Color Renewal', 800, 1, 15, 'CRN', 4),
('Undersole', 150, 2, 20, 'USL', 10),
('Midsole', 150, 2, 20, 'MSL', 11),
('Minor Restoration', 300, 2, 25, 'MRS', 12),
('Minor Retouch', 125, 2, 5, 'MRT', 13),
('Add Glue Layer', 100, 2, 2, 'AGL', 14),
('Unyellowing', 125, 2, 5, 'UNY', 15),
('White Paint', 150, 2, 0, 'WPT', 16),
('2 Colors', 200, 2, 0, '2CL', 17),
('3 Colors', 300, 2, 0, '3CL', 18),
('Rush Fee (Basic Cleaning)', 150, 3, -5, 'RFC', 30);
