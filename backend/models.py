"""
DATABASE MODELS - 3NF NORMALIZED & ML READY
===========================================
This module defines the SQLAlchemy ORM models for the Shoelotskey SMS.
Architecture follows 3NF (Third Normal Form) to ensure data integrity.
ML-Specific fields are explicitly labeled for easy feature extraction.
"""

from sqlalchemy import (
    Column, String, Float, Boolean, JSON, Integer, 
    ForeignKey, Text, DateTime, DECIMAL, Enum, TIMESTAMP, Table, text, func
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

# Central base for all ORM classes
Base = declarative_base()

# ==========================================
# 1. LOOKUP TABLES (Strict 3NF Compliance)
# ==========================================
# These tables prevent hardcoded strings and ensure data consistency.

class Role(Base):
    """Stores user permissions (e.g., 'owner', 'staff')."""
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(20), unique=True, nullable=False)
    
    # Relationship to users
    users = relationship("User", back_populates="role")

class Status(Base):
    """Tracks order lifecycle states (e.g., 'Pending', 'In Progress')."""
    __tablename__ = "status"
    status_id = Column(Integer, primary_key=True, autoincrement=True)
    status_name = Column(String(30), unique=True, nullable=False)
    
    # Relationships
    orders = relationship("Order", back_populates="status")
    logs = relationship("StatusLog", back_populates="status")

class Condition(Base):
    """Categorical shoe conditions for ML feature engineering."""
    __tablename__ = "conditions"
    condition_id = Column(Integer, primary_key=True, autoincrement=True)
    condition_name = Column(String(50), unique=True, nullable=False)

# ==========================================
# 2. USERS & CUSTOMERS
# ==========================================

class User(Base):
    """System users with hashed credentials."""
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    role = relationship("Role", back_populates="users")
    orders = relationship("Order", back_populates="processor")
    expenses = relationship("Expense", back_populates="user")
    status_logs = relationship("StatusLog", back_populates="user")

class Customer(Base):
    """Central customer database for CRM and return-user tracking."""
    __tablename__ = "customers"
    customer_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String(100), nullable=False, index=True)
    contact_number = Column(String(20), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationship to history
    orders = relationship("Order", back_populates="customer")

# ==========================================
# 3. SERVICES & EXPENSES
# ==========================================

class Service(Base):
    """Service catalog with base pricing."""
    __tablename__ = "services"
    service_id = Column(Integer, primary_key=True, autoincrement=True)
    service_name = Column(String(100), nullable=False)
    base_price = Column(DECIMAL(10, 2), nullable=False)
    category = Column(Enum('base', 'addon', 'priority', name='service_category_enum'), default='base')
    description = Column(Text, nullable=True)
    duration_days = Column(Integer, default=0)
    service_code = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)

class Expense(Base):
    """Tracks business overhead costs."""
    __tablename__ = "expenses"
    expense_id = Column(Integer, primary_key=True, autoincrement=True)
    amount = Column(DECIMAL(10, 2), nullable=False)
    description = Column(Text)
    expense_date = Column(DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    user = relationship("User", back_populates="expenses")

# ==========================================
# 4. ORDERS (Central Fact Table / ML Source)
# ==========================================

class Order(Base):
    """
    Main Transaction Repository.
    Columns are optimized for machine learning training (Binary & Temporal).
    """
    __tablename__ = "orders"
    order_id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    status_id = Column(Integer, ForeignKey("status.status_id"), nullable=False)
    priority = Column(Enum('Regular', 'Rush', 'Premium', name='order_priority_enum'), default='Regular')
    grand_total = Column(DECIMAL(10, 2), nullable=False)
    
    # --- PAYMENT & SHIPPING ---
    payment_method = Column(String(20), default='cash')
    payment_status = Column(String(20), default='fully-paid')
    shipping_preference = Column(String(20), default='pickup')
    delivery_address = Column(Text, nullable=True)
    delivery_courier = Column(String(50), nullable=True)
    amount_received = Column(DECIMAL(10, 2), default=0.0)
    balance = Column(DECIMAL(10, 2), default=0.0)
    reference_no = Column(String(100), nullable=True)
    # shelf_location removed
    deposit_amount = Column(DECIMAL(10, 2), default=0.0)
    release_time = Column(String(20), nullable=True)
    
    # Address Components
    province = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    barangay = Column(String(100), nullable=True)
    zip_code = Column(String(20), nullable=True)
    
    # --- MACHINE LEARNING FEATURE BLOCK ---
    expected_at = Column(DateTime, nullable=False)  # Prediction Target / Deadline
    released_at = Column(DateTime, nullable=True)   # Actual Outcome (for Error calculation)
    claimed_at = Column(DateTime, nullable=True)    # Handover verification
    # --------------------------------------
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False) # Processing staff
    
    # Relationships (SOLID: Navigation properties)
    customer = relationship("Customer", back_populates="orders")
    status = relationship("Status", back_populates="orders")
    processor = relationship("User", back_populates="orders")
    items = relationship("Item", back_populates="order", cascade="all, delete-orphan")
    status_logs = relationship("StatusLog", back_populates="order")

# ==========================================
# 5. ITEMS & MAPPINGS (Granular ML Features)
# ==========================================

# Junction table for Item <-> Condition (Composite Primary Key)
item_condition_mapping = Table(
    'item_condition_mapping', Base.metadata,
    Column('item_id', Integer, ForeignKey('items.item_id', ondelete="CASCADE"), primary_key=True),
    Column('condition_id', Integer, ForeignKey('conditions.condition_id', ondelete="CASCADE"), primary_key=True)
)

# Junction table for Item <-> Service (Snapshotting prices at order time)
class ItemServiceMapping(Base):
    """Complex mapping to handle dynamic pricing at the moment of order."""
    __tablename__ = "item_service_mapping"
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), primary_key=True)
    service_id = Column(Integer, ForeignKey("services.service_id"), primary_key=True)
    actual_price = Column(DECIMAL(10, 2), nullable=False)

class Item(Base):
    """Granular shoe data - primary input for prediction models."""
    __tablename__ = "items"
    item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    
    # ML Features: Brand, Material, Model
    brand = Column(String(50), index=True)
    material = Column(String(50))
    shoe_model = Column(String(50))
    quantity = Column(Integer, default=1)
    item_notes = Column(Text, nullable=True)
    
    # Multi-valued attributes
    order = relationship("Order", back_populates="items")
    conditions = relationship("Condition", secondary=item_condition_mapping)
    services = relationship("Service", secondary="item_service_mapping")

# ==========================================
# 6. AUDIT TRAIL & ML LOGGING
# ==========================================

class StatusLog(Base):
    """Tracks time spent in each status for ML Lead-time optimization."""
    __tablename__ = "status_log"
    status_log_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    status_id = Column(Integer, ForeignKey("status.status_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    changed_at = Column(TIMESTAMP, server_default=func.now())
    
    order = relationship("Order", back_populates="status_logs")
    status = relationship("Status", back_populates="logs")
    user = relationship("User", back_populates="status_logs")

class AuditLog(Base):
    """System-wide audit trail for security and debugging."""
    __tablename__ = "audit_logs"
    audit_log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action_type = Column(Enum('CREATE', 'UPDATE', 'DELETE', 'LOGIN', name='audit_action_enum'), nullable=False)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)
    old_values = Column(JSON)
    new_values = Column(JSON)
    created_at = Column(TIMESTAMP, server_default=func.now())
