"""
SHOE LOTSKEY SMS - MAIN API ENTRY
=================================
FastAPI backend for 3NF normalized service management.
Implements security, order processing, and lookups.
Includes diagnostic logging for easy debugging during the Defenses.
"""

print("\n" + "="*50)
print("APP LOAD: main.py is being parsed by Gunicorn")
print("="*50 + "\n")

from fastapi import FastAPI, Depends, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, inspect, func
from typing import List, Dict, Any, Union
from datetime import datetime, timedelta
import os
import uuid
import json
import sys
import requests
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Internal Imports
from models import (
    Base, Order, Item, Service, Expense, StatusLog, 
    User, Customer, Role, Status, AuditLog, ItemServiceMapping,
    Payment, Delivery, ServiceCategory, PriorityLevel, Condition,
    ItemConditionMapping, ShippingPreference, PaymentMethod, PaymentStatus
)
from schemas import (
    OrderSchema, ServiceSchema, ExpenseSchema, UserSchema, LoginRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, RoleSchema, StatusSchema, 
    ItemSchema, PaymentSchema, DeliverySchema, UserCreateSchema, UserUpdateSchema
)
from database import engine, get_db, SessionLocal
from ml_engine import predictor

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
    
    # 0. PRE-BREAD: Robust migrations before ANY ORM work
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            cols = [c['name'] for c in inspector.get_columns("users")]
            with engine.connect() as conn:
                with conn.begin():
                    if "reset_token" not in cols:
                        print(">>> Migration: Force adding reset_token column")
                        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)"))
                    if "reset_token_expiry" not in cols:
                        print(">>> Migration: Force adding reset_token_expiry column")
                        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP"))
    except Exception as e:
        print(f">>> Pre-migration Warning: {e}")

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Auto-Migration for 'Too Normalized' database fix
    from sqlalchemy import text, inspect
    try:
        # Use inspector to check columns before blindly altering
        inspector = inspect(engine)
        
        # 1. Items Table update
        if "items" in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns("items")]
            missing = [
                ("cond_scratches", "BOOLEAN DEFAULT FALSE"),
                ("cond_yellowing", "BOOLEAN DEFAULT FALSE"),
                ("cond_ripsholes", "BOOLEAN DEFAULT FALSE"),
                ("cond_deepstains", "BOOLEAN DEFAULT FALSE"),
                ("cond_soleseparation", "BOOLEAN DEFAULT FALSE"),
                ("cond_wornout", "BOOLEAN DEFAULT FALSE")
            ]
            with engine.begin() as conn:
                for col_name, col_type in missing:
                    if col_name not in columns:
                        print(f">>> Migration: Adding {col_name} to items")
                        conn.execute(text(f"ALTER TABLE items ADD COLUMN {col_name} {col_type}"))
        
        # 2. Users Table update (Crucial for Forgot Password)
        if "users" in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "reset_token" not in columns:
                    print(">>> Migration: Adding reset_token to users")
                    try: conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)"))
                    except Exception as e: print(f">>> Migration Warning: {e}")
                
                if "reset_token_expiry" not in columns:
                    print(">>> Migration: Adding reset_token_expiry to users")
                    try: conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP"))
                    except Exception as e: print(f">>> Migration Warning: {e}")
        
        # 3. Data Extraction (Orders -> Payments/Deliveries)
        if "payments" in inspector.get_table_names() and "deliveries" in inspector.get_table_names():
            with engine.begin() as conn:
                print(">>> Migration: Synchronizing payments/deliveries extraction...")
                conn.execute(text("""
                    INSERT INTO payments (order_id, payment_method, payment_status, amount_received, balance, reference_no, deposit_amount)
                    SELECT order_id, payment_method, payment_status, amount_received, balance, reference_no, deposit_amount
                    FROM orders
                    WHERE order_id NOT IN (SELECT order_id FROM payments)
                    ON CONFLICT DO NOTHING
                """))
                conn.execute(text("""
                    INSERT INTO deliveries (order_id, shipping_preference, delivery_address, delivery_courier, release_time, province, city, barangay, zip_code)
                    SELECT order_id, shipping_preference, delivery_address, delivery_courier, release_time, province, city, barangay, zip_code
                    FROM orders
                    WHERE order_id NOT IN (SELECT order_id FROM deliveries)
                    ON CONFLICT DO NOTHING
                """))

        # 4. Services Table update (Custom Sorting)
        if "services" in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns("services")]
            if "sort_order" not in columns:
                print(">>> Migration: Adding sort_order to services")
                with engine.begin() as conn:
                    try: conn.execute(text("ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 0"))
                    except Exception as e: print(f">>> Migration Warning: {e}")

        # Cleanup any old 'Premium' services from the Priority section (Database hygiene)
        db_exec = SessionLocal()
        try:
            db_exec.execute(text("DELETE FROM services WHERE service_name LIKE '%Premium%'"))
            db_exec.commit()
            print(">>> DB Migration: Premium services cleaned from database.")
        except Exception as cleanup_err:
            print(f">>> DB Migration Warning: Cleanup failed: {cleanup_err}")
        finally:
            db_exec.close()

        print(">>> DB Migration: Schema check complete.")
            
    except Exception as e:
        print(f">>> DB Migration Critical failure: {e}")
        # Log detail to help pinpoint UndefinedColumn errors
        try:
            inspector = inspect(engine)
            print(f">>> Inspector Context - Available Tables: {inspector.get_table_names()}")
        except: pass
    
    # ----------------------------------------------------------------
    # 5. LOOKUP VALUE MIGRATION (Fix old Title-Case -> lowercase)
    # Renames existing DB values to match frontend types exactly.
    # Safe to run multiple times - WHERE clause prevents double-updates.
    # ----------------------------------------------------------------
    try:
        print(">>> Migration: Normalizing lookup values to match frontend types...")
        with engine.begin() as conn:

            # STATUS: 'Pending' -> 'new-order', 'In Progress' -> 'on-going', etc.
            conn.execute(text("UPDATE status SET status_name = 'new-order'   WHERE status_name = 'Pending'"))
            conn.execute(text("UPDATE status SET status_name = 'on-going'    WHERE status_name = 'In Progress'"))
            conn.execute(text("UPDATE status SET status_name = 'for-release' WHERE status_name = 'Completed'"))
            conn.execute(text("UPDATE status SET status_name = 'claimed'     WHERE status_name = 'Claimed'"))
            conn.execute(text("UPDATE status SET status_name = 'cancelled'   WHERE status_name = 'Cancelled'"))

            # PRIORITY: 'Regular' -> 'regular', 'Rush' -> 'rush', 'Premium' -> 'premium'
            conn.execute(text("UPDATE priority_levels SET priority_name = 'regular' WHERE priority_name = 'Regular'"))
            conn.execute(text("UPDATE priority_levels SET priority_name = 'rush'    WHERE priority_name = 'Rush'"))
            conn.execute(text("UPDATE priority_levels SET priority_name = 'premium' WHERE priority_name = 'Premium'"))

            # PAYMENT METHODS: 'Cash' -> 'cash', 'GCash' -> 'gcash', 'Bank Transfer' -> 'bank-transfer'
            conn.execute(text("UPDATE payment_methods SET method_name = 'cash'          WHERE method_name = 'Cash'"))
            conn.execute(text("UPDATE payment_methods SET method_name = 'gcash'         WHERE method_name = 'GCash'"))
            conn.execute(text("UPDATE payment_methods SET method_name = 'bank-transfer' WHERE method_name = 'Bank Transfer'"))

            # PAYMENT STATUSES: 'Fully Paid' -> 'fully-paid', 'Downpayment' -> 'downpayment'
            conn.execute(text("UPDATE payment_statuses SET status_name = 'fully-paid'  WHERE status_name = 'Fully Paid'"))
            conn.execute(text("UPDATE payment_statuses SET status_name = 'downpayment' WHERE status_name = 'Downpayment'"))
            conn.execute(text("UPDATE payment_statuses SET status_name = 'pending'     WHERE status_name = 'Pending'"))

            # SHIPPING: 'Pickup' -> 'pickup', 'Delivery' -> 'delivery'
            conn.execute(text("UPDATE shipping_preferences SET pref_name = 'pickup'   WHERE pref_name = 'Pickup'"))
            conn.execute(text("UPDATE shipping_preferences SET pref_name = 'delivery' WHERE pref_name = 'Delivery'"))

        print(">>> Migration: Lookup values normalized successfully.")
    except Exception as e:
        print(f">>> Migration Warning: Lookup value update failed (table may not exist yet): {e}")

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

    # Seed Statuses — must match frontend JobStatus exactly
    if db.query(Status).count() == 0:
        print(">>> Seeding Statuses...")
        statuses = [
            Status(status_name="new-order"),
            Status(status_name="on-going"),
            Status(status_name="for-release"),
            Status(status_name="claimed"),
            Status(status_name="cancelled")
        ]
        db.add_all(statuses)
        db.commit()

    # Seed Service Categories
    if db.query(ServiceCategory).count() == 0:
        print(">>> Seeding Service Categories...")
        db.add_all([ServiceCategory(category_name=c) for c in ['base', 'addon', 'priority']])
        db.commit()

    # Seed Conditions
    if db.query(Condition).count() == 0:
        print(">>> Seeding Conditions...")
        db.add_all([Condition(condition_name=c) for c in ['Scratches', 'Yellowing', 'Rips/Holes', 'Deep Stains', 'Sole Separation', 'Worn Out']])
        db.commit()

    # Seed Payment Methods — must match frontend: 'cash', 'gcash', 'bank-transfer'
    if db.query(PaymentMethod).count() == 0:
        print(">>> Seeding Payment Methods...")
        db.add_all([PaymentMethod(method_name=m) for m in ['cash', 'gcash', 'bank-transfer']])
        db.commit()

    # Seed Payment Statuses — must match frontend: 'fully-paid', 'downpayment'
    if db.query(PaymentStatus).count() == 0:
        print(">>> Seeding Payment Statuses...")
        db.add_all([PaymentStatus(status_name=s) for s in ['fully-paid', 'downpayment', 'pending']])
        db.commit()

    # Seed Shipping Preferences — must match frontend: 'pickup', 'delivery'
    if db.query(ShippingPreference).count() == 0:
        print(">>> Seeding Shipping Preferences...")
        db.add_all([ShippingPreference(pref_name=p) for p in ['pickup', 'delivery']])
        db.commit()

    # Seed Priority Levels — must match frontend: 'regular', 'rush', 'premium'
    if db.query(PriorityLevel).count() == 0:
        print(">>> Seeding Priority Levels...")
        db.add_all([PriorityLevel(priority_name=p) for p in ['regular', 'rush', 'premium']])
        db.commit()



    # ------------------------------------------
    # 3. SERVICE CATALOG SYNC (Standardized Service List)
    # ------------------------------------------
    # For Defense: We perform a "Safe Sync" instead of DELETE to avoid Foreign Key violations with old orders.
    print(">>> Syncing Complete Service Catalog (Safe Mode)...")
    
    catalog_data = [
        # BASE SERVICES (The Core 4)
        {"service_name": "Basic Cleaning", "base_price": 325, "category": "base", "duration_days": 10, "service_code": "BCN", "is_active": True, "sort_order": 1},
        {"service_name": "Minor Reglue", "base_price": 150, "category": "base", "duration_days": 25, "service_code": "MRG", "is_active": True, "sort_order": 2},
        {"service_name": "Full Reglue", "base_price": 250, "category": "base", "duration_days": 25, "service_code": "FRG", "is_active": True, "sort_order": 3},
        {"service_name": "Color Renewal", "base_price": 800, "category": "base", "duration_days": 15, "service_code": "CRN", "is_active": True, "sort_order": 4},
        
        # ADD-ON SERVICES (Restoration & Detailing)
        {"service_name": "Undersole", "base_price": 150, "category": "addon", "duration_days": 20, "service_code": "USL", "is_active": True, "sort_order": 10},
        {"service_name": "Midsole", "base_price": 150, "category": "addon", "duration_days": 20, "service_code": "MSL", "is_active": True, "sort_order": 11},
        {"service_name": "Minor Restoration", "base_price": 300, "category": "addon", "duration_days": 25, "service_code": "MRS", "is_active": True, "sort_order": 12},
        {"service_name": "Minor Retouch", "base_price": 125, "category": "addon", "duration_days": 5, "service_code": "MRT", "is_active": True, "sort_order": 13},
        {"service_name": "Add Glue Layer", "base_price": 100, "category": "addon", "duration_days": 2, "service_code": "AGL", "is_active": True, "sort_order": 14},
        {"service_name": "Unyellowing", "base_price": 125, "category": "addon", "duration_days": 5, "service_code": "UNY", "is_active": True, "sort_order": 15},
        {"service_name": "White Paint", "base_price": 150, "category": "addon", "duration_days": 0, "service_code": "WPT", "is_active": True, "sort_order": 16},
        {"service_name": "2 Colors", "base_price": 200, "category": "addon", "duration_days": 0, "service_code": "2CL", "is_active": True, "sort_order": 17},
        {"service_name": "3 Colors", "base_price": 300, "category": "addon", "duration_days": 0, "service_code": "3CL", "is_active": True, "sort_order": 18},
        
        # PRIORITY FEES
        {"service_name": "Rush Fee (Basic Cleaning)", "base_price": 150, "category": "priority", "duration_days": -5, "service_code": "RFC", "is_active": True, "sort_order": 30},
        {"service_name": "Rush Fee (Minor Reglue)", "base_price": 250, "category": "priority", "duration_days": 0, "service_code": "RFR", "is_active": False, "sort_order": 31},
        {"service_name": "Rush Fee (Full Reglue)", "base_price": 250, "category": "priority", "duration_days": 0, "service_code": "RFF", "is_active": False, "sort_order": 32}
    ]

    # ------------------------------------------
    # 3. SERVICE CATALOG SYNC (Singleton Safe Sync)
    # ------------------------------------------
    cat_map = {c.category_name: c.category_id for c in db.query(ServiceCategory).all()}
    
    try:
        if db.execute(text("SELECT pg_try_advisory_xact_lock(12345)")).scalar():
            print(">>> Catalog Sync: Lock acquired. Updating service table...")
            # Deactivate everything first to ensure a clean UI
            db.execute(text("UPDATE services SET is_active = False"))
            # Purge ALL Duplicates and Inactive Trash
            db.execute(text("DELETE FROM services WHERE service_name ILIKE '%[DUP]%' OR service_name ILIKE 'z_hidden%'"))

            for item in catalog_data:
                target_name = item.get("service_name").strip()
                cat_name = item.pop("category", "base")
                item["category_id"] = cat_map.get(cat_name, cat_map.get("base"))
                
                # Check for existing service
                db_service = db.query(Service).filter(func.lower(Service.service_name) == target_name.lower()).first()
                if db_service:
                    db_service.service_name = target_name
                    db_service.base_price = item["base_price"]
                    db_service.category_id = item["category_id"]
                    db_service.duration_days = item["duration_days"]
                    db_service.service_code = item["service_code"]
                    db_service.is_active = item["is_active"]
                    db_service.sort_order = item["sort_order"]
                else:
                    db.add(Service(**item))
            
            db.commit()
            print(">>> Catalog Sync: Complete.")
    except Exception as lock_err:
        db.rollback()
        print(f">>> Catalog Sync Warning (Worker skipped lock): {lock_err}")

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
        # 1. FETCH USER (Allow Login via Username OR Email for flexibility)
        from sqlalchemy import or_
        db_user = db.query(User).options(joinedload(User.role)).filter(
            or_(User.username == request.username, User.email == request.username)
        ).first()
        
        if not db_user:
            print(f"[AUTH] Denied: Identifier '{request.username}' not found.")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # 2. VALIDATION (Security Checkpoint)
        if db_user.password_hash == request.password:
            print(f"[AUTH] Granted: {db_user.username} ({db_user.email}) authenticated as {db_user.role.role_name}.")
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
# 2.2 PASSWORD RECOVERY (Mailgun Integration)
# ==========================================

def send_reset_email(user_email, reset_link):
    """Integrates with Mailgun API to send real emails."""
    api_key = os.environ.get('MAILGUN_API_KEY')
    domain = "www.shoelotskey-villamor-pasay.app" 
    
    if not api_key:
        print("[EMAIL ERROR] MAILGUN_API_KEY not found in environment.")
        return 500

    # Extract base URL for the logo
    # Example reset_link: https://domain.com/reset-password?token=...
    try:
        base_url = reset_link.split("/reset-password")[0]
        logo_url = f"{base_url}/login.png"
    except:
        logo_url = "https://shoelotskey-villamor-pasay.herokuapp.com/login.png"

    url = f"https://api.mailgun.net/v3/{domain}/messages"
    
    payload = {
        "from": "Shoelotskey Support <postmaster@www.shoelotskey-villamor-pasay.app>",
        "to": [user_email],
        "subject": "Reset Your Shoelotskey Password",
        "html": f"""
            <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 500px; margin: 0 auto; background-color: white;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="{logo_url}" alt="Shoelotskey Logo" style="height: 100px; width: auto;" />
                </div>
                <h3 style="color: #e11d48; text-align: center; margin-top: 0;">Password Reset Request</h3>
                <p>We received a request to reset your password for your <strong>Shoelotskey</strong> account.</p>
                <p>Click the button below to set a new password. This link is unique and will expire in 1 hour.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #e11d48; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset My Password</a>
                </div>
                <p style="color: #777; font-size: 11px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">Shoelotskey Villamor - Pasay City, Metro Manila</p>
            </div>
        """
    }

    try:
        # Mailgun uses HTTP Basic Auth; Brevo used API key in headers
        response = requests.post(url, auth=("api", api_key), data=payload)
        print(f"[EMAIL] Reset link sent to {user_email}. Status: {response.status_code}")
        return response.status_code # 200 means success for Mailgun
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send: {e}")
        return 500

@app.post("/api/forgot-password")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generates a secure token and sends a reset email."""
    print(f"[AUTH] Password recovery requested for: {body.email}")
    user = db.query(User).filter(User.email == body.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Email not found in our records.")

    token = str(uuid.uuid4())
    user.reset_token = token
    user.reset_token_expiry = datetime.now() + timedelta(hours=1)
    db.commit()

    # Dynamic Host Detection
    requested_host = request.headers.get("host", "shoelotskey-villamor-pasay.herokuapp.com")
    protocol = "https" if "herokuapp.com" in requested_host or ".app" in requested_host else "http"
    
    # Construction: Reset Link
    reset_link = f"{protocol}://{requested_host}/reset-password?token={token}"
    
    # Debug: Print for logs
    print(f"[AUTH] Generated Reset Link: {reset_link}")

    status = send_reset_email(user.email, reset_link)
    
    if status == 200:
        return {"message": "Reset email sent successfully", "debug_token": token}
    else:
        return {"message": "System: Mock recovery enabled (Mailgun error: fallback to token)", "debug_token": token}

@app.get("/api/health")
def health_check():
    """Simple probe to verify the server is alive."""
    return {"status": "ok", "timestamp": str(datetime.now()), "environment": os.environ.get('PORT', 'local')}

@app.post("/api/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verifies the token and updates the password header."""
    print(f"[AUTH] Verifying reset token...")
    user = db.query(User).filter(User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    # 2. Check Expiry
    if user.reset_token_expiry and user.reset_token_expiry < datetime.now():
        print(f"[AUTH] Expired token used for {user.username}")
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    # 1. Update password
    user.password_hash = request.new_password # Plaintext as per current architecture
    user.reset_token = None # Clear token after use
    user.reset_token_expiry = None
    db.commit()
    
    print(f"[AUTH] Password successfully updated for {user.username}")
    return {"message": "Password updated successfully"}

# ==========================================
# 2.2 MACHINE LEARNING & PREDICTION
# ==========================================

@app.post("/api/predict")
async def get_prediction(order_data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    ML Endpont: Predicts completion date based on order complexity.
    Returns: Predicted date and metadata.
    """
    print(f"[ML] Predicting completion for new draft...")
    try:
        predicted_dt = predictor.predict_completion(db, order_data)
        return {
            "predicted_date": predicted_dt.isoformat(),
            "predicted_days": (predicted_dt - datetime.now()).days,
            "status": "success",
            "engine": "Shoelotskey SPE v1.0"
        }
    except Exception as e:
        print(f"[ML ERROR] {e}")
        # Return a safe fallback (10 days)
        fallback = datetime.now() + timedelta(days=10)
        return {"predicted_date": fallback.isoformat(), "status": "fallback", "error": str(e)}

@app.post("/api/ml/train")
def train_model(db: Session = Depends(get_db)):
    """Triggers retraining of the ML model based on history."""
    success = predictor.train_from_history(db)
    if success:
        return {"message": "Model retrained successfully"}
    else:
        return {"message": "Retraining skipped - insufficient historical data"}

# ==========================================
# 2.5 USER MANAGEMENT
# ==========================================

@app.get("/api/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db)):
    """Fetch all users along with their roles."""
    users = db.query(User).options(joinedload(User.role)).all()
    return users

@app.post("/api/users", response_model=UserSchema)
def create_user(user_data: UserCreateSchema, db: Session = Depends(get_db)):
    """Create a new staff or owner account."""
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
        
    db_role = db.query(Role).filter(Role.role_name == user_data.role_name).first()
    if not db_role:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=user_data.password, # Note: using plaintext based on current architecture
        role_id=db_role.role_id,
        is_active=user_data.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.put("/api/users/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_update: UserUpdateSchema, db: Session = Depends(get_db)):
    """Update user details."""
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_update.username:
        # Check uniqueness
        if db.query(User).filter(User.username == user_update.username, User.user_id != user_id).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        db_user.username = user_update.username
        
    if user_update.email:
        if db.query(User).filter(User.email == user_update.email, User.user_id != user_id).first():
            raise HTTPException(status_code=400, detail="Email already exists")
        db_user.email = user_update.email
        
    if user_update.password:
        db_user.password_hash = user_update.password
        
    if user_update.role_name:
        db_role = db.query(Role).filter(Role.role_name == user_update.role_name).first()
        if not db_role:
            raise HTTPException(status_code=400, detail="Invalid role specified")
        db_user.role_id = db_role.role_id
        
    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active

    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Remove user access."""
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent deleting the last owner
    if db_user.role.role_name == 'owner':
        owner_count = db.query(User).join(Role).filter(Role.role_name == 'owner').count()
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last owner account")
            
    db.delete(db_user)
    db.commit()
    return {"status": "success", "message": f"User {user_id} deleted"}

# ==========================================
# 3. JOB ORDERS (Complex 3NF Normalization)
# ==========================================

@app.get("/api/orders", response_model=List[OrderSchema])
def read_orders(db: Session = Depends(get_db)):
    """Retrieves all orders with full 3NF hydration (Customer, Items, Status, Payments, Delivery)."""
    print("[QUERY] Fetching Order history...")
    orders = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.status),
        joinedload(Order.priority),
        joinedload(Order.processor),
        joinedload(Order.status_logs).joinedload(StatusLog.status),
        joinedload(Order.status_logs).joinedload(StatusLog.user),
        joinedload(Order.payments).joinedload(Payment.method),
        joinedload(Order.payments).joinedload(Payment.p_status),
        joinedload(Order.delivery).joinedload(Delivery.preference),
        joinedload(Order.items).joinedload(Item.services).joinedload(Service.category),
        joinedload(Order.items).joinedload(Item.conditions),
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
        # Frontend sends: 'new-order', 'on-going', 'for-release', 'claimed'
        # DB now stores these exact values (they already match)
        status_name = order_data.get("status", "new-order")
        # Strip any legacy capitalized values just in case
        status_map = {
            "new-order": "new-order", "on-going": "on-going",
            "for-release": "for-release", "claimed": "claimed",
            # Legacy fallbacks
            "Pending": "new-order", "In Progress": "on-going",
            "Completed": "for-release", "Claimed": "claimed"
        }
        mapped_status = status_map.get(status_name, "new-order")
        db_status = db.query(Status).filter(Status.status_name == mapped_status).first()
        if not db_status:
            db_status = db.query(Status).first()

        # Step 3: Persistence - Order Header
        # DB stores lowercase: 'regular', 'rush', 'premium'
        p_val = str(order_data.get("priorityLevel", "regular")).lower()
        if p_val not in ["regular", "rush", "premium"]: p_val = "regular"
        db_prio = db.query(PriorityLevel).filter(PriorityLevel.priority_name == p_val).first() or db.query(PriorityLevel).first()

        # Predicted Completion Handling (Integrated ML)
        expected_iso = order_data.get("predictedCompletionDate")
        if expected_iso:
            try:
                expected_dt = datetime.fromisoformat(expected_iso.replace('Z', '+00:00'))
            except Exception:
                expected_dt = predictor.predict_completion(db, order_data)
        else:
            # AUTO-ML: Generate prediction based on services, material, and workload
            expected_dt = predictor.predict_completion(db, order_data)

        db_order = Order(
            order_number=order_data.get("orderNumber") or str(uuid.uuid4())[:8].upper(),
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority_id=db_prio.priority_id,
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=expected_dt,
            user_id=order_data.get("user_id", 1)
        )
        db.add(db_order)
        db.flush()

        # Payment Normalization
        # DB stores lowercase: 'cash', 'gcash', 'bank-transfer'
        m_name = str(order_data.get("paymentMethod", "cash")).lower()
        if m_name not in ["cash", "gcash", "bank-transfer"]: m_name = "cash"
        db_method = db.query(PaymentMethod).filter(PaymentMethod.method_name == m_name).first() or db.query(PaymentMethod).first()
        
        # DB stores lowercase: 'fully-paid', 'downpayment', 'pending'
        ps_raw = str(order_data.get("paymentStatus", "fully-paid")).lower()
        ps_name = ps_raw if ps_raw in ["fully-paid", "downpayment", "pending"] else "fully-paid"
        db_p_status = db.query(PaymentStatus).filter(PaymentStatus.status_name == ps_name).first() or db.query(PaymentStatus).first()

        db_payment = Payment(
            order_id=db_order.order_id,
            method_id=db_method.method_id,
            status_id=db_p_status.p_status_id,
            amount_received=order_data.get("amountReceived", 0.0),
            balance=order_data.get("balance", 0.0),
            reference_no=order_data.get("referenceNo"),
            deposit_amount=order_data.get("depositAmount", 0.0)
        )
        db.add(db_payment)
        
        # Delivery Normalization  
        # DB stores lowercase: 'pickup', 'delivery'
        sp_raw = str(order_data.get("shippingPreference", "pickup")).lower()
        sp_name = sp_raw if sp_raw in ["pickup", "delivery"] else "pickup"
        db_pref = db.query(ShippingPreference).filter(ShippingPreference.pref_name == sp_name).first() or db.query(ShippingPreference).first()

        db_delivery = Delivery(
            order_id=db_order.order_id,
            pref_id=db_pref.pref_id,
            delivery_address=order_data.get("deliveryAddress"),
            delivery_courier=order_data.get("deliveryCourier"),
            release_time=order_data.get("releaseTime"),
            province=order_data.get("province"),
            city=order_data.get("city"),
            barangay=order_data.get("barangay"),
            zip_code=order_data.get("zipCode")
        )
        db.add(db_delivery)
        db.flush()
        db.flush()

        # Step 4: Handle Items (Multiple Shoes)
        items_list = order_data.get("items", [])
        
        # Fallback for old format (single item at top level)
        if not items_list and (order_data.get("brand") or order_data.get("shoeMaterial")):
            items_list = [{
                "brand": order_data.get("brand"),
                "shoeModel": order_data.get("shoeModel"),
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

            # Associate Conditions (3NF Bridge)
            cond_data = item_data.get("condition", {})
            if isinstance(cond_data, dict):
                c_map = {"scratches": "Scratches", "yellowing": "Yellowing", "ripsHoles": "Rips/Holes", "deepStains": "Deep Stains", "soleSeparation": "Sole Separation", "wornOut": "Worn Out"}
                for key, val in c_map.items():
                    if cond_data.get(key):
                        c_obj = db.query(Condition).filter(Condition.condition_name == val).first()
                        if c_obj: db_item.conditions.append(c_obj)
            
            db.flush()

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
        # DB now stores the exact frontend values directly
        status_map = {
            "new-order": "new-order",
            "on-going": "on-going",
            "for-release": "for-release",
            "claimed": "claimed",
            "cancelled": "cancelled",
            # Legacy fallbacks
            "Pending": "new-order", "In Progress": "on-going",
            "Completed": "for-release", "Claimed": "claimed"
        }
        mapped_status = status_map.get(status_name, "new-order")
        db_status = db.query(Status).filter(Status.status_name == mapped_status).first()
        if db_status:
            db_order.status_id = db_status.status_id
            # Log the change for ML time-tracking
            log = StatusLog(order_id=order_id, status_id=db_status.status_id, user_id=updates.get("updater_id", 1)) 
            db.add(log)

            
            if mapped_status == "claimed":
                db_order.claimed_at = datetime.now()
            elif mapped_status == "for-release":
                db_order.released_at = datetime.now()

    # 2. Handle Priority Level (ML Input)
    if "priorityLevel" in updates:
        # DB stores lowercase: 'regular', 'rush', 'premium'
        p_val = str(updates["priorityLevel"]).lower()
        db_prio = db.query(PriorityLevel).filter(PriorityLevel.priority_name == p_val).first()
        if db_prio: db_order.priority_id = db_prio.priority_id

    # 3. Handle Customer Information (Relational Update)
    if ("customerName" in updates or "contactNumber" in updates) and db_order.customer:
        if "customerName" in updates: db_order.customer.customer_name = updates["customerName"]
        if "contactNumber" in updates: db_order.customer.contact_number = updates["contactNumber"]

    # 4. Handle Payment & Shipping
    if db_order.payments:
        db_pay = db_order.payments[0]
        if "paymentMethod" in updates:
            # DB stores lowercase: 'cash', 'gcash', 'bank-transfer'
            m_name = str(updates["paymentMethod"]).lower()
            if m_name not in ["cash", "gcash", "bank-transfer"]: m_name = "cash"
            db_m = db.query(PaymentMethod).filter(PaymentMethod.method_name == m_name).first()
            if db_m: db_pay.method_id = db_m.method_id
        if "paymentStatus" in updates:
            # DB stores: 'fully-paid', 'downpayment', 'pending'
            ps_raw = str(updates["paymentStatus"]).lower()
            ps_name = ps_raw if ps_raw in ["fully-paid", "downpayment", "pending"] else "fully-paid"
            db_ps = db.query(PaymentStatus).filter(PaymentStatus.status_name == ps_name).first()
            if db_ps: db_pay.status_id = db_ps.p_status_id
        if "amountReceived" in updates: db_pay.amount_received = updates["amountReceived"]
        if "balance" in updates: db_pay.balance = updates["balance"]
        if "referenceNo" in updates: db_pay.reference_no = updates["referenceNo"]
        if "depositAmount" in updates: db_pay.deposit_amount = updates["depositAmount"]

    if db_order.delivery:
        if "shippingPreference" in updates:
            # DB stores lowercase: 'pickup', 'delivery'
            sp_raw = str(updates["shippingPreference"]).lower()
            sp_name = sp_raw if sp_raw in ["pickup", "delivery"] else "pickup"
            db_pref = db.query(ShippingPreference).filter(ShippingPreference.pref_name == sp_name).first()
            if db_pref: db_order.delivery.pref_id = db_pref.pref_id
        for field in ["deliveryAddress", "deliveryCourier", "releaseTime", "province", "city", "barangay", "zipCode"]:
            if field in updates: setattr(db_order.delivery, field.lower() if field != "zipCode" else "zip_code", updates[field])

    # 5. Handle Prediction Updates (Re-ML if changed)
    if "predictedCompletionDate" in updates:
        expected_iso = updates["predictedCompletionDate"]
        if expected_iso:
            try:
                db_order.expected_at = datetime.fromisoformat(expected_iso.replace('Z', '+00:00'))
            except Exception:
                db_order.expected_at = predictor.predict_completion(db, updates)
        else:
            db_order.expected_at = predictor.predict_completion(db, updates)

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

        # Sync Conditions (3NF Bridge)
        if "condition" in item_data and isinstance(item_data["condition"], dict):
            db_item.conditions = [] # Clear existing
            c_data = item_data["condition"]
            c_map = {"scratches": "Scratches", "yellowing": "Yellowing", "ripsHoles": "Rips/Holes", "deepStains": "Deep Stains", "soleSeparation": "Sole Separation", "wornOut": "Worn Out"}
            for key, val in c_map.items():
                if c_data.get(key):
                    c_obj = db.query(Condition).filter(Condition.condition_name == val).first()
                    if c_obj: db_item.conditions.append(c_obj)

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
    
    # S.O.L.I.D: Soft Delete implementation to maintain 3NF Integrity
    db_service.is_active = False
    db.commit()
    return {"status": "success", "message": "Service deactivated (Soft Delete)"}


@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def get_statuses(db: Session = Depends(get_db)):
    """Returns all order lifecycle statuses for UI drop-downs."""
    return db.query(Status).all()


@app.get("/api/expenses", response_model=List[ExpenseSchema])
def get_expenses(db: Session = Depends(get_db)):
    """Tracks business overhead costs."""
    return db.query(Expense).all()

@app.post("/api/expenses", response_model=ExpenseSchema)
def create_expense(expense_data: dict, db: Session = Depends(get_db)):
    """Logs a new business expense."""
    # Logic: If date is missing, use now. Use first admin user as fallback for user_id.
    user_id = expense_data.get('user_id', 1)
    
    # Map frontend 'date' if provided
    exp_date = expense_data.get('date')
    if exp_date:
        if isinstance(exp_date, str):
            try:
                exp_date = datetime.fromisoformat(exp_date.replace('Z', ''))
            except ValueError:
                exp_date = datetime.now()
    else:
        exp_date = datetime.now()

    db_expense = Expense(
        amount=expense_data.get('amount', 0.0),
        description=expense_data.get('notes') or expense_data.get('category') or "Misc Expense",
        expense_date=exp_date,
        user_id=user_id
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@app.get("/api/activities")
def get_activities(db: Session = Depends(get_db)):
    """Retrieves formatted system audit logs for UI."""
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50).all()
    results = []
    for log in logs:
        # Optimization: Fetch username
        u = db.query(User).filter(User.user_id == log.user_id).first()
        results.append({
            "id": str(log.audit_log_id),
            "timestamp": log.created_at.strftime('%m/%d/%Y, %H:%M') if log.created_at else "",
            "user": u.username if u else "System",
            "action": log.action_type,
            "details": f"{log.action_type} on {log.table_name}",
            "type": "system"
        })
    return results

@app.post("/api/activities")
def log_custom_activity(activity: dict, db: Session = Depends(get_db)):
    """Generic endpoint for frontend to log UI-specific events."""
    # Map to AuditLog model
    u = db.query(User).filter(User.username == activity.get('user')).first()
    new_log = AuditLog(
        user_id=u.user_id if u else 1,
        action_type='UPDATE' if activity.get('type') == 'service' else 'CREATE',
        table_name=activity.get('type') or 'system',
        record_id=0,
        new_values={"details": activity.get('details')}
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return activity





# ==========================================
# 4. PROPER MONOLITH FIX & UI HOSTING
# ==========================================
# Resolves paths relative to main.py to find the 'dist' folder correctly.
# NOTE: Use '../dist' because main.py is inside the 'backend' folder.

# 1. Mount the 'assets' (CSS/JS) so the browser can load them
# 1. Mount the 'assets' (CSS/JS) so the browser can load them
base_dir = os.path.dirname(os.path.abspath(__file__))
dist_path = os.path.abspath(os.path.join(base_dir, "..", "dist"))
dist_assets = os.path.join(dist_path, "assets")

print(f"[BOOT] Base path detected: {base_dir}")
print(f"[BOOT] Looking for UI at: {dist_path}")

if os.path.exists(dist_assets):
    app.mount("/assets", StaticFiles(directory=dist_assets), name="static")
    print(f"[BOOT] SUCCESS: Mounted UI Assets from: {dist_assets}")
else:
    print(f"[BOOT] WARNING: UI Assets folder NOT FOUND at {dist_assets}")
    # List directory content to debug
    try:
        parent_dir = os.path.abspath(os.path.join(dist_path, ".."))
        print(f"[BOOT] Parent directory content ({parent_dir}): {os.listdir(parent_dir)}")
        if os.path.exists(dist_path):
            print(f"[BOOT] Dist directory content ({dist_path}): {os.listdir(dist_path)}")
    except: pass

# 2. Serve the Dashboard UI on the root URL
@app.get("/")
async def read_index():
    index_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist", "index.html"))
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "error", "message": "UI not found. Build is required."}

# 3. SPA Support (Catch-all)
# Ensures pages like /orders or /settings work even after a browser refresh.
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    # Only serve the UI if it's NOT an API call
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="API route not found")
        
    index_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist", "index.html"))
    
    # If the path looks like a static file that exists, serve it
    file_candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist", full_path))
    if os.path.isfile(file_candidate):
        return FileResponse(file_candidate)
        
    # Default to index.html for React Router
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "error", "message": "UI not found."}

# EOF: Backend Entry Point
