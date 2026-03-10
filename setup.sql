-- ====================================================================
-- SHOELOTSKEY SERVICE MANAGEMENT SYSTEM (SMS) - DATABASE SETUP SCRIPT
-- ====================================================================
-- This script contains the finalized database schema and seed data.
-- Compatible with PostgreSQL (Heroku) and MySQL/MariaDB (phpMyAdmin).
--
-- INSTRUCTIONS:
-- 1. For PostgreSQL: Run the script as is. 
-- 2. For MySQL/phpMyAdmin: Uncomment the MySQL-specific lines and comment out PG lines.
-- ====================================================================

-- 1. TABLES DEFINITION

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(20) UNIQUE NOT NULL
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(role_id),
    is_active BOOLEAN DEFAULT TRUE,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status Table
CREATE TABLE IF NOT EXISTS status (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(30) UNIQUE NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services Table
CREATE TABLE IF NOT EXISTS services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(20) DEFAULT 'base', -- PG: ENUM, MySQL: VARCHAR
    description TEXT,
    duration_days INTEGER DEFAULT 0,
    service_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    expense_date TIMESTAMP NOT NULL,
    user_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    status_id INTEGER NOT NULL REFERENCES status(status_id),
    priority VARCHAR(20) DEFAULT 'Regular',
    grand_total DECIMAL(10, 2) NOT NULL,
    expected_at TIMESTAMP NOT NULL,
    released_at TIMESTAMP,
    claimed_at TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items Table
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    brand VARCHAR(50),
    material VARCHAR(50),
    shoe_model VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    item_notes TEXT,
    cond_scratches BOOLEAN DEFAULT FALSE,
    cond_yellowing BOOLEAN DEFAULT FALSE,
    cond_ripsholes BOOLEAN DEFAULT FALSE,
    cond_deepstains BOOLEAN DEFAULT FALSE,
    cond_soleseparation BOOLEAN DEFAULT FALSE,
    cond_wornout BOOLEAN DEFAULT FALSE
);

-- Item-Service Mapping Table (N:M)
CREATE TABLE IF NOT EXISTS item_service_mapping (
    item_id INTEGER REFERENCES items(item_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(service_id),
    actual_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (item_id, service_id)
);

-- Status Log Table
CREATE TABLE IF NOT EXISTS status_log (
    status_log_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    status_id INTEGER NOT NULL REFERENCES status(status_id),
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    payment_method VARCHAR(20) DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'fully-paid',
    amount_received DECIMAL(10, 2) DEFAULT 0.0,
    balance DECIMAL(10, 2) DEFAULT 0.0,
    reference_no VARCHAR(100),
    deposit_amount DECIMAL(10, 2) DEFAULT 0.0
);

-- Deliveries Table
CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    shipping_preference VARCHAR(20) DEFAULT 'pickup',
    delivery_address TEXT,
    delivery_courier VARCHAR(50),
    release_time VARCHAR(20),
    province VARCHAR(100),
    city VARCHAR(100),
    barangay VARCHAR(100),
    zip_code VARCHAR(10)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(20), -- CREATE, UPDATE, DELETE, LOGIN
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSONB, -- PostgreSQL uses JSONB
    new_values JSONB, -- Use JSON for MySQL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 2. SEED DATA

-- Roles
INSERT INTO roles (role_name) VALUES ('owner'), ('staff') ON CONFLICT (role_name) DO NOTHING;

-- Statuses
INSERT INTO status (status_name) VALUES 
('Pending'), ('In Progress'), ('Completed'), ('Cancelled'), ('Claimed')
ON CONFLICT (status_name) DO NOTHING;

-- Default Users (Password: owner123 / staff123)
-- In production, these should be hashed. These are placeholders.
INSERT INTO users (username, email, password_hash, role_id) VALUES 
('owner', 'owner@shoelotskey.com', 'owner123', 1),
('staff', 'staff@shoelotskey.com', 'staff123', 2)
ON CONFLICT (username) DO NOTHING;

-- Master Services
INSERT INTO services (service_name, base_price, category, duration_days, service_code, is_active, sort_order) VALUES
('Basic Cleaning', 325, 'base', 10, 'BCN', TRUE, 1),
('Minor Reglue', 150, 'base', 25, 'MRG', TRUE, 2),
('Full Reglue', 250, 'base', 25, 'FRG', TRUE, 3),
('Color Renewal', 800, 'base', 15, 'CRN', TRUE, 4),
('Undersole', 150, 'addon', 20, 'USL', TRUE, 10),
('Midsole', 150, 'addon', 20, 'MSL', TRUE, 11),
('Minor Restoration', 300, 'addon', 25, 'MRS', TRUE, 12),
('Minor Retouch', 125, 'addon', 5, 'MRT', TRUE, 13),
('Add Glue Layer', 100, 'addon', 2, 'AGL', TRUE, 14),
('Unyellowing', 125, 'addon', 5, 'UNY', TRUE, 15),
('White Paint', 150, 'addon', 0, 'WPT', TRUE, 16),
('2 Colors', 200, 'addon', 0, '2CL', TRUE, 17),
('3 Colors', 300, 'addon', 0, '3CL', TRUE, 18),
('Rush Fee (Basic Cleaning)', 150, 'priority', -5, 'RFC', TRUE, 30),
('Rush Fee (Minor Reglue)', 250, 'priority', 0, 'RFR', FALSE, 31),
('Rush Fee (Full Reglue)', 250, 'priority', 0, 'RFF', FALSE, 32)
ON CONFLICT (service_name) DO NOTHING;
