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
# 0.5 STARTUP HANDLERS
# ==========================================

@app.on_event("startup")
def on_startup():
    """Logic executed when the server starts."""
    print(">>> System Boot: Initializing Database Schema...")
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Seed lookup data
    db = SessionLocal()
    try:
        seed_lookups(db)
        print(">>> System Boot: Database ready.")
    finally:
        db.close()

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

    # Seed Conditions (Sync with UI Keys)
    if db.query(Condition).count() == 0:
        print(">>> Seeding ML Conditions...")
        conditions = [
            Condition(condition_name="scratches"),
            Condition(condition_name="yellowing"),
            Condition(condition_name="ripsholes"),
            Condition(condition_name="deepstains"),
            Condition(condition_name="soleseparation"),
            Condition(condition_name="wornout")
        ]
        db.add_all(conditions)
        db.commit()

    # Seed Services (Fully Normalized with Metadata)
    if db.query(Service).count() == 0:
        print(">>> Seeding Complete Service Catalog...")
        services = [
            # Base Services
            Service(service_name="Basic Cleaning", base_price=325, category="base", duration_days=10, service_code="BCN"),
            Service(service_name="Deep Cleaning", base_price=450, category="base", duration_days=12, service_code="DCN"),
            Service(service_name="Full Reglue", base_price=250, category="base", duration_days=25, service_code="FRG"),
            Service(service_name="Minor Reglue", base_price=150, category="base", duration_days=25, service_code="MRG"),
            Service(service_name="Color Renewal", base_price=800, category="base", duration_days=15, service_code="CRN"),
            
            # Add-ons
            Service(service_name="Unyellowing", base_price=125, category="addon", duration_days=5, service_code="UNY"),
            Service(service_name="Repainting", base_price=500, category="addon", duration_days=0, service_code="RPT"),
            Service(service_name="Shoe Lace Replacement", base_price=50, category="addon", duration_days=0, service_code="SLR"),
            Service(service_name="White Paint", base_price=150, category="addon", duration_days=0, service_code="WPT"),
            Service(service_name="Minor Retouch", base_price=125, category="addon", duration_days=0, service_code="MRT"),
            
            # Priority
            Service(service_name="Rush Fee (Basic Cleaning)", base_price=150, category="priority", duration_days=-5, service_code="RFC"),
            Service(service_name="Rush Fee (Minor Reglue)", base_price=250, category="priority", duration_days=0, service_code="RFR")
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
    """
    LOGIC: User Authentication
    1. Query User + Related Role (3NF joinedload)
    2. Verify Password (currently plaintext comparison, ready for hashing)
    3. Return Sanitized Session Data
    """
    print(f"[AUTH] Trace: Login attempt for '{request.username}'")
    
    try:
        # 1. FETCH USER (Include Role for Authorization - S.O.L.I.D Efficiency)
        db_user = db.query(User).options(joinedload(User.role)).filter(User.username == request.username).first()
        
        if not db_user:
            print(f"[AUTH] Denied: User '{request.username}' not found.")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # 2. VALIDATION (Security Checkpoint)
        if db_user.password_hash == request.password:
            print(f"[AUTH] Granted: {db_user.username} authenticated as {db_user.role.role_name}.")
            return {
                "user_id": db_user.user_id,
                "username": db_user.username,
                "role": db_user.role.role_name,
                "email": db_user.email
            }
        else:
            print(f"[AUTH] Denied: Password mismatch for user '{request.username}'.")
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FATAL ERROR] Auth System Failure: {e}")
        raise HTTPException(status_code=500, detail="Internal Authentication Error")

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
        joinedload(Order.processor),
        joinedload(Order.status_logs).joinedload(StatusLog.status),
        joinedload(Order.status_logs).joinedload(StatusLog.user),
        joinedload(Order.items).joinedload(Item.conditions),
        joinedload(Order.items).joinedload(Item.services)
    ).order_by(Order.created_at.desc()).all()

    return orders

@app.post("/api/orders", response_model=OrderSchema)
def create_order(order_data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    ENDPOINT: Create Job Order
    LOGIC:
    1. Customer Normalization: Reuses existing customer records or creates new ones.
    2. Status Resolution: Maps frontend status to backend lookup table labels.
    3. Order Header: Persists central order details including priority and expected dates.
    4. Multi-Item Breakdown: Processes each shoe as a separate Item linked to the Order.
    5. Feature Extraction: Associates ML-ready conditions and dynamic service pricing snapshots.
    """
    print(f"[TRANS] Creating new Job Order for: {order_data.get('customerName')}")
    try:
        # Step 1: Customer Normalization
        customer_name = order_data.get("customerName", "Guest")
        contact = order_data.get("contactNumber", "0000000000")
        db_customer = db.query(Customer).filter(
            Customer.customer_name == customer_name, 
            Customer.contact_number == contact
        ).first()
        
        if not db_customer:
            db_customer = Customer(customer_name=customer_name, contact_number=contact)
            db.add(db_customer)
            db.flush()

        # Step 2: Resolve Order Status
        status_name = order_data.get("status", "Pending")
        # Map frontend 'new-order' to backend 'Pending'
        status_map = {"new-order": "Pending", "on-going": "In Progress", "for-release": "Completed", "claimed": "Claimed"}
        mapped_status = status_map.get(status_name, "Pending")

        db_status = db.query(Status).filter(Status.status_name == mapped_status).first()
        if not db_status:
            db_status = db.query(Status).first()

        # Step 3: Persistence - Order Header
        priority_val = str(order_data.get("priorityLevel", "Regular")).capitalize()
        if priority_val not in ["Regular", "Rush"]: priority_val = "Regular"

        # Predicted Completion Handling (ML Output Integration)
        # We parse the ISO date provided by the frontend's ML-based estimation logic.
        expected_iso = order_data.get("predictedCompletionDate")
        if expected_iso:
            try:
                # Normalizing UTC format for DB persistence
                expected_dt = datetime.fromisoformat(expected_iso.replace('Z', '+00:00'))
            except Exception:
                # Safety fallback to default 7-day turnaround if parsing fails
                expected_dt = datetime.now() + timedelta(days=7)
        else:
            expected_dt = datetime.now() + timedelta(days=7)

        db_order = Order(
            order_number=order_data.get("orderNumber") or str(uuid.uuid4())[:8].upper(),
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority=priority_val,
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=expected_dt,
            user_id=order_data.get("user_id", 1),
            payment_method=order_data.get("paymentMethod", "cash"),
            payment_status=order_data.get("paymentStatus", "fully-paid"),
            shipping_preference=order_data.get("shippingPreference", "pickup"),
            delivery_address=order_data.get("deliveryAddress"),
            delivery_courier=order_data.get("deliveryCourier"),
            amount_received=order_data.get("amountReceived", 0.0),
            balance=order_data.get("balance", 0.0),
            reference_no=order_data.get("referenceNo"),
            # shelf_location removed
            deposit_amount=order_data.get("depositAmount", 0.0),
            release_time=order_data.get("releaseTime"),
            province=order_data.get("province"),
            city=order_data.get("city"),
            barangay=order_data.get("barangay"),
            zip_code=order_data.get("zipCode")
        )
        db.add(db_order)
        db.flush()

        # Step 4: Handle Items (Multiple Shoes)
        items_list = order_data.get("items", [])
        
        # Fallback for old format (single item at top level)
        if not items_list and (order_data.get("brand") or order_data.get("shoeMaterial")):
            items_list = [{
                "brand": order_data.get("brand"),
                "shoeMaterial": order_data.get("shoeMaterial"),
                "quantity": order_data.get("quantity", 1),
                "condition": order_data.get("condition", {}),
                "baseService": order_data.get("baseService", []),
                "addOns": order_data.get("addOns", [])
            }]

        for item_data in items_list:
            db_item = Item(
                order_id=db_order.order_id, 
                brand=item_data.get("brand", "Unknown"), 
                shoe_model=item_data.get("shoeModel", "Unknown"),
                material=item_data.get("shoeMaterial", "Unknown"),
                quantity=item_data.get("quantity", 1),
                item_notes=item_data.get("condition", {}).get("others") if isinstance(item_data.get("condition"), dict) else None
            )
            db.add(db_item)
            db.flush()

            # Associate Conditions (ML Features)
            cond_data = item_data.get("condition", {})
            if isinstance(cond_data, dict):
                for cond_key, is_present in cond_data.items():
                    if is_present and cond_key != 'others':
                        # Lowercase and strip whitespace to match seed_lookups
                        lookup_name = cond_key.lower().replace(" ", "").replace("/", "")
                        cond = db.query(Condition).filter(Condition.condition_name == lookup_name).first()
                        if cond:
                            db_item.conditions.append(cond)

            # Associate Services (Pricing Snapshots)
            services_applied = []
            base_s = item_data.get("baseService", [])
            if isinstance(base_s, list): services_applied.extend(base_s)
            
            ads = item_data.get("addOns", [])
            for ad in ads: 
                if isinstance(ad, dict): services_applied.append(ad.get("name"))
                else: services_applied.append(ad)

            # Unique services only
            services_applied = list(set(services_applied))

            for s_name in services_applied:
                service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                if service_obj:
                    pricing = ItemServiceMapping(
                        item_id=db_item.item_id,
                        service_id=service_obj.service_id,
                        actual_price=service_obj.base_price
                    )
                    db.add(pricing)

        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Job Order {db_order.order_number} verified with {len(db_order.items)} items.")
        return db_order
        
    except Exception as e:
        print(f"[TRANS ERROR] {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/orders/{order_id}", response_model=OrderSchema)
def update_order(order_id: int, updates: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Updates order status, priority, or customer details.
    S.O.L.I.D: Open/Closed Principle - handles various fields without changing core logic.
    """
    print(f"[TRANS] Trace: Updating Order ID {order_id} with {updates.keys()}")
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="System Error: Order record missing.")
    
    # 1. Status Lifecycle & Analytics Logging
    if "status" in updates:
        status_name = updates["status"]
        # Internal Status Mapping
        status_map = {
            "new-order": "Pending",
            "on-going": "In Progress",
            "for-release": "Completed",
            "claimed": "Claimed",
            "cancelled": "Cancelled"
        }
        mapped_status = status_map.get(status_name, "Pending")
        db_status = db.query(Status).filter(Status.status_name == mapped_status).first()
        if db_status:
            db_order.status_id = db_status.status_id
            # Log the change for ML time-tracking
            log = StatusLog(order_id=order_id, status_id=db_status.status_id, user_id=updates.get("updater_id", 1)) 
            db.add(log)

            
            if mapped_status == "Claimed":
                db_order.claimed_at = datetime.now()
            elif mapped_status == "Completed":
                db_order.released_at = datetime.now()

    # 2. Handle Priority Level (ML Input)
    if "priorityLevel" in updates:
        # Normalize: 'rush' -> 'Rush', 'regular' -> 'Regular'
        db_order.priority = updates["priorityLevel"].replace('rush', 'Rush').replace('regular', 'Regular').replace('premium', 'Rush')

    # 3. Handle Customer Information (Relational Update)
    if ("customerName" in updates or "contactNumber" in updates) and db_order.customer:
        if "customerName" in updates: db_order.customer.customer_name = updates["customerName"]
        if "contactNumber" in updates: db_order.customer.contact_number = updates["contactNumber"]

    # 4. Handle Payment & Shipping
    if "paymentMethod" in updates: db_order.payment_method = updates["paymentMethod"]
    if "paymentStatus" in updates: db_order.payment_status = updates["paymentStatus"]
    if "shippingPreference" in updates: db_order.shipping_preference = updates["shippingPreference"]
    if "deliveryAddress" in updates: db_order.delivery_address = updates["deliveryAddress"]
    if "deliveryCourier" in updates: db_order.delivery_courier = updates["deliveryCourier"]
    if "amountReceived" in updates: db_order.amount_received = updates["amountReceived"]
    if "balance" in updates: db_order.balance = updates["balance"]
    if "grandTotal" in updates: db_order.grand_total = updates["grandTotal"]
    if "referenceNo" in updates: db_order.reference_no = updates["referenceNo"]
    # shelfLocation removed
    if "depositAmount" in updates: db_order.deposit_amount = updates["depositAmount"]
    if "releaseTime" in updates: db_order.release_time = updates["releaseTime"]
    if "province" in updates: db_order.province = updates["province"]
    if "city" in updates: db_order.city = updates["city"]
    if "barangay" in updates: db_order.barangay = updates["barangay"]
    if "zipCode" in updates: db_order.zip_code = updates["zipCode"]

    # 5. Handle Prediction Updates
    if "predictedCompletionDate" in updates:
        expected_iso = updates["predictedCompletionDate"]
        if expected_iso:
            try:
                db_order.expected_at = datetime.fromisoformat(expected_iso.replace('Z', '+00:00'))
            except Exception: pass

    # 6. Cascading Updates: Items, Conditions, and Services
    items_updates = updates.get("items", [])
    if not items_updates and ("brand" in updates or "shoeMaterial" in updates):
        # Fallback for single-item updates from flat structures
        items_updates = [{
            "brand": updates.get("brand", db_order.items[0].brand if db_order.items else "Unknown"),
            "shoeMaterial": updates.get("shoeMaterial", db_order.items[0].material if db_order.items else "Unknown"),
            "quantity": updates.get("quantity", db_order.items[0].quantity if db_order.items else 1),
            "condition": updates.get("condition"),
            "baseService": updates.get("baseService"),
            "addOns": updates.get("addOns")
        }]

    if items_updates and db_order.items:
        # For simplicity in this SMS version, we sync with the primary item (item 0)
        # In a multi-shoe system, we'd match by item_id
        db_item = db_order.items[0]
        item_data = items_updates[0]
        
        if "brand" in item_data: db_item.brand = item_data["brand"]
        if "shoeModel" in item_data: db_item.shoe_model = item_data["shoeModel"]
        if "shoeMaterial" in item_data: db_item.material = item_data["shoeMaterial"]
        if "quantity" in item_data: db_item.quantity = item_data["quantity"]
        if "condition" in item_data and isinstance(item_data["condition"], dict) and "others" in item_data["condition"]:
            db_item.item_notes = item_data["condition"]["others"]

        # Sync Conditions
        if "condition" in item_data and item_data["condition"]:
            db_item.conditions = [] # Clear existing
            cond_data = item_data["condition"]
            for cond_key, is_present in cond_data.items():
                if is_present and cond_key != 'others':
                    lookup_name = cond_key.lower().replace(" ", "").replace("/", "")
                    cond = db.query(Condition).filter(Condition.condition_name == lookup_name).first()
                    if cond: db_item.conditions.append(cond)

        # Sync Services (Pricing Snapshots)
        if ("baseService" in item_data or "addOns" in item_data):
            # Clear old mappings
            db.query(ItemServiceMapping).filter(ItemServiceMapping.item_id == db_item.item_id).delete()
            
            services_applied = []
            if "baseService" in item_data and isinstance(item_data["baseService"], list):
                services_applied.extend(item_data["baseService"])
            if "addOns" in item_data and isinstance(item_data["addOns"], list):
                for ad in item_data["addOns"]:
                    if isinstance(ad, dict): services_applied.append(ad.get("name"))
                    else: services_applied.append(ad)
            
            for s_name in set(services_applied):
                service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                if service_obj:
                    pricing = ItemServiceMapping(
                        item_id=db_item.item_id,
                        service_id=service_obj.service_id,
                        actual_price=service_obj.base_price
                    )
                    db.add(pricing)

    try:
        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Order {db_order.order_number} state synchronized.")
        return db_order
    except Exception as e:
        db.rollback()
        print(f"[TRANS ERROR] Failed to sync order update: {e}")
        raise HTTPException(status_code=500, detail="Database Sync Error")

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Permanent removal of order (Use with caution)."""
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(db_order)
    db.commit()
    return {"status": "success", "message": f"Order {order_id} deleted"}


# ==========================================
# 4. LOOKUPS & UTILITIES (Read-Only Endpoints)
# ==========================================

@app.get("/api/services", response_model=List[ServiceSchema])
def get_catalog(db: Session = Depends(get_db)):
    """Returns the available service catalog with real-time pricing."""
    return db.query(Service).all()

@app.post("/api/services", response_model=ServiceSchema)
def create_service(service_data: ServiceSchema, db: Session = Depends(get_db)):
    """Adds a new service to the catalog."""
    db_service = Service(**service_data.dict(exclude={'service_id'}))
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@app.put("/api/services/{service_id}", response_model=ServiceSchema)
def update_service(service_id: int, service_update: dict, db: Session = Depends(get_db)):
    """Updates an existing service."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    for key, value in service_update.items():
        if hasattr(db_service, key) and key != "service_id":
            setattr(db_service, key, value)
            
    db.commit()
    db.refresh(db_service)
    return db_service

@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    """Removes a service from the catalog."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    db.delete(db_service)
    db.commit()
    return {"status": "success"}


@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def get_statuses(db: Session = Depends(get_db)):
    """Returns all order lifecycle statuses for UI drop-downs."""
    return db.query(Status).all()

@app.get("/api/lookups/conditions", response_model=List[ConditionSchema])
def get_ml_features(db: Session = Depends(get_db)):
    """Returns all ML-mapped conditions for form selections."""
    return db.query(Condition).all()

# EOF: Backend Entry Point
