"""
SHOE LOTSKEY SMS - MAIN API ENTRY
=================================
FastAPI backend for 3NF normalized service management.
Implements security, order processing, and lookups.
Includes diagnostic logging for easy debugging during the Defenses.
"""

from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid
import json
import sys

# Internal Imports
from models import (
    Base, Order, Item, Service, Expense, StatusLog, 
    User, Customer, Role, Status, Condition, AuditLog, ItemServiceMapping
)
from schemas import (
    OrderSchema, ServiceSchema, ExpenseSchema, UserSchema, LoginRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, RoleSchema, StatusSchema, 
    ConditionSchema, ItemSchema
)
from database import engine, get_db, SessionLocal

# ==========================================
# 0. INITIALIZATION
# ==========================================

# Initialize FastAPI app first to avoid NameErrors
app = FastAPI(
    title="Shoelotskey 3NF & ML SMS",
    description="Backend API for Normalized Service Management",
    version="2.0.0"
)

# Configure CORS for React compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local defense, restrict for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. DATA SEEDING (S.O.L.I.D: Single Responsibility)
# ==========================================

def seed_lookups(db: Session):
    """Diagnose and seed essential database static data."""
    print(">>> Diagnostic: Checking lookup data...")
    
    # Seed Roles
    if db.query(Role).count() == 0:
        print(">>> Seeding Roles...")
        roles = [Role(role_name="owner"), Role(role_name="staff")]
        db.add_all(roles)
        db.commit()

    # Seed Statuses
    if db.query(Status).count() == 0:
        print(">>> Seeding Statuses...")
        statuses = [
            Status(status_name="Pending"),
            Status(status_name="In Progress"),
            Status(status_name="Completed"),
            Status(status_name="Cancelled"),
            Status(status_name="Claimed")
        ]
        db.add_all(statuses)
        db.commit()

    # Seed Conditions (ML Ready)
    if db.query(Condition).count() == 0:
        print(">>> Seeding ML Conditions...")
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
        print(">>> Seeding Service Catalog...")
        services = [
            Service(service_name="Basic Cleaning", base_price=325.00),
            Service(service_name="Unyellowing", base_price=125.00),
            Service(service_name="Full Reglue", base_price=250.00),
            Service(service_name="Deep Cleaning", base_price=450.00)
        ]
        db.add_all(services)
        db.commit()

    # Seed Default Users (owner/staff)
    if db.query(User).count() == 0:
        print(">>> Seeding Default Accounts...")
        role_owner = db.query(Role).filter(Role.role_name == "owner").first()
        role_staff = db.query(Role).filter(Role.role_name == "staff").first()
        if role_owner:
            owner = User(username="owner", email="owner@shoelotskey.com", password_hash="owner123", role_id=role_owner.role_id)
            db.add(owner)
        if role_staff:
            staff = User(username="staff", email="staff@shoelotskey.com", password_hash="staff123", role_id=role_staff.role_id)
            db.add(staff)
        db.commit()

@app.on_event("startup")
def startup_event():
    """Triggered when the server starts - ensures DB integrity."""
    print("\n-------------------------------------------")
    print("BACKEND BOOT: Initializing Shoelotskey SMS")
    print("-------------------------------------------")
    try:
        # Create all tables securely (IF NOT EXISTS)
        Base.metadata.create_all(bind=engine)
        print("DB Integrity: All tables verified.")
        
        db = SessionLocal()
        try:
            seed_lookups(db)
            print("DB Initialization: Bootstrap check complete.")
        finally:
            db.close()
    except Exception as e:
        print(f"[FATAL STARTUP ERROR] {e}")
        # Server will still start but API might fail - better for debugging than a silent crash

# ==========================================
# 2. AUTHENTICATION & SECURITY
# ==========================================

@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates users and returns session details."""
    print(f"[AUTH] Login attempt for: {request.username}")
    
    # Query with joinedload for role info to avoid N+1 problem (S.O.L.I.D Efficiency)
    db_user = db.query(User).options(joinedload(User.role)).filter(User.username == request.username).first()
    
    if not db_user:
        print(f"[AUTH] Failed: User '{request.username}' not found.")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if db_user.password_hash == request.password:
        print(f"[AUTH] Success: Logged in as {db_user.username} ({db_user.role.role_name})")
        return {
            "user_id": db_user.user_id,
            "username": db_user.username,
            "role": db_user.role.role_name,
            "email": db_user.email
        }
    else:
        print(f"[AUTH] Failed: Incorrect password for user '{request.username}'")
        raise HTTPException(status_code=401, detail="Invalid username or password")

# ==========================================
# 3. JOB ORDERS (Complex 3NF Normalization)
# ==========================================

@app.get("/api/orders", response_model=List[OrderSchema])
def read_orders(db: Session = Depends(get_db)):
    """Retrieves all orders with full 3NF hydration (Customer, Items, Status)."""
    print("[QUERY] Fetching Order history...")
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
    S.O.L.I.D Complexity: Multi-step 3NF Order Creation.
    1. Resolve Customer Identity
    2. Resolve Lifecycle Status
    3. Persist Order Header
    4. Persist Item Features (ML Ready)
    5. Persistence Snapshot for Pricing
    """
    print(f"[TRANS] Creating new Job Order for: {order_data.get('customerName')}")
    try:
        # Step 1: Customer Normalization (Avoid Duplicates)
        customer_name = order_data.get("customerName", "Guest")
        contact = order_data.get("contactNumber", "0000000000")
        db_customer = db.query(Customer).filter(
            Customer.customer_name == customer_name, 
            Customer.contact_number == contact
        ).first()
        
        if not db_customer:
            print(f"[TRANS] Registering new customer: {customer_name}")
            db_customer = Customer(customer_name=customer_name, contact_number=contact)
            db.add(db_customer)
            db.flush() # Ensure ID is generated for FK use

        # Step 2: Resolve Order Status
        status_name = order_data.get("status", "Pending")
        db_status = db.query(Status).filter(Status.status_name == status_name).first()
        if not db_status:
            db_status = db.query(Status).first()

        # Step 3: Persistence - Order Header
        db_order = Order(
            order_number=order_data.get("orderNumber") or str(uuid.uuid4())[:8].upper(),
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority=order_data.get("priorityLevel") if order_data.get("priorityLevel") in ['Regular', 'Rush'] else 'Regular',
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=datetime.utcnow() + timedelta(days=7), # Default ML Lead-time
            user_id=1 # Default system user ID
        )
        db.add(db_order)
        db.flush()

        # Step 4: Persistence - Item Granularity (ML Features)
        brand = order_data.get("brand")
        material = order_data.get("shoeMaterial")
        if brand or material:
            db_item = Item(order_id=db_order.order_id, brand=brand, material=material)
            db.add(db_item)
            db.flush()
            
            # Associate default conditions for training
            default_cond = db.query(Condition).first()
            if default_cond:
                db_item.conditions.append(default_cond)
            
            # Snap Pricing History
            default_service = db.query(Service).first()
            if default_service:
                pricing = ItemServiceMapping(
                    item_id=db_item.item_id, 
                    service_id=default_service.service_id, 
                    actual_price=default_service.base_price
                )
                db.add(pricing)

        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Job Order {db_order.order_number} created.")
        return db_order
        
    except Exception as e:
        print(f"[TRANS ERROR] Order creation failed: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Transaction failure: {str(e)}")

# ==========================================
# 4. LOOKUPS & UTILITIES (Read-Only Endpoints)
# ==========================================

@app.get("/api/services", response_model=List[ServiceSchema])
def get_catalog(db: Session = Depends(get_db)):
    """Returns the available service catalog with real-time pricing."""
    return db.query(Service).all()

@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def get_statuses(db: Session = Depends(get_db)):
    """Returns all order lifecycle statuses for UI drop-downs."""
    return db.query(Status).all()

@app.get("/api/lookups/conditions", response_model=List[ConditionSchema])
def get_ml_features(db: Session = Depends(get_db)):
    """Returns all ML-mapped conditions for form selections."""
    return db.query(Condition).all()

# EOF: Backend Entry Point
