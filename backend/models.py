from sqlalchemy import Column, String, Float, Boolean, JSON, Integer, ForeignKey, Text, DateTime, DECIMAL, Enum, TIMESTAMP, Table, text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

# ==========================================
# 1. LOOKUP TABLES
# ==========================================

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(20), unique=True, nullable=False)
    users = relationship("User", back_populates="role")

class Status(Base):
    __tablename__ = "status"
    status_id = Column(Integer, primary_key=True, autoincrement=True)
    status_name = Column(String(30), unique=True, nullable=False)
    orders = relationship("Order", back_populates="status")
    logs = relationship("StatusLog", back_populates="status")

class Condition(Base):
    __tablename__ = "conditions"
    condition_id = Column(Integer, primary_key=True, autoincrement=True)
    condition_name = Column(String(50), unique=True, nullable=False)
    # item_condition_mapping relationship defined below via secondary table

# ==========================================
# 2. USERS & CUSTOMERS
# ==========================================

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    
    role = relationship("Role", back_populates="users")
    orders = relationship("Order", back_populates="processor")
    expenses = relationship("Expense", back_populates="user")
    status_logs = relationship("StatusLog", back_populates="user")

class Customer(Base):
    __tablename__ = "customers"
    customer_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String(100), nullable=False)
    contact_number = Column(String(20), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    
    orders = relationship("Order", back_populates="customer")

# ==========================================
# 3. SERVICES & EXPENSES
# ==========================================

class Service(Base):
    __tablename__ = "services"
    service_id = Column(Integer, primary_key=True, autoincrement=True)
    service_name = Column(String(100), nullable=False)
    base_price = Column(DECIMAL(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)

class Expense(Base):
    __tablename__ = "expenses"
    expense_id = Column(Integer, primary_key=True, autoincrement=True)
    amount = Column(DECIMAL(10, 2), nullable=False)
    description = Column(Text)
    expense_date = Column(DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    
    user = relationship("User", back_populates="expenses")

# ==========================================
# 4. ORDERS
# ==========================================

class Order(Base):
    __tablename__ = "orders"
    order_id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False)
    status_id = Column(Integer, ForeignKey("status.status_id"), nullable=False)
    priority = Column(Enum('Regular', 'Rush'), default='Regular')
    grand_total = Column(DECIMAL(10, 2), nullable=False)
    
    # Machine Learning Features
    expected_at = Column(DateTime, nullable=False)
    released_at = Column(DateTime, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    updated_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    
    customer = relationship("Customer", back_populates="orders")
    status = relationship("Status", back_populates="orders")
    processor = relationship("User", back_populates="orders")
    items = relationship("Item", back_populates="order", cascade="all, delete-orphan")
    status_logs = relationship("StatusLog", back_populates="order")

# ==========================================
# 5. ITEMS & MAPPINGS
# ==========================================

# Junction table for Item <-> Condition
item_condition_mapping = Table(
    'item_condition_mapping', Base.metadata,
    Column('item_id', Integer, ForeignKey('items.item_id', ondelete="CASCADE"), primary_key=True),
    Column('condition_id', Integer, ForeignKey('conditions.condition_id', ondelete="CASCADE"), primary_key=True)
)

# Junction table for Item <-> Service (contains extra data: actual_price)
class ItemServiceMapping(Base):
    __tablename__ = "item_service_mapping"
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), primary_key=True)
    service_id = Column(Integer, ForeignKey("services.service_id"), primary_key=True)
    actual_price = Column(DECIMAL(10, 2), nullable=False)

class Item(Base):
    __tablename__ = "items"
    item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    brand = Column(String(50))
    material = Column(String(50))
    
    order = relationship("Order", back_populates="items")
    conditions = relationship("Condition", secondary=item_condition_mapping)
    services = relationship("Service", secondary="item_service_mapping")

# ==========================================
# 6. AUDIT TRAIL & LOGGING
# ==========================================

class StatusLog(Base):
    __tablename__ = "status_log"
    status_log_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    status_id = Column(Integer, ForeignKey("status.status_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    changed_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    
    order = relationship("Order", back_populates="status_logs")
    status = relationship("Status", back_populates="logs")
    user = relationship("User", back_populates="status_logs")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    audit_log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action_type = Column(Enum('CREATE', 'UPDATE', 'DELETE', 'LOGIN'), nullable=False)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)
    old_values = Column(JSON)
    new_values = Column(JSON)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
