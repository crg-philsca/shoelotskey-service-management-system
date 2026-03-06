from sqlalchemy import Column, String, Float, Boolean, JSON, Integer, ForeignKey, Text, DateTime
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String(255), primary_key=True)
    username = Column(String(255), unique=True, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50)) # owner, staff
    email = Column(String(255))
    active = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    fullName = Column(String(255), nullable=False)
    contactNumber = Column(String(255))
    email = Column(String(255))
    address = Column(Text)
    city = Column(String(255))
    province = Column(String(255))
    # Relationship
    orders = relationship("JobOrder", back_populates="customer")

class Service(Base):
    __tablename__ = "services"
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    basePrice = Column(Float, nullable=False)
    category = Column(String(100)) # base, addon, priority
    active = Column(Boolean, default=True)
    description = Column(Text)
    durationDays = Column(Integer)
    code = Column(String(100))

class JobOrder(Base):
    __tablename__ = "job_orders"
    id = Column(String(255), primary_key=True)
    orderNumber = Column(String(255), unique=True, index=True)
    status = Column(String(100), default="Pending")
    priorityLevel = Column(String(100), default="Standard")
    
    # Financials
    totalAmount = Column(Float, default=0.0)
    amountReceived = Column(Float, default=0.0)
    paymentMethod = Column(String(100))
    paymentStatus = Column(String(100), default="Unpaid")
    
    # ML & Temporal Data
    transactionDate = Column(String(255)) # Feature for seasonal trends
    predictedCompletion = Column(String(255)) # Target variable for ML
    actualCompletion = Column(String(255), nullable=True) # Real outcome for training
    shippingPreference = Column(String(255))
    
    # Foreign Keys
    customerId = Column(Integer, ForeignKey("customers.id"))
    processedBy = Column(String(255), ForeignKey("users.id"))
    
    # Relationships
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    orderId = Column(String(255), ForeignKey("job_orders.id"))
    
    # ML Features (Categorical)
    brand = Column(String(255))
    shoeType = Column(String(255))
    material = Column(String(255))
    quantity = Column(Integer, default=1)
    
    # ML Features (Unstructured/Detailed)
    conditionData = Column(JSON) # Stores state like 'sole_wear', 'stains' etc.
    
    # Relationship
    order = relationship("JobOrder", back_populates="items")

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(String(255), primary_key=True)
    category = Column(String(255))
    amount = Column(Float)
    date = Column(String(255))
    notes = Column(Text)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(String(255))
    userId = Column(String(255), ForeignKey("users.id"))
    action = Column(String(255))
    details = Column(Text)
    logType = Column(String(100))
