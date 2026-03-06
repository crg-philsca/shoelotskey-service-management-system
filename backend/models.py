from sqlalchemy import Column, String, Float, Boolean, JSON, Integer
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class JobOrder(Base):
    __tablename__ = "job_orders"
    id = Column(String, primary_key=True, index=True)
    orderNumber = Column(String, index=True)
    customerName = Column(String)
    contactNumber = Column(String)
    status = Column(String)
    priorityLevel = Column(String)
    
    # Store dynamic nested data (conditions, shoes, history) as JSON
    items = Column(JSON)
    condition = Column(JSON)
    statusHistory = Column(JSON)
    baseService = Column(JSON)
    addOns = Column(JSON)
    
    # Pricing
    baseServiceFee = Column(Float)
    addOnsTotal = Column(Float)
    grandTotal = Column(Float)
    amountReceived = Column(Float, nullable=True)
    change = Column(Float, nullable=True)
    paymentMethod = Column(String)
    paymentStatus = Column(String)
    
    # Details
    brand = Column(String)
    shoeType = Column(String)
    shoeMaterial = Column(String)
    quantity = Column(Integer)
    
    # Shipping
    shippingPreference = Column(String)
    deliveryAddress = Column(String, nullable=True)
    deliveryCourier = Column(String, nullable=True)
    province = Column(String, nullable=True)
    city = Column(String, nullable=True)
    barangay = Column(String, nullable=True)
    zipCode = Column(String, nullable=True)
    
    # Meta
    transactionDate = Column(String)
    predictedCompletionDate = Column(String, nullable=True)
    actualCompletionDate = Column(String, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String)
    processedBy = Column(String)
    claimedBy = Column(String, nullable=True)
    assignedTo = Column(String, nullable=True)
    releaseTime = Column(String, nullable=True)

class Service(Base):
    __tablename__ = "services"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    category = Column(String) # base, addon, priority
    active = Column(Boolean, default=True)
    description = Column(String, nullable=True)
    durationDays = Column(String, nullable=True) # could be int or string like "-1"
    code = Column(String, nullable=True)

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(String, primary_key=True, index=True)
    category = Column(String)
    amount = Column(Float)
    date = Column(String)
    notes = Column(String, nullable=True)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(String, primary_key=True, index=True)
    timestamp = Column(String)
    user = Column(String)
    action = Column(String)
    details = Column(String)
    type = Column(String) # 'service', 'order', 'system', 'expense'

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    role = Column(String)
    email = Column(String, nullable=True)
    password = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
