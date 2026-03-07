from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid
import json

from models import Base, Order, Item, Service, Expense, StatusLog, User, Customer, Role, Status, Condition, AuditLog, ItemServiceMapping
from schemas import (
    OrderSchema, ServiceSchema, ExpenseSchema, UserSchema, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest,
    RoleSchema, StatusSchema, ConditionSchema, ItemSchema
)
from database import engine, get_db, SessionLocal

# ==========================================
# 0. DATABASE INITIALIZATION & SEEDING (on startup only)
# ==========================================

def seed_lookups(db: Session):
    # Seed Roles
    if db.query(Role).count() == 0:
        roles = [Role(role_name="owner"), Role(role_name="staff")]
        db.add_all(roles)
        db.commit()

    # Seed Statuses
    if db.query(Status).count() == 0:
        statuses = [
            Status(status_name="Pending"),
            Status(status_name="In Progress"),
            Status(status_name="Completed"),
            Status(status_name="Cancelled"),
            Status(status_name="Claimed")
        ]
        db.add_all(statuses)
        db.commit()

    # Seed Conditions
    if db.query(Condition).count() == 0:
        conditions = [
            Condition(condition_name="Good Condition"),
            Condition(condition_name="Stains Detected"),
            Condition(condition_name="Sole Wear Detected"),
            Condition(condition_name="Color Discloration"),
            Condition(condition_name="Regluing Required")
        ]
        db.add_all(conditions)
        db.commit()

    # Seed Services
    if db.query(Service).count() == 0:
        services = [
            Service(service_name="Basic Cleaning", base_price=325.00),
            Service(service_name="Unyellowing", base_price=125.00),
            Service(service_name="Full Reglue", base_price=250.00),
            Service(service_name="Deep Cleaning", base_price=450.00)
        ]
        db.add_all(services)
        db.commit()

    # Seed Users
    if db.query(User).count() == 0:
        role_owner = db.query(Role).filter(Role.role_name == "owner").first()
        role_staff = db.query(Role).filter(Role.role_name == "staff").first()
        if role_owner:
            owner = User(username="owner", email="owner@shoelotskey.com", password_hash="owner123", role_id=role_owner.role_id)
            db.add(owner)
        if role_staff:
            staff = User(username="staff", email="staff@shoelotskey.com", password_hash="staff123", role_id=role_staff.role_id)
            db.add(staff)
        db.commit()

app = FastAPI(title="Shoelotskey 3NF & ML Aligned API")

@app.on_event("startup")
def startup_event():
    print("Backend Starting...")
    try:
        # Create all tables securely (IF NOT EXISTS)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_lookups(db)
            print("Database initialization complete.")
        finally:
            db.close()
    except Exception as e:
        print(f"Startup Notification: Server starting (Re-using existing DB): {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. AUTHENTICATION & SECURITY
# ==========================================

@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    print(f"Login attempt for user: {request.username}")
    db_user = db.query(User).options(joinedload(User.role)).filter(User.username == request.username).first()
    if not db_user:
        print(f"Login failed: User {request.username} not found")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if db_user.password_hash == request.password:
        print(f"Login success: {request.username}")
        return {
            "user_id": db_user.user_id,
            "username": db_user.username,
            "role": db_user.role.role_name,
            "email": db_user.email
        }
    else:
        print(f"Login failed: Incorrect password for {request.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

# ==========================================
# 2. JOB ORDERS (Complex 3NF Logic)
# ==========================================

@app.get("/api/orders", response_model=List[OrderSchema])
def read_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).options(
        joinedload(Order.customer), 
        joinedload(Order.status), 
        joinedload(Order.items).joinedload(Item.conditions),
        joinedload(Order.items).joinedload(Item.services)
    ).all()
    return orders

@app.post("/api/orders", response_model=OrderSchema)
def create_order(order_data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Complex 3NF Order Creation:
    1. Handle Customer (Find/Create)
    2. Handle Status (Lookup)
    3. Create Order
    4. Handle Items, conditions, and services
    5. Audit logging (Triggers handle DB level, we can add logic if needed)
    """
    try:
        # 1. Handle Customer
        customer_name = order_data.get("customerName", "Unknown")
        contact = order_data.get("contactNumber", "")
        db_customer = db.query(Customer).filter(Customer.customer_name == customer_name, Customer.contact_number == contact).first()
        if not db_customer:
            db_customer = Customer(customer_name=customer_name, contact_number=contact)
            db.add(db_customer)
            db.flush()

        # 2. Get Status
        status_name = order_data.get("status", "Pending")
        db_status = db.query(Status).filter(Status.status_name == status_name).first()
        if not db_status:
            db_status = db.query(Status).first()

        # 3. Create Order
        db_order = Order(
            order_number=order_data.get("orderNumber") or str(uuid.uuid4())[:8],
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority=order_data.get("priorityLevel") if order_data.get("priorityLevel") in ['Regular', 'Rush'] else 'Regular',
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=datetime.utcnow() + timedelta(days=order_data.get("durationDays", 7)),
            user_id=order_data.get("userId", 1) # Authenticated user ID
        )
        db.add(db_order)
        db.flush()

        # 4. Handle Items (Assuming data from UI format)
        brand = order_data.get("brand")
        material = order_data.get("shoeMaterial")
        if brand or material:
            db_item = Item(order_id=db_order.order_id, brand=brand, material=material)
            db.add(db_item)
            db.flush()
            
            # Map default condition if possible
            cond = db.query(Condition).first()
            if cond:
                db_item.conditions.append(cond)
            
            # Map services
            # (In a real 3NF flow, you'd iterate through selected services from UI)
            # This is a demo fallback:
            serv = db.query(Service).first()
            if serv:
                mapping = ItemServiceMapping(item_id=db_item.item_id, service_id=serv.service_id, actual_price=serv.base_price)
                db.add(mapping)

        db.commit()
        db.refresh(db_order)
        return db_order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Creation failure: {str(e)}")

# ==========================================
# 3. UTILITIES & LOOKUPS
# ==========================================

@app.get("/api/services", response_model=List[ServiceSchema])
def read_services(db: Session = Depends(get_db)):
    return db.query(Service).all()

@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def read_statuses(db: Session = Depends(get_db)):
    return db.query(Status).all()

@app.get("/api/lookups/conditions", response_model=List[ConditionSchema])
def read_conditions(db: Session = Depends(get_db)):
    return db.query(Condition).all()
