# Shoelotskey SMS - Main Entry

from fastapi import FastAPI, Depends, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, inspect, func, or_
from typing import List, Dict, Any, Union, Optional
from datetime import datetime, timedelta
import os
import uuid
import json
import sys
import os
import requests
import shutil

def auto_organize_workspace():
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        tests_dir = os.path.join(base_dir, "tests")
        db_dir = os.path.join(base_dir, "db")
        os.makedirs(tests_dir, exist_ok=True)
        os.makedirs(db_dir, exist_ok=True)
        sys.path.insert(0, db_dir)

        for pkg_dir in [tests_dir, db_dir]:
            init_file = os.path.join(pkg_dir, "__init__.py")
            if not os.path.exists(init_file):
                with open(init_file, "w") as f:
                    f.write("# Auto-generated package init\n")

        test_files = [
            "api_tests.py", "e2e_system_evaluation_test.py", "qa_tester.py", "system_tests.py",
            "test_auth.py", "test_health.py", "test_heroku_offline_sync.py",
            "verify_defense_checklist.py"
        ]
        for tf in test_files:
            src = os.path.join(base_dir, tf)
            dst = os.path.join(tests_dir, tf)
            if os.path.exists(src):
                try:
                    with open(src, "r", encoding="utf-8", errors="ignore") as file_read:
                        content = file_read.read()
                    if "sys.path.append(os.path.dirname(os.path.abspath(__file__)))" in content and "dirname(os.path.dirname" not in content:
                        content = content.replace("sys.path.append(os.path.dirname(os.path.abspath(__file__)))", "sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))")
                    elif "sys.path" not in content:
                        content = "import sys, os\nsys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\n" + content
                    with open(dst, "w", encoding="utf-8") as file_write:
                        file_write.write(content)
                    os.remove(src)
                    print(f"[WORKSPACE CLEANUP] Organized {tf} -> tests/{tf}")
                except Exception as err:
                    print(f"[WORKSPACE CLEANUP ERROR] {tf}: {err}")

        db_files = ["seed_inventory.py", "setup_stored_procedure.py", "sync_to_local.py", "repositories.py", "qa_sandbox.db"]
        for dbf in db_files:
            src = os.path.join(base_dir, dbf)
            dst = os.path.join(db_dir, dbf)
            if os.path.exists(src):
                try:
                    if dbf.endswith(".py"):
                        with open(src, "r", encoding="utf-8", errors="ignore") as fr:
                            content = fr.read()
                        if "sys.path" not in content:
                            content = "import sys, os\nsys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\n" + content
                        with open(dst, "w", encoding="utf-8") as fw:
                            fw.write(content)
                        os.remove(src)
                    else:
                        shutil.move(src, dst)
                    print(f"[WORKSPACE CLEANUP] Organized {dbf} -> db/{dbf}")
                except Exception as err:
                    print(f"[WORKSPACE CLEANUP ERROR] {dbf}: {err}")
        
        # Remove old duplicate files in root now that they are cleanly located inside db/ and tests/
        old_duplicates = [
            os.path.join(base_dir, "database.py"),
            os.path.join(base_dir, "shoelotskey.db"),
            os.path.join(os.path.dirname(base_dir), "shoelotskey.db"),
            os.path.join(base_dir, "e2e_offline_sync_verification_test.py")
        ]
        for dup in old_duplicates:
            if os.path.exists(dup):
                try:
                    os.remove(dup)
                    print(f"[WORKSPACE CLEANUP] Removed redundant copy: {dup}")
                except Exception:
                    pass
    except Exception as e:
        print(f"[WORKSPACE CLEANUP] Auto organize warning: {e}")

auto_organize_workspace()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

import bcrypt as _bcrypt

class _BcryptWrapper:
    @staticmethod
    def hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')
        
    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        # If the hash doesn't start with a valid bcrypt identifier (e.g. $2b$, $2a$), 
        # raise ValueError to trigger the plaintext fallback in the login route.
        if not hashed.startswith('$2'):
            raise ValueError("not a valid bcrypt hash")
        
        return _bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

bcrypt = _BcryptWrapper()
from models import (
    Base, Order, Item, Service, Expense, StatusLog, 
    User, Customer, Role, Status, AuditLog, ItemServiceMapping,
    Payment, Delivery, ServiceCategory, PriorityLevel, Condition,
    ItemConditionMapping, ShippingPreference, PaymentMethod, PaymentStatus,
    Inventory, InventoryLog
)
from db.repositories import InventoryRepository
from schemas import (
    OrderSchema, ServiceSchema, ExpenseSchema, UserSchema, LoginRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, RoleSchema, StatusSchema, 
    ItemSchema, PaymentSchema, DeliverySchema, UserCreateSchema, UserUpdateSchema,
    InventorySchema, InventoryUpdateSchema, InventoryLogSchema
)
from db.database import engine, get_db, SessionLocal, DATABASE_URL, is_sqlite, conn_error, LOCAL_SQLITE_PATH, LOCAL_SQLITE
from ml_engine import predictor
from auth_utils import get_current_user, require_role, create_access_token, sanitize_error

# ------------------------------------------
# SYSTEM INITIALIZATION
# ------------------------------------------
DB_TYPE = "PostgreSQL" if "postgresql" in DATABASE_URL else "SQLite"
ENV = "Production" if os.getenv("PORT") else "Localhost"

def parse_local_date(iso_str: Optional[str]) -> datetime:
    if not iso_str:
        return datetime.now()
    try:
        # Standardize UTC indicator to '+00:00' for fromisoformat compatibility
        clean_str = iso_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is not None:
            # Convert to local timezone and strip timezone metadata to make it naive local
            return dt.astimezone().replace(tzinfo=None)
        return dt
    except Exception as e:
        print(f"[DATE PARSER] Warning: Failed to parse '{iso_str}', returning current time. Error: {e}")
        return datetime.now()

def recalculate_inventory_status(item: Inventory):
    item.recalculate_status()

# ==========================================
# AUDIT TRAIL HELPER
# ==========================================

# Maps internal table names to human-readable module labels for the Activity History UI.
TABLE_TO_MODULE: dict = {
    "orders":              "Job Orders",
    "items":               "Job Orders",
    "users":               "User Management",
    "roles":               "User Management",
    "inventory":           "Inventory",
    "inventory_logs":      "Inventory",
    "services":            "Services",
    "service_categories":  "Services",
    "expenses":            "Expenses",
    "auth":                "Authentication",
    "audit_logs":          "System",
    "backend_v2":          "System",
    "router_v2":           "System",
    "ml_engine":           "Machine Learning",
    "sales":               "Sales",
    "payments":            "Sales",
    "deliveries":          "Job Orders",
    "status_log":          "Job Orders",
    "customers":           "Job Orders",
}

def log_audit(
    db: Session,
    action: str,
    table_name: str,
    record_id: Optional[int] = None,
    user: Optional[Any] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    request: Optional[Any] = None,
    module: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Centralized, fail-safe audit log writer.

    Design Principles:
    - NEVER raises an exception. A logging failure must never abort a business transaction.
    - Captures username/role at event-time (forensic integrity — not via JOIN at query-time).
    - Automatically resolves module from table_name if not explicitly provided.

    Args:
        db:          Active SQLAlchemy session.
        action:      Action type string (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
        table_name:  The database table affected.
        record_id:   The primary key of the affected record.
        user:        The authenticated User ORM object (or None for system events).
        old_values:  Snapshot of values BEFORE the change (for UPDATE/DELETE).
        new_values:  Snapshot of values AFTER the change (for CREATE/UPDATE).
        request:     FastAPI Request object for IP/User-Agent extraction (optional).
        module:      Human-readable module override. Auto-resolved from table_name if not set.
    """
    try:
        resolved_module = module or TABLE_TO_MODULE.get(table_name, table_name.replace('_', ' ').title())

        ip_address = None
        user_agent = None
        if request is not None:
            try:
                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent", None)
                if user_agent and len(user_agent) > 255:
                    user_agent = user_agent[:252] + "..."
            except Exception:
                pass  # Never crash on metadata extraction

        entry = AuditLog(
            user_id=user.user_id if user else None,
            username=user.username if user else "system",
            role=user.role.role_name if (user and user.role) else "system",
            action_type=action,
            module=resolved_module,
            table_name=table_name,
            record_id=record_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        db.commit()
        return entry
    except Exception as audit_err:
        # CRITICAL: Swallow all exceptions. Log to console for server-side debugging only.
        # A broken audit logger must NEVER take down the application.
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[AUDIT WARNING] Failed to write audit log for action '{action}' on '{table_name}': {audit_err}")
        return None

print(f"\n[BOOT] Shoelotskey SMS v2.0 - Environment: {ENV} ({DB_TYPE})")

# Initialize FastAPI 
app = FastAPI(
    title="Shoelotskey 3NF & ML SMS",
    description="Backend API for Normalized Service Management",
    version="2.0.0",
    swagger_ui_parameters={"filter": True}
)

# Configure Templates for custom error pages
# Look in the same directory as main.py for the 'templates' folder
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# --- AUTOMATIC TABLE GEN (OWASP A03: Integrity Verification) ---
try:
    print("[INIT] Syncing Database Schema...")
    Base.metadata.create_all(bind=engine)
    print("[INIT] Database Schema OK.")
except Exception as e:
    print(f"[INIT] DB ERROR: {e}")

@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc: Exception):
    """
    Catches all 404 Not Found errors. 
    Returns JSON for API routes and the custom 404 HTML page for UI routes.
    """
    path = request.url.path
    
    # [VITAL FIX] If it's an API route, return JSON detail
    if path.startswith("/api"):
        detail = getattr(exc, "detail", "Not Found")
        return JSONResponse(status_code=404, content={"detail": detail})

    print(f"[404 ERROR] Trace: Route '{path}' not found.")
    
    # Log to DB for defense review
    try:
        db = SessionLocal()
        log_audit(
            db=db,
            action="404_NOT_FOUND",
            table_name="router_v2",
            record_id=0,
            user=None,
            old_values={"broken_url": path},
            new_values={
                "method": request.method,
                "client": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent")
            },
            request=request,
            module="Routing"
        )
    except: pass
    finally:
        if 'db' in locals(): db.close()

    return templates.TemplateResponse("404.html", {"request": request}, status_code=404)
    
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    OWASP A10: MISHANDLING OF EXCEPTIONAL CONDITIONS PREVENTION
    Catches all unhandled exceptions and returns a generic security-hardened message.
    """
    import traceback
    import sys

    # Extract traceback info
    exc_type, exc_value, exc_traceback = sys.exc_info()
    tb_list = traceback.extract_tb(exc_traceback)
    
    # Get the last meaningful frame
    file_name = "unknown"
    line_no = 0
    if tb_list:
        last_frame = tb_list[-1]
        file_name = os.path.basename(last_frame.filename)
        line_no = last_frame.lineno

    raw_msg = str(exc)
    safe_msg = sanitize_error(raw_msg)
    
    # [VITAL DEFENSE TOOL] Log to DB for Audit UI
    try:
        db = SessionLocal()
        log_audit(
            db=db,
            action="SERVER_ERROR",
            table_name="backend_v2",
            record_id=0,
            user=None,
            old_values={"error": raw_msg},
            new_values={
                "file": file_name,
                "line": line_no,
                "url": request.url.path,
                "method": request.method
            },
            request=request,
            module="System"
        )
    except: pass
    finally:
        if 'db' in locals(): db.close()

    print(f"[SECURITY ALERT] Unhandled Exception at {file_name}:{line_no} -> {raw_msg}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": safe_msg, 
            "error_id": str(uuid.uuid4())[:8],
            "debug_info": {"file": file_name, "line": line_no}
        }
    )

# Mount Brand Assets
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="brand_assets")

# Configure CORS for React compatibility (OWASP A05: Security Misconfiguration Hardening)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
env_origin = os.getenv("FRONTEND_URL")
if env_origin:
    origins.append(env_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 0.5 STARTUP HANDLERS
# ==========================================

@app.on_event("startup")
def startup_sequence():
    """BOOT SEQUENCE: Integrated Schema Migration, Integrity Checking, and Seeding."""
    print("\n" + "="*50)
    print(" SHOELOTSKEY SMS v2.0 - SYSTEM BOOT")
    print("="*50)
    print(f"[BOOT] Connecting to: {str(engine.url).split('@')[-1]}")
    
    # [USER REQUEST] Ensure local fallback database is ALWAYS ready even if we are online.
    # We briefly initialize the local SQLite engine to push the schema if it's missing.
    try:
        from sqlalchemy import create_engine
        local_engine = create_engine(LOCAL_SQLITE)
        Base.metadata.create_all(bind=local_engine)
        local_engine.dispose()
        print("[BOOT] Local Fallback (shoelotskey.db) Structure: OK.")
    except Exception as e:
        print(f"[BOOT] LOCAL DB SYNC WARNING: {e}")

    # 1. Base Schema Generation (Primary Engine)
    try:
        print("[DATABASE] SUCCESS: Linked")
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[BOOT] DATABASE ERROR: {e}")
        return # Cannot continue safely
    
    # 0. Connection check for Defense
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[DATABASE] SUCCESS: Linked to {DB_TYPE}")
    except Exception as e:
        print(f"[DATABASE] CRITICAL ERROR: Could not connect.")
        print(f"           Tip: Check if your IP is whitelisted or if the DB is active.")
        print(f"           Error Trace: {str(e)[:100]}...")

    # 1. Create Tables (Idempotent)
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    
    # 2. Dialect-Safe Migrations (Isolated for resilience)
    # User Table: Reset Tokens
    try:
        if "users" in existing_tables:
            columns = [c['name'] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "reset_token" not in columns:
                    try: conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)"))
                    except: pass
                if "reset_token_expiry" not in columns:
                    try: conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP"))
                    except: pass
    except Exception as e:
        print(f">>> Migration Warning (users table): {e}")

    # Items Table: Machine Learning Features (Condition Flags)
    try:
        if "items" in existing_tables:
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
                        try: conn.execute(text(f"ALTER TABLE items ADD COLUMN {col_name} {col_type}"))
                        except: pass
    except Exception as e:
        print(f">>> Migration Warning (items table): {e}")

    # Services Table: Sorting
    try:
        if "services" in existing_tables:
            columns = [c['name'] for c in inspector.get_columns("services")]
            if "sort_order" not in columns:
                print(">>> Migration: Adding sort_order to services")
                with engine.begin() as conn:
                    try: conn.execute(text("ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 0"))
                    except: pass
    except Exception as e:
        print(f">>> Migration Warning (services table): {e}")

    # Inventory Table: Automated Consumption Settings
    try:
        if "inventory" in existing_tables:
            columns = [c['name'] for c in inspector.get_columns("inventory")]
            active_is_sqlite = is_sqlite
            engines_to_migrate = [(engine, active_is_sqlite)]
            
            if not is_sqlite:
                try:
                    from sqlalchemy import create_engine
                    local_mig_engine = create_engine(LOCAL_SQLITE)
                    engines_to_migrate.append((local_mig_engine, True))
                except Exception as local_eng_err:
                    print(f"[SCHEMA MIGRATION WARNING] Could not load SQLite engine: {local_eng_err}")
                    
            for mig_engine, is_sqlite_target in engines_to_migrate:
                db_name = "SQLite" if is_sqlite_target else "PostgreSQL"
                try:
                    with mig_engine.connect() as check_conn:
                        target_inspector = inspect(mig_engine)
                        target_columns = [c['name'] for c in target_inspector.get_columns("inventory")]
                except Exception:
                    target_columns = columns
                    
                try:
                    with mig_engine.begin() as conn:
                        for col_name, col_type in [
                            ("auto_deduct", "BOOLEAN DEFAULT FALSE"),
                            ("auto_deduct_trigger", "VARCHAR(50) DEFAULT 'Job Started'"),
                            ("trigger_service", "VARCHAR(100) DEFAULT 'All'"),
                            ("consumption_qty", "DOUBLE PRECISION DEFAULT 0.0" if not is_sqlite_target else "REAL DEFAULT 0.0"),
                            ("consumption_unit", "VARCHAR(20) DEFAULT ''"),
                            ("package_size", "DOUBLE PRECISION DEFAULT 0.0" if not is_sqlite_target else "REAL DEFAULT 0.0"),
                            ("package_unit", "VARCHAR(20) DEFAULT ''"),
                            ("low_stock_threshold", "DOUBLE PRECISION DEFAULT 0.0" if not is_sqlite_target else "REAL DEFAULT 0.0")
                        ]:
                            if col_name not in target_columns:
                                try:
                                    conn.execute(text(f"ALTER TABLE inventory ADD COLUMN {col_name} {col_type}"))
                                    print(f">>> Migration: Added {col_name} to inventory in {db_name}")
                                except Exception:
                                    pass
                except Exception as mig_err:
                    print(f"[SCHEMA MIGRATION WARNING] Failed to migrate {db_name}: {mig_err}")
    except Exception as e:
        print(f">>> Migration Warning (inventory table): {e}")

    # 3. Data Normalization (Legacy 2.0 -> 3NF)
    try:
        if {"payments", "deliveries", "orders"}.issubset(existing_tables):
            order_cols = [c['name'] for c in inspector.get_columns('orders')]
            if "amount_received" in order_cols:
                with engine.begin() as conn:
                    conn.execute(text("""
                        INSERT INTO payments (order_id, method_id, status_id, amount_received, balance, reference_no, deposit_amount)
                        SELECT order_id, 1, 1, amount_received, balance, reference_no, deposit_amount
                        FROM orders WHERE order_id NOT IN (SELECT order_id FROM payments)
                    """))
    except Exception as e:
        print(f">>> Migration Warning (data normalization): {e}")

    # 4. Cleanup/Hygiene
    try:
        db_exec = SessionLocal()
        try:
            db_exec.execute(text("DELETE FROM services WHERE service_name LIKE '%Premium%'"))
            db_exec.commit()
        except:
            db_exec.rollback()
        finally:
            db_exec.close()
    except Exception as e:
        print(f">>> Migration Warning (cleanup): {e}")

    # 2. Schema Migration & Synchronization (Cross-Engine)
    # We ensure BOTH Cloud and Local mirror each other's structure
    engines_to_sync = [engine]
    if "sqlite" not in str(engine.url):
        from sqlalchemy import create_engine
        engines_to_sync.append(create_engine(LOCAL_SQLITE))

    for sync_engine in engines_to_sync:
        try:
            inspector = inspect(sync_engine)
            tables = inspector.get_table_names()
            is_pg = "postgresql" in str(sync_engine.url)
            json_type = "JSONB" if is_pg else "JSON"
            engine_name = "Cloud" if is_pg else "Local Fallback"
            
            with sync_engine.begin() as conn:
                # Fix ORDERS table
                if 'orders' in tables:
                    cols = [c['name'] for c in inspector.get_columns('orders')]
                    if 'inventory_applied' not in cols:
                        print(f">>> Migration ({engine_name}): Adding orders.inventory_applied")
                        conn.execute(text("ALTER TABLE orders ADD COLUMN inventory_applied BOOLEAN DEFAULT FALSE"))
                    if 'inventory_used' not in cols:
                        print(f">>> Migration ({engine_name}): Adding orders.inventory_used ({json_type})")
                        if is_pg:
                            conn.execute(text(f"ALTER TABLE orders ADD COLUMN inventory_used {json_type} DEFAULT '[]'::jsonb"))
                        else:
                            conn.execute(text(f"ALTER TABLE orders ADD COLUMN inventory_used {json_type} DEFAULT '[]'"))
                
                # Fix ITEMS table
                if 'items' in tables:
                    cols = [c['name'] for c in inspector.get_columns('items')]
                    if 'inventory_used' not in cols:
                        print(f">>> Migration ({engine_name}): Adding items.inventory_used ({json_type})")
                        if is_pg:
                            conn.execute(text(f"ALTER TABLE items ADD COLUMN inventory_used {json_type} DEFAULT '[]'::jsonb"))
                        else:
                            conn.execute(text(f"ALTER TABLE items ADD COLUMN inventory_used {json_type} DEFAULT '[]'"))
                
                # Fix INVENTORY table — add low_stock_threshold if missing
                if 'inventory' in tables:
                    inv_cols = [c['name'] for c in inspector.get_columns('inventory')]
                    if 'low_stock_threshold' not in inv_cols:
                        print(f">>> Migration ({engine_name}): Adding inventory.low_stock_threshold")
                        conn.execute(text("ALTER TABLE inventory ADD COLUMN low_stock_threshold FLOAT DEFAULT 0.0"))
                
        except Exception as e:
            print(f">>> Migration Warning ({sync_engine.url}): {e}")

    print(">>> Migration: Dual-Engine Schema check complete.")

    # --- NEW: Audit Logs Table Enhancement Migration ---
    # Adds the 5 forensic columns required for the improved Activity History module.
    # Runs against both Cloud (PostgreSQL) and Local (SQLite) engines for dual-engine parity.
    try:
        for sync_engine in engines_to_sync:
            is_pg = "postgresql" in str(sync_engine.url)
            engine_label = "PostgreSQL" if is_pg else "SQLite"
            try:
                al_inspector = inspect(sync_engine)
                if "audit_logs" in al_inspector.get_table_names():
                    # 1. ATOMIC MIGRATION: Drop NOT NULL constraint and convert action_type enum in isolated transactions
                    if is_pg:
                        try:
                            with sync_engine.begin() as pg_conn:
                                pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL"))
                            print(f">>> Migration ({engine_label}): Successfully executed ALTER TABLE audit_logs DROP NOT NULL on user_id and COMMITTED.")
                        except Exception as uid_err:
                            print(f">>> Migration Notice (audit_logs.user_id on {engine_label}): {uid_err}")

                        try:
                            with sync_engine.begin() as pg_conn:
                                pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN record_id DROP NOT NULL"))
                            print(f">>> Migration ({engine_label}): Successfully executed ALTER TABLE audit_logs DROP NOT NULL on record_id and COMMITTED.")
                        except Exception as rec_err:
                            print(f">>> Migration Notice (audit_logs.record_id on {engine_label}): {rec_err}")

                        try:
                            with sync_engine.begin() as pg_conn:
                                pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN action_type TYPE VARCHAR(100) USING action_type::text"))
                            print(f">>> Migration ({engine_label}): Successfully converted audit_logs.action_type from enum to VARCHAR(100) and COMMITTED.")
                        except Exception as act_err:
                            print(f">>> Migration Notice (audit_logs.action_type on {engine_label}): {act_err}")
                    else:
                        try:
                            with sync_engine.begin() as conn:
                                col_meta = {c['name']: c for c in al_inspector.get_columns("audit_logs")}
                                if 'user_id' in col_meta and not col_meta['user_id'].get('nullable', True):
                                    print(">>> Migration (SQLite): Rebuilding audit_logs to drop NOT NULL on user_id...")
                                    conn.execute(text("PRAGMA foreign_keys=off;"))
                                    conn.execute(text("ALTER TABLE audit_logs RENAME TO audit_logs_temp_old;"))
                                    conn.execute(text("""
                                        CREATE TABLE audit_logs (
                                            audit_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                                            username VARCHAR(50),
                                            role VARCHAR(20),
                                            action_type VARCHAR(30) NOT NULL,
                                            module VARCHAR(50),
                                            table_name VARCHAR(50) NOT NULL,
                                            record_id INTEGER,
                                            old_values JSON,
                                            new_values JSON,
                                            ip_address VARCHAR(50),
                                            user_agent VARCHAR(255),
                                            created_at TIMESTAMP
                                        );
                                    """))
                                    conn.execute(text("""
                                        INSERT INTO audit_logs (audit_log_id, user_id, username, role, action_type, module, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
                                        SELECT audit_log_id, user_id, username, role, action_type, module, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at
                                        FROM audit_logs_temp_old;
                                    """))
                                    conn.execute(text("DROP TABLE audit_logs_temp_old;"))
                                    conn.execute(text("PRAGMA foreign_keys=on;"))
                                    print(f">>> Migration ({engine_label}): Successfully executed ALTER TABLE audit_logs DROP NOT NULL on user_id and COMMITTED.")
                        except Exception as uid_err:
                            print(f">>> Migration Notice (audit_logs.user_id on {engine_label}): {uid_err}")

                    # Verify live database schema immediately after atomic commit
                    try:
                        post_insp = inspect(sync_engine)
                        for col in post_insp.get_columns("audit_logs"):
                            if col['name'] in ('user_id', 'action_type'):
                                print(f">>> Live Schema Verification ({engine_label}): audit_logs.{col['name']} type={col.get('type')} nullable={col.get('nullable', False)}")
                    except Exception as ver_err:
                        print(f">>> Schema Verification Notice ({engine_label}): {ver_err}")

                    # 2. ATOMIC MIGRATION: Add missing forensic columns (each in an isolated transaction)
                    al_cols = [c['name'] for c in al_inspector.get_columns("audit_logs")]
                    for col_name, pg_type, sq_type in [
                        ("username",   "VARCHAR(50)",  "VARCHAR(50)"),
                        ("role",       "VARCHAR(20)",  "VARCHAR(20)"),
                        ("module",     "VARCHAR(50)",  "VARCHAR(50)"),
                        ("ip_address", "VARCHAR(50)",  "VARCHAR(50)"),
                        ("user_agent", "VARCHAR(255)", "VARCHAR(255)"),
                    ]:
                        if col_name not in al_cols:
                            col_type = pg_type if is_pg else sq_type
                            print(f">>> Migration ({engine_label}): Adding audit_logs.{col_name}")
                            try:
                                with sync_engine.begin() as col_conn:
                                    col_conn.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {col_name} {col_type}"))
                            except Exception as col_err:
                                print(f">>> Migration Notice (adding {col_name} on {engine_label}): {col_err}")

                    # 3. ATOMIC MIGRATION: Composite performance indexes (each in an isolated transaction)
                    for idx_name, idx_cols in [
                        ("idx_audit_logs_username",    "username"),
                        ("idx_audit_logs_module",      "module"),
                        ("idx_audit_logs_action_type", "action_type"),
                        ("idx_audit_logs_created_at",  "created_at DESC" if is_pg else "created_at"),
                    ]:
                        try:
                            with sync_engine.begin() as idx_conn:
                                idx_conn.execute(text(
                                    f"CREATE INDEX IF NOT EXISTS {idx_name} ON audit_logs ({idx_cols})"
                                ))
                        except Exception:
                            pass
            except Exception as al_mig_err:
                print(f">>> Migration Warning (audit_logs on {engine_label}): {al_mig_err}")
    except Exception as al_outer_err:
        print(f">>> Migration Warning (audit_logs outer): {al_outer_err}")



    # 3. Seed Lookups & Static Data
    # ------------------------------------------
    db = SessionLocal()
    try:
        seed_lookups(db)
    finally:
        db.close()

    # The actual seeding is now handled within the seed_lookups function below.


# ==========================================
# 1. DATA SEEDING (S.O.L.I.D: Single Responsibility)
# ==========================================

def seed_lookups(db: Session):
    """Diagnose and seed essential database static data."""
    print(">>> System Initialization: Checking data integrity...")
    
    try:
        # 0. NORMALIZE EXISTING DATA (Persistence Defense)
        # ------------------------------------------
        db.execute(text("UPDATE status SET status_name = 'new-order'   WHERE status_name = 'Pending'"))
        db.execute(text("UPDATE status SET status_name = 'on-going'    WHERE status_name = 'In Progress'"))
        db.execute(text("UPDATE status SET status_name = 'for-release' WHERE status_name = 'Completed'"))
        db.execute(text("UPDATE status SET status_name = 'claimed'     WHERE status_name = 'Claimed'"))
        db.execute(text("UPDATE priority_levels SET priority_name = 'regular' WHERE priority_name = 'Regular'"))
        db.execute(text("UPDATE priority_levels SET priority_name = 'rush'    WHERE priority_name = 'Rush'"))
        db.execute(text("UPDATE payment_methods SET method_name = 'cash' WHERE method_name = 'Cash'"))
        db.execute(text("UPDATE payment_statuses SET status_name = 'fully-paid' WHERE status_name = 'Fully Paid'"))
        db.execute(text("UPDATE shipping_preferences SET pref_name = 'pickup' WHERE pref_name = 'Pickup'"))
        db.commit()
    except Exception as norm_err:
        db.rollback()
        print(f">>> Normalization Warning: {norm_err}")
    
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

    # Seed Payment Statuses — must match frontend: 'fully-paid', 'downpayment', 'unpaid'
    if db.query(PaymentStatus).count() == 0:
        print(">>> Seeding Payment Statuses...")
        db.add_all([PaymentStatus(status_name=s) for s in ['fully-paid', 'downpayment', 'unpaid', 'pending']])
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
        service_count = db.query(Service).count()
        
        if service_count == 0:
            # FIRST BOOT: Seed initial catalog from scratch
            print(">>> Catalog Sync: First boot detected, seeding full service catalog...")
            for item in catalog_data:
                # Be careful to get cat_id from names
                item_copy = item.copy()
                cat_name = item_copy.pop("category", "base")
                item_copy["category_id"] = cat_map.get(cat_name, cat_map.get("base"))
                db.add(Service(**item_copy))
            db.commit()
            print(">>> Catalog Sync: Initial seeding complete.")
        else:
            print(f">>> Catalog Sync: {service_count} services found. Ensuring required reglue additions exist...")
            # Auto-insert Midsole Full Reglue & Undersole Full Reglue if missing
            additional_services = [
                {"service_name": "Midsole Full Reglue", "base_price": 150, "category": "addon", "duration_days": 20, "service_code": "MFR", "is_active": True, "sort_order": 20},
                {"service_name": "Undersole Full Reglue", "base_price": 150, "category": "addon", "duration_days": 20, "service_code": "UFR", "is_active": True, "sort_order": 21},
            ]
            for item in additional_services:
                exists = db.query(Service).filter(Service.service_name == item["service_name"]).first()
                if not exists:
                    item_copy = item.copy()
                    cat_name = item_copy.pop("category", "base")
                    item_copy["category_id"] = cat_map.get(cat_name, cat_map.get("base"))
                    db.add(Service(**item_copy))
                    print(f"  -> Added missing service: {item['service_name']}")
            db.commit()
    except Exception as lock_err:
        db.rollback()
        print(f">>> Catalog Sync Warning: {lock_err}")

    # ------------------------------------------
    # 4. Inventory Record Seeding
    if db.query(Inventory).count() == 0:
        print(">>> Inventory Sync: First boot detected, seeding default chemicals and supplies...")
        # All stock_quantity values are in the INTERNAL unit (mL or g).
        # package_size = volume/weight of one package in internal units.
        # low_stock_threshold = alert level in internal units.
        # consumption_qty = amount used per order/service in internal units.
        inventory_defaults = [
            # Cleaner: 1 bottle = 4000 mL, start with 1 bottle (4000 mL), low stock = 1000 mL, 2000 mL/day
            {"item_name": "Cleaner",
             "category": "Chemical", "stock_quantity": 4000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "bottle",
             "low_stock_threshold": 1000.0, "consumption_qty": 2000.0, "consumption_unit": "mL"},
            # Bleach: 3 jugs default, 1 jug = 4000 mL -> 12000 mL; low stock = 1000 mL, 1000 mL/day
            {"item_name": "Bleach",
             "category": "Chemical", "stock_quantity": 12000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "jug",
             "low_stock_threshold": 1000.0, "consumption_qty": 1000.0, "consumption_unit": "mL"},
            # Stain Remover: 1 jug = 4000 mL; low stock = 1000 mL, 1000 mL/day
            {"item_name": "Stain Remover",
             "category": "Chemical", "stock_quantity": 4000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "jug",
             "low_stock_threshold": 1000.0, "consumption_qty": 1000.0, "consumption_unit": "mL"},
            # Leather Conditioner: 1 tub = 260 g; low stock = 50 g, 5 g/use
            {"item_name": "Leather Conditioner",
             "category": "Chemical", "stock_quantity": 260.0, "unit": "g",
             "package_size": 260.0, "package_unit": "tub",
             "low_stock_threshold": 50.0, "consumption_qty": 5.0, "consumption_unit": "g"},
            # Deodorizer: 1 box = 12 cans, 1 can = 360 mL -> start with 12 cans = 4320 mL
            # low stock = 1 can = 360 mL, 180 mL usage per order
            {"item_name": "Deodorizer",
             "category": "Chemical", "stock_quantity": 4320.0, "unit": "mL",
             "package_size": 360.0, "package_unit": "can",
             "low_stock_threshold": 360.0, "consumption_qty": 180.0, "consumption_unit": "mL"},
            # Non-liquid supplies (kept as-is, no packaging conversion)
            {"item_name": "Standard Shoe Cleaner",
             "category": "Chemicals", "stock_quantity": 25.0, "unit": "Bottles",
             "package_size": 0.0, "package_unit": "",
             "low_stock_threshold": 3.0, "consumption_qty": 1.0, "consumption_unit": "Bottles"},
            {"item_name": "Soft Bristle Brush",
             "category": "Tools", "stock_quantity": 15.0, "unit": "Pcs",
             "package_size": 0.0, "package_unit": "",
             "low_stock_threshold": 2.0, "consumption_qty": 1.0, "consumption_unit": "Pcs"},
            {"item_name": "Microfiber Cloth",
             "category": "Supplies", "stock_quantity": 50.0, "unit": "Pcs",
             "package_size": 0.0, "package_unit": "",
             "low_stock_threshold": 5.0, "consumption_qty": 1.0, "consumption_unit": "Pcs"}
        ]
        for item_data in inventory_defaults:
            threshold = item_data.get("low_stock_threshold", 0.0)
            qty = item_data["stock_quantity"]
            calc_status = "Critical" if qty <= 0 else ("Low Stock" if qty <= threshold else "In Stock")
            db.add(Inventory(**item_data, status=calc_status, is_active=True, unit_price=0.0))
        db.commit()
    else:
        # Perform internal unit migration for existing items: migrate legacy Cleaner/Bleach/etc.
        # that may have been seeded with old values.
        migration_map = {
            # item_name: (new_stock_qty, new_unit, new_pkg_size, new_pkg_unit, new_threshold, new_consumption)
            "Cleaner":            (4000.0,  "mL", 4000.0, "bottle", 1000.0, 2000.0, "mL"),
            "Bleach":             (12000.0, "mL", 4000.0, "jug",    1000.0, 1000.0, "mL"),
            "Stain Remover":      (4000.0,  "mL", 4000.0, "jug",    1000.0, 1000.0, "mL"),
            "Leather Conditioner":(260.0,   "g",  260.0,  "tub",     50.0,     5.0, "g"),
            "Deodorizer":         (4320.0,  "mL", 360.0,  "can",    360.0,  180.0, "mL"),
        }
        for name, (stock, unit, pkg_sz, pkg_unit, threshold, cons_qty, cons_unit) in migration_map.items():
            inv_item = db.query(Inventory).filter(Inventory.item_name == name).first()
            if inv_item:
                # Only migrate if unit doesn't match (prevents double migration)
                if inv_item.unit != unit:
                    print(f">>> Inventory Migration: Updating '{name}' to {unit}-based tracking")
                    inv_item.unit = unit
                    inv_item.package_size = pkg_sz
                    inv_item.package_unit = pkg_unit
                    inv_item.low_stock_threshold = threshold
                    inv_item.consumption_qty = cons_qty
                    inv_item.consumption_unit = cons_unit
                elif inv_item.low_stock_threshold == 0.0:
                    # Just update threshold/package info if missing
                    inv_item.package_size = pkg_sz
                    inv_item.package_unit = pkg_unit
                    inv_item.low_stock_threshold = threshold
                    inv_item.consumption_qty = cons_qty
                    inv_item.consumption_unit = cons_unit
                # Recalculate status with new threshold
                qty = inv_item.stock_quantity
                inv_item.status = "Critical" if qty <= 0 else ("Low Stock" if qty <= inv_item.low_stock_threshold else "In Stock")
        db.commit()

    # 5. User Account Seeding
    if db.query(User).count() == 0:
        print(">>> Seeding Default Accounts...")
        role_owner = db.query(Role).filter(Role.role_name == "owner").first()
        role_staff = db.query(Role).filter(Role.role_name == "staff").first()
        if role_owner:
            db.add(User(username="owner", email="owner@shoelotskey.com", password_hash=bcrypt.hash("owner123"), role_id=role_owner.role_id))
        if role_staff:
            db.add(User(username="staff", email="staff@shoelotskey.com", password_hash=bcrypt.hash("staff123"), role_id=role_staff.role_id))
        db.commit()

    # 5.5 Reconcile SQLite orders to PostgreSQL (Cloud) and purge stale diagnostic orders
    try:
        # Delete associated payments, items, delivery, etc for HEALTH- orders from PostgreSQL
        health_orders = db.query(Order).filter(Order.order_number.like('HEALTH-%')).all()
        if health_orders:
            for ho in health_orders:
                db.execute(text("DELETE FROM payments WHERE order_id = :oid"), {"oid": ho.order_id})
                db.execute(text("DELETE FROM deliveries WHERE order_id = :oid"), {"oid": ho.order_id})
                items = db.query(Item).filter(Item.order_id == ho.order_id).all()
                for item in items:
                    db.execute(text("DELETE FROM item_service_mapping WHERE item_id = :itid"), {"itid": item.item_id})
                    db.execute(text("DELETE FROM item_condition_mapping WHERE item_id = :itid"), {"itid": item.item_id})
                    db.delete(item)
                db.delete(ho)
            db.commit()
            print(f">>> Boot Cleanup: Purged {len(health_orders)} HEALTH- check orders.")
            
        # Reconcile any missing orders from SQLite backup to Cloud
        if not is_sqlite:
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            local_eng = create_engine(LOCAL_SQLITE)
            LocalSession = sessionmaker(bind=local_eng)
            with LocalSession() as ldb:
                # Also purge HEALTH- orders from local SQLite while we are at it
                ldb_health = ldb.query(Order).filter(Order.order_number.like('HEALTH-%')).all()
                if ldb_health:
                    for lho in ldb_health:
                        ldb.execute(text("DELETE FROM payments WHERE order_id = :oid"), {"oid": lho.order_id})
                        ldb.execute(text("DELETE FROM deliveries WHERE order_id = :oid"), {"oid": lho.order_id})
                        litems = ldb.query(Item).filter(Item.order_id == lho.order_id).all()
                        for li in litems:
                            ldb.execute(text("DELETE FROM item_service_mapping WHERE item_id = :itid"), {"itid": li.item_id})
                            ldb.execute(text("DELETE FROM item_condition_mapping WHERE item_id = :itid"), {"itid": li.item_id})
                            ldb.delete(li)
                        ldb.delete(lho)
                    ldb.commit()
                    print(f">>> Boot Cleanup (Local SQLite): Purged {len(ldb_health)} HEALTH- check orders.")

                # Scan for orders to sync to cloud (Batch-check to prevent sequential network roundtrips during server startup)
                existing_pg_order_nums = {o[0] for o in db.query(Order.order_number).all()}
                sqlite_orders = ldb.query(Order).all()
                for sq_order in sqlite_orders:
                    if sq_order.order_number.startswith("HEALTH-") or sq_order.order_number in existing_pg_order_nums:
                        continue
                    if True: # Retain indentation structure for reconciliation of new offline order
                        print(f"[RECONCILE] Syncing offline order {sq_order.order_number} to Cloud PostgreSQL...")
                        # A. Resolve Customer
                        sq_cust = ldb.query(Customer).filter(Customer.customer_id == sq_order.customer_id).first()
                        cust_name = sq_cust.customer_name if sq_cust else "Guest"
                        cust_phone = sq_cust.contact_number if sq_cust else "-"
                        pg_cust = db.query(Customer).filter(Customer.customer_name == cust_name, Customer.contact_number == cust_phone).first()
                        if not pg_cust:
                            pg_cust = Customer(
                                customer_name=cust_name,
                                contact_number=cust_phone,
                                created_at=sq_cust.created_at if sq_cust else datetime.now()
                            )
                            db.add(pg_cust)
                            db.flush()
                        
                        # Resolve user name
                        sq_user_name = ldb.execute(
                            text("SELECT username FROM users WHERE user_id = :user_id"),
                            {"user_id": sq_order.user_id}
                        ).scalar()
                        pg_user = db.query(User).filter(User.username == sq_user_name).first() if sq_user_name else None
                        if not pg_user:
                            pg_user = db.query(User).first()
                        
                        # Resolve status name
                        sq_status_name = ldb.execute(
                            text("SELECT status_name FROM status WHERE status_id = :status_id"),
                            {"status_id": sq_order.status_id}
                        ).scalar()
                        pg_status = db.query(Status).filter(Status.status_name == sq_status_name).first()
                        
                        # Resolve priority name
                        sq_prio_name = ldb.execute(
                            text("SELECT priority_name FROM priority_levels WHERE priority_id = :priority_id"),
                            {"priority_id": sq_order.priority_id}
                        ).scalar()
                        pg_prio = db.query(PriorityLevel).filter(PriorityLevel.priority_name == sq_prio_name).first()
                        
                        if not pg_status or not pg_prio:
                            print(f"[RECONCILE] Skipping order {sq_order.order_number} due to lookup mismatch.")
                            continue

                        # B. Create Order
                        pg_order = Order(
                            order_number=sq_order.order_number,
                            customer_id=pg_cust.customer_id,
                            status_id=pg_status.status_id,
                            priority_id=pg_prio.priority_id,
                            grand_total=sq_order.grand_total,
                            expected_at=sq_order.expected_at,
                            released_at=sq_order.released_at,
                            claimed_at=sq_order.claimed_at,
                            user_id=pg_user.user_id if pg_user else sq_order.user_id,
                            inventory_applied=sq_order.inventory_applied,
                            inventory_used=sq_order.inventory_used,
                            created_at=sq_order.created_at,
                            updated_at=sq_order.updated_at
                        )
                        db.add(pg_order)
                        db.flush()
                        
                        # C. Items
                        for sq_item in sq_order.items:
                            pg_item = Item(
                                order_id=pg_order.order_id,
                                brand=sq_item.brand,
                                shoe_model=sq_item.shoe_model,
                                material=sq_item.material,
                                quantity=sq_item.quantity,
                                item_notes=sq_item.item_notes,
                                inventory_used=sq_item.inventory_used
                            )
                            db.add(pg_item)
                            db.flush()
                            
                            # Services
                            sq_mappings = ldb.execute(
                                text("SELECT service_id, actual_price FROM item_service_mapping WHERE item_id = :item_id"),
                                {"item_id": sq_item.item_id}
                            ).fetchall()
                            for sq_svc_id, actual_price in sq_mappings:
                                sq_svc_name = ldb.execute(
                                    text("SELECT service_name FROM services WHERE service_id = :svc_id"),
                                    {"svc_id": sq_svc_id}
                                ).scalar()
                                pg_svc = db.query(Service).filter(Service.service_name == sq_svc_name).first()
                                if pg_svc:
                                    db.execute(
                                        text("INSERT INTO item_service_mapping (item_id, service_id, actual_price) VALUES (:item_id, :service_id, :actual_price)"),
                                        {"item_id": pg_item.item_id, "service_id": pg_svc.service_id, "actual_price": actual_price}
                                    )
                            
                            # Conditions
                            sq_cond_mappings = ldb.execute(
                                text("SELECT condition_id FROM item_condition_mapping WHERE item_id = :item_id"),
                                {"item_id": sq_item.item_id}
                            ).fetchall()
                            for (sq_cond_id,) in sq_cond_mappings:
                                sq_cond_name = ldb.execute(
                                    text("SELECT condition_name FROM conditions WHERE condition_id = :cond_id"),
                                    {"cond_id": sq_cond_id}
                                ).scalar()
                                pg_cond = db.query(Condition).filter(Condition.condition_name == sq_cond_name).first()
                                if pg_cond:
                                    db.execute(
                                        text("INSERT INTO item_condition_mapping (item_id, condition_id) VALUES (:item_id, :condition_id)"),
                                        {"item_id": pg_item.item_id, "condition_id": pg_cond.condition_id}
                                    )
                        
                        # D. Payments
                        for sq_pay in sq_order.payments:
                            sq_method_name = ldb.execute(
                                text("SELECT method_name FROM payment_methods WHERE method_id = :method_id"),
                                {"method_id": sq_pay.method_id}
                            ).scalar()
                            pg_method = db.query(PaymentMethod).filter(PaymentMethod.method_name == sq_method_name).first()
                            
                            sq_p_status_name = ldb.execute(
                                text("SELECT status_name FROM payment_statuses WHERE p_status_id = :status_id"),
                                {"status_id": sq_pay.status_id}
                            ).scalar()
                            pg_p_status = db.query(PaymentStatus).filter(PaymentStatus.status_name == sq_p_status_name).first()
                            
                            if pg_method and pg_p_status:
                                pg_pay = Payment(
                                    order_id=pg_order.order_id,
                                    method_id=pg_method.method_id,
                                    status_id=pg_p_status.p_status_id,
                                    amount_received=sq_pay.amount_received,
                                    balance=sq_pay.balance,
                                    reference_no=sq_pay.reference_no,
                                    deposit_amount=sq_pay.deposit_amount,
                                    created_at=sq_pay.created_at
                                )
                                db.add(pg_pay)
                        
                        # E. Delivery
                        if sq_order.delivery:
                            sq_del = sq_order.delivery
                            pg_del = Delivery(
                                order_id=pg_order.order_id,
                                pref_id=sq_del.pref_id,
                                delivery_address=sq_del.delivery_address,
                                delivery_courier=sq_del.delivery_courier,
                                release_time=sq_del.release_time,
                                province=sq_del.province,
                                city=sq_del.city,
                                barangay=sq_del.barangay,
                                zip_code=sq_del.zip_code
                            )
                            db.add(pg_del)
                            
                        db.commit()
                        print(f"[RECONCILE] Synced order {sq_order.order_number} successfully.")
            if 'local_eng' in locals():
                local_eng.dispose()
    except Exception as recon_err:
        db.rollback()
        print(f"[RECONCILE ERROR] Reconcile sequence failed: {recon_err}")

    # 6. Final Verification
    print(">>> System Boot: Database integrity verified. User modifications preserved.")

    # 7. Spawn Background Auto-Sync (Cloud -> Local SQLite)
    try:
        import threading
        import time
        from db.sync_to_local import sync_data
        
        def auto_sync_loop():
            # Wait 5 seconds after boot to ensure local backup is quickly synchronized in case internet drops
            time.sleep(5)
            while True:
                try:
                    if not is_sqlite:
                        print("[AUTO-SYNC] Running background cloud-to-local synchronization...")
                        sync_data()
                except Exception as sync_err:
                    print(f"[AUTO-SYNC ERROR] {sync_err}")
                # Synchronize every 10 minutes (600 seconds)
                time.sleep(600)
                
        threading.Thread(target=auto_sync_loop, daemon=True).start()
        print("[AUTO-SYNC] Background synchronization engine initialized.")
    except Exception as t_err:
        print(f"[AUTO-SYNC] Failed to initialize background thread: {t_err}")

# Startup events are now handled by startup_sequence()

@app.on_event("shutdown")
def shutdown_event():
    """Cleanly dispose database connection pools on Windows server termination or StatReload."""
    try:
        if engine:
            engine.dispose()
            print("[SHUTDOWN] Cleanly terminated database connection pool.")
    except Exception as e:
        print(f"[SHUTDOWN WARNING] {e}")

@app.get("/api/health-check")
def health_check_extended(db: Session = Depends(get_db)):
    """Diagnostic endpoint to verify DB connectivity and dialect."""
    import os
    has_offline_data = os.path.exists(LOCAL_SQLITE_PATH) and os.path.getsize(LOCAL_SQLITE_PATH) > 10240 
    
    return {
        "status": "online",
        "database": "SQLite (Backup)" if is_sqlite else "PostgreSQL (Remote)",
        "db_error": conn_error if is_sqlite else None,
        "backup_file": LOCAL_SQLITE_PATH,
        "has_pending_offline_data": has_offline_data if not is_sqlite else False,
        "timestamp": datetime.now()
    }



@app.post("/api/sync-backup-to-cloud")
def sync_backup_to_cloud(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Admin-only: Pull data from SQLite backup file and push to Cloud PostgreSQL."""
    if is_sqlite:
        raise HTTPException(status_code=400, detail="Cannot sync: Currently running on Backup mode. Connect to Cloud first.")

    import sqlite3
    import os
    offline_path = LOCAL_SQLITE_PATH
    if not os.path.exists(offline_path):
        return {"message": "No backup file found."}

    try:
        conn = sqlite3.connect(offline_path)
        cursor = conn.cursor()
        
        # 1. Fetch orders from SQLite that don't exist in PG
        # We query all fields to fully copy the relational graph
        cursor.execute("""
            SELECT order_id, order_number, customer_id, status_id, priority_id, 
                   grand_total, expected_at, released_at, claimed_at, user_id, 
                   inventory_applied, inventory_used, created_at, updated_at 
            FROM orders
        """)
        offline_orders = cursor.fetchall()
        
        import json
        synced_count = 0
        for off_o in offline_orders:
            exists = db.query(Order).filter(Order.order_number == off_o[1]).first()
            if not exists:
                # Resolve Customer Info from SQLite
                cursor.execute("SELECT customer_name, contact_number FROM customers WHERE customer_id = ?", (off_o[2],))
                cust_row = cursor.fetchone()
                if not cust_row:
                    continue  # Skip order if customer metadata doesn't exist
                c_name, c_contact = cust_row

                # Find or Create Customer in PG
                c_pg = db.query(Customer).filter(
                    Customer.customer_name == c_name, 
                    Customer.contact_number == c_contact
                ).first()
                if not c_pg:
                    c_pg = Customer(customer_name=c_name, contact_number=c_contact)
                    db.add(c_pg)
                    db.flush()

                # Resolve Status Lookup
                cursor.execute("SELECT status_name FROM status WHERE status_id = ?", (off_o[3],))
                st_row = cursor.fetchone()
                st_name = st_row[0] if st_row else "new-order"
                st_pg = db.query(Status).filter(Status.status_name == st_name).first()
                st_id = st_pg.status_id if st_pg else 1

                # Resolve Priority Lookup
                cursor.execute("SELECT priority_name FROM priority_levels WHERE priority_id = ?", (off_o[4],))
                pr_row = cursor.fetchone()
                pr_name = pr_row[0] if pr_row else "regular"
                pr_pg = db.query(PriorityLevel).filter(PriorityLevel.priority_name == pr_name).first()
                pr_id = pr_pg.priority_id if pr_pg else 1

                # Resolve User Lookup
                cursor.execute("SELECT username FROM users WHERE user_id = ?", (off_o[9],))
                usr_row = cursor.fetchone()
                usr_name = usr_row[0] if usr_row else "admin"
                usr_pg = db.query(User).filter(User.username == usr_name).first()
                usr_id = usr_pg.user_id if usr_pg else 1

                # Deserialize inventory_used JSON safely
                inv_used_data = None
                if off_o[11]:
                    try:
                        inv_used_data = json.loads(off_o[11])
                    except Exception:
                        pass

                # Create Order in PG
                new_o = Order(
                    order_number=off_o[1],
                    customer_id=c_pg.customer_id,
                    status_id=st_id,
                    priority_id=pr_id,
                    grand_total=off_o[5],
                    expected_at=datetime.fromisoformat(off_o[6]) if off_o[6] else None,
                    released_at=datetime.fromisoformat(off_o[7]) if off_o[7] else None,
                    claimed_at=datetime.fromisoformat(off_o[8]) if off_o[8] else None,
                    user_id=usr_id,
                    inventory_applied=bool(off_o[10]),
                    inventory_used=inv_used_data,
                    created_at=datetime.fromisoformat(off_o[12]) if off_o[12] else datetime.now(),
                    updated_at=datetime.fromisoformat(off_o[13]) if off_o[13] else datetime.now()
                )
                db.add(new_o)
                db.flush()

                # Sync Items for this order
                cursor.execute("""
                    SELECT item_id, brand, material, shoe_model, quantity, item_notes, inventory_used 
                    FROM items WHERE order_id = ?
                """, (off_o[0],))
                offline_items = cursor.fetchall()
                for off_item in offline_items:
                    old_item_id = off_item[0]
                    item_inv_used = None
                    if off_item[6]:
                        try:
                            item_inv_used = json.loads(off_item[6])
                        except Exception:
                            pass

                    new_item = Item(
                        order_id=new_o.order_id,
                        brand=off_item[1],
                        material=off_item[2],
                        shoe_model=off_item[3],
                        quantity=off_item[4],
                        item_notes=off_item[5],
                        inventory_used=item_inv_used
                    )
                    db.add(new_item)
                    db.flush()

                    # Copy Item Service Mappings
                    cursor.execute("SELECT service_id, actual_price FROM item_service_mapping WHERE item_id = ?", (old_item_id,))
                    for mapping in cursor.fetchall():
                        cursor.execute("SELECT service_name, service_code FROM services WHERE service_id = ?", (mapping[0],))
                        svc_row = cursor.fetchone()
                        if svc_row:
                            svc_name, svc_code = svc_row
                            svc_pg = db.query(Service).filter(
                                (Service.service_code == svc_code) | (Service.service_name == svc_name)
                            ).first()
                            if svc_pg:
                                db.add(ItemServiceMapping(
                                    item_id=new_item.item_id,
                                    service_id=svc_pg.service_id,
                                    actual_price=mapping[1]
                                ))

                    # Copy Item Condition Mappings
                    cursor.execute("SELECT condition_id FROM item_condition_mapping WHERE item_id = ?", (old_item_id,))
                    for mapping in cursor.fetchall():
                        cursor.execute("SELECT condition_name FROM conditions WHERE condition_id = ?", (mapping[0],))
                        cond_row = cursor.fetchone()
                        if cond_row:
                            cond_name = cond_row[0]
                            cond_pg = db.query(Condition).filter(Condition.condition_name == cond_name).first()
                            if cond_pg:
                                db.add(ItemConditionMapping(
                                    item_id=new_item.item_id,
                                    condition_id=cond_pg.condition_id
                                ))

                # Sync Payments for this order
                cursor.execute("""
                    SELECT method_id, status_id, amount_received, balance, reference_no, deposit_amount, created_at 
                    FROM payments WHERE order_id = ?
                """, (off_o[0],))
                for p_row in cursor.fetchall():
                    cursor.execute("SELECT method_name FROM payment_methods WHERE method_id = ?", (p_row[0],))
                    pm_row = cursor.fetchone()
                    pm_name = pm_row[0] if pm_row else 'cash'
                    pm_pg = db.query(PaymentMethod).filter(PaymentMethod.method_name == pm_name).first()
                    pm_id_pg = pm_pg.method_id if pm_pg else 1

                    cursor.execute("SELECT status_name FROM payment_statuses WHERE p_status_id = ?", (p_row[1],))
                    ps_row = cursor.fetchone()
                    ps_name = ps_row[0] if ps_row else 'unpaid'
                    ps_pg = db.query(PaymentStatus).filter(PaymentStatus.status_name == ps_name).first()
                    ps_id_pg = ps_pg.p_status_id if ps_pg else 1

                    db.add(Payment(
                        order_id=new_o.order_id,
                        method_id=pm_id_pg,
                        status_id=ps_id_pg,
                        amount_received=p_row[2],
                        balance=p_row[3],
                        reference_no=p_row[4],
                        deposit_amount=p_row[5],
                        created_at=datetime.fromisoformat(p_row[6]) if p_row[6] else datetime.now()
                    ))

                # Sync Delivery details for this order
                cursor.execute("""
                    SELECT pref_id, delivery_address, delivery_courier, release_time, province, city, barangay, zip_code 
                    FROM deliveries WHERE order_id = ?
                """, (off_o[0],))
                d_row = cursor.fetchone()
                if d_row:
                    cursor.execute("SELECT pref_name FROM shipping_preferences WHERE pref_id = ?", (d_row[0],))
                    sp_row = cursor.fetchone()
                    sp_name = sp_row[0] if sp_row else 'pickup'
                    sp_pg = db.query(ShippingPreference).filter(ShippingPreference.pref_name == sp_name).first()
                    sp_id_pg = sp_pg.pref_id if sp_pg else 1

                    db.add(Delivery(
                        order_id=new_o.order_id,
                        pref_id=sp_id_pg,
                        delivery_address=d_row[1],
                        delivery_courier=d_row[2],
                        release_time=d_row[3],
                        province=d_row[4],
                        city=d_row[5],
                        barangay=d_row[6],
                        zip_code=d_row[7]
                    ))

                synced_count += 1
            else:
                # Update existing order if status changed while offline
                cursor.execute("SELECT status_name FROM status WHERE status_id = ?", (off_o[3],))
                st_row = cursor.fetchone()
                st_name = st_row[0] if st_row else None
                if st_name and (not exists.status or exists.status.status_name != st_name):
                    st_pg = db.query(Status).filter(Status.status_name == st_name).first()
                    if st_pg:
                        exists.status_id = st_pg.status_id
                        exists.updated_at = datetime.fromisoformat(off_o[13]) if off_o[13] and isinstance(off_o[13], str) else (off_o[13] or datetime.now())
                        synced_count += 1

        # 1.5. Sync inventory from SQLite to PG
        try:
            cursor.execute("SELECT item_name, category, stock_quantity, unit, unit_price, status, is_active, auto_deduct, auto_deduct_trigger, trigger_service, consumption_qty, consumption_unit, package_size, package_unit FROM inventory")
            offline_inventory = cursor.fetchall()
            for off_i in offline_inventory:
                exists_i = db.query(Inventory).filter(Inventory.item_name == off_i[0]).first()
                i_name, i_cat, i_stock, i_unit, i_price, i_status, i_active, i_auto, i_trigger, i_service, i_cq, i_cu, i_ps, i_pu = off_i
                
                i_active_bool = bool(i_active)
                i_auto_bool = bool(i_auto)
                
                if not exists_i:
                    new_i = Inventory(
                        item_name=i_name,
                        category=i_cat,
                        stock_quantity=i_stock,
                        unit=i_unit,
                        unit_price=i_price,
                        status=i_status,
                        is_active=i_active_bool,
                        auto_deduct=i_auto_bool,
                        auto_deduct_trigger=i_trigger,
                        trigger_service=i_service,
                        consumption_qty=i_cq,
                        consumption_unit=i_cu,
                        package_size=i_ps,
                        package_unit=i_pu
                    )
                    db.add(new_i)
                else:
                    exists_i.category = i_cat
                    exists_i.stock_quantity = i_stock
                    exists_i.unit = i_unit
                    exists_i.unit_price = i_price
                    exists_i.status = i_status
                    exists_i.is_active = i_active_bool
                    exists_i.auto_deduct = i_auto_bool
                    exists_i.auto_deduct_trigger = i_trigger
                    exists_i.trigger_service = i_service
                    exists_i.consumption_qty = i_cq
                    exists_i.consumption_unit = i_cu
                    exists_i.package_size = i_ps
                    exists_i.package_unit = i_pu
            print("[SYNC] Inventory table sync processed successfully.")
        except Exception as inv_sync_err:
            print(f"[SYNC WARNING] Skipping inventory table sync: {inv_sync_err}")

        # 1.6. Sync expenses from SQLite to PG
        try:
            cursor.execute("SELECT amount, description, expense_date, user_id, created_at FROM expenses")
            for off_exp in cursor.fetchall():
                exists_exp = db.query(Expense).filter(Expense.description == off_exp[1], Expense.amount == off_exp[0]).first()
                if not exists_exp:
                    cursor.execute("SELECT username FROM users WHERE user_id = ?", (off_exp[3],))
                    usr_row = cursor.fetchone()
                    usr_name = usr_row[0] if usr_row else "owner"
                    usr_pg = db.query(User).filter(User.username == usr_name).first()
                    u_id = usr_pg.user_id if usr_pg else 1
                    
                    new_exp = Expense(
                        amount=off_exp[0],
                        description=off_exp[1],
                        expense_date=datetime.fromisoformat(off_exp[2]) if off_exp[2] and isinstance(off_exp[2], str) else (off_exp[2] or datetime.now()),
                        user_id=u_id,
                        created_at=datetime.fromisoformat(off_exp[4]) if off_exp[4] and isinstance(off_exp[4], str) else (off_exp[4] or datetime.now())
                    )
                    db.add(new_exp)
                    synced_count += 1
            print("[SYNC] Expenses table sync processed successfully.")
        except Exception as exp_sync_err:
            print(f"[SYNC WARNING] Skipping expenses table sync: {exp_sync_err}")

        # 1.7. Sync audit_logs from SQLite to PG
        try:
            cursor.execute("SELECT username, role, action_type, module, table_name, record_id, old_values, new_values, ip_address FROM audit_logs")
            for off_log in cursor.fetchall():
                exists_log = db.query(AuditLog).filter(
                    AuditLog.action_type == off_log[2],
                    AuditLog.module == off_log[3],
                    AuditLog.table_name == off_log[4],
                    AuditLog.username == off_log[0]
                ).all()
                is_dup = any(str(x.new_values) == str(off_log[7]) for x in exists_log) if exists_log else False
                if not is_dup:
                    new_log = AuditLog(
                        username=off_log[0],
                        role=off_log[1],
                        action_type=off_log[2],
                        module=off_log[3],
                        table_name=off_log[4],
                        record_id=off_log[5],
                        old_values=json.loads(off_log[6]) if off_log[6] and isinstance(off_log[6], str) else off_log[6],
                        new_values=json.loads(off_log[7]) if off_log[7] and isinstance(off_log[7], str) else off_log[7],
                        ip_address=off_log[8]
                    )
                    db.add(new_log)
            print("[SYNC] Audit logs table sync processed successfully.")
        except Exception as log_sync_err:
            print(f"[SYNC WARNING] Skipping audit_logs table sync: {log_sync_err}")
        
        db.commit()
        conn.close()
        
        # Active database is kept intact and synced (No file duplication/renaming)
        
        return {"status": "success", "synced_records": synced_count}
    except Exception as e:
        print(f"[RECONCILE ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# ==========================================
# 0.6 CAPSTONE STORED PROCEDURE DEMO
# ==========================================
@app.post("/api/trigger-analytics-procedure")
def trigger_daily_sales_procedure(db: Session = Depends(get_db)):
    """
    Capstone Defense Route: Manually executes the PostgreSQL Stored Procedure 
    instead of waiting for the midnight pg_cron job. Falls back to SQLite emulation 
    if running offline (Hybrid Persistence Bridge).
    """
    if is_sqlite:
        try:
            # 1. Ensure the caching table exists in SQLite
            db.execute(text("""
            CREATE TABLE IF NOT EXISTS daily_analytics_summary (
                summary_date DATE PRIMARY KEY,
                total_revenue DECIMAL(10, 2) DEFAULT 0.0,
                total_job_orders INT DEFAULT 0
            );
            """))
            db.commit()
            
            # 2. Calculate target date (yesterday)
            target_date = (datetime.utcnow() - timedelta(days=1)).date()
            target_date_str = target_date.strftime("%Y-%m-%d")
            
            # 3. Aggregate totals from normalized orders table
            result = db.execute(text("""
            SELECT COALESCE(SUM(grand_total), 0.0), COUNT(order_id)
            FROM orders
            WHERE DATE(created_at) = :target_date
            """), {"target_date": target_date_str}).first()
            
            calc_revenue = float(result[0]) if result else 0.0
            calc_orders = int(result[1]) if result else 0
            
            # 4. Upsert (Insert or Update) into daily_analytics_summary
            db.execute(text("""
            INSERT INTO daily_analytics_summary (summary_date, total_revenue, total_job_orders)
            VALUES (:target_date, :revenue, :orders)
            ON CONFLICT (summary_date) 
            DO UPDATE SET 
                total_revenue = EXCLUDED.total_revenue,
                total_job_orders = EXCLUDED.total_job_orders;
            """), {"target_date": target_date_str, "revenue": calc_revenue, "orders": calc_orders})
            db.commit()
            
            # 5. Verify the result
            verify_res = db.execute(text(
                "SELECT summary_date, total_revenue, total_job_orders "
                "FROM daily_analytics_summary "
                "ORDER BY summary_date DESC LIMIT 1"
            )).first()
            
            return {
                "status": "success",
                "message": "Daily Sales Aggregation (SQLite Emulated Procedure) executed successfully.",
                "cache_record_created": {
                    "date": str(verify_res[0]) if verify_res else None,
                    "total_revenue": float(verify_res[1]) if verify_res else 0.0,
                    "total_orders": int(verify_res[2]) if verify_res else 0
                }
            }
        except Exception as e:
            db.rollback()
            print(f"[SQLITE PROCEDURE ERROR] {e}")
            raise HTTPException(status_code=500, detail=f"SQLite procedure emulation failed: {str(e)}")
        
    try:
        # Native SQL command to explicitly execute a Procedure in Postgres
        db.execute(text("CALL generate_daily_sales_summary()"))
        db.commit()
        
        # Verify the result from the caching table
        result = db.execute(text(
            "SELECT summary_date, total_revenue, total_job_orders "
            "FROM daily_analytics_summary "
            "ORDER BY summary_date DESC LIMIT 1"
        )).first()
        
        return {
            "status": "success",
            "message": "Daily Sales Aggregation Stored Procedure executed successfully.",
            "cache_record_created": {
                "date": str(result[0]) if result else None,
                "total_revenue": float(result[1]) if result else 0.0,
                "total_orders": int(result[2]) if result else 0
            }
        }
    except Exception as e:
        db.rollback()
        print(f"[PROCEDURE ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Procedure execution failed: Ensure setup_stored_procedure.py was run first. Error: {str(e)}")

# ==========================================
# 1. AUTHENTICATION & SECURITY
# ==========================================

@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db), http_request: Request = None):
    """
    LOGIC: User Authentication with 3-Attempt Locking
    1. Query User + Related Role
    2. Check if account is currently locked
    3. Verify password & manage failed attempts
    """
    print(f"[AUTH] Trace: Login attempt for '{request.username}'")
    
    try:

        db_user = db.query(User).options(joinedload(User.role)).filter(
            or_(User.username == request.username, User.email == request.username)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # 1. CHECK LOCK STATUS
        if db_user.locked_until and db_user.locked_until > datetime.utcnow():
            remaining = (db_user.locked_until - datetime.utcnow()).total_seconds() / 60
            print(f"[AUTH] Denied: Account '{request.username}' is locked for {remaining:.1f} more mins.")
            raise HTTPException(
                status_code=403, 
                detail=f"Account locked. Try again in {int(remaining)} minutes."
            )

        # 2. VALIDATE PASSWORD (Bcrypt with Plaintext Migration)
        pw_match = False
        try:
            pw_match = bcrypt.verify(request.password, db_user.password_hash)
        except:
            # Legacy Plaintext Fallback & Migration
            if db_user.password_hash == request.password:
                pw_match = True
                # Migrate to hash automatically
                db_user.password_hash = bcrypt.hash(request.password)
                db.commit()

        if pw_match:
            # SUCCESS: Reset attempts and unlock
            db_user.failed_login_attempts = 0
            db_user.locked_until = None
            db.commit()
            
            print(f"[AUTH] Granted: {db_user.username} authenticated.")
            access_token = create_access_token(data={"sub": db_user.username})
            
            # Security Log: Success (OWASP A09) — FIXED: removed request.headers (LoginRequest has no .headers)
            log_audit(
                db=db, action="LOGIN", table_name="auth",
                record_id=db_user.user_id, user=db_user,
                new_values={"status": "success"},
                request=http_request, module="Authentication",
            )

            return {
                "user_id": db_user.user_id,
                "username": db_user.username,
                "role": db_user.role.role_name,
                "email": db_user.email,
                "access_token": access_token,
                "token_type": "bearer"
            }
        else:
            # FAILURE: Increment attempts
            db_user.failed_login_attempts += 1
            if db_user.failed_login_attempts >= 3:
                db_user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                db.commit()
                print(f"[AUTH] Security: Account '{request.username}' locked for 15 mins (3 failures).")
                # Audit: Account locked
                log_audit(
                    db=db, action="LOGIN_FAILED", table_name="auth",
                    record_id=db_user.user_id, user=db_user,
                    new_values={"reason": "account_locked", "failed_attempts": db_user.failed_login_attempts},
                    request=http_request, module="Authentication",
                )
                raise HTTPException(
                    status_code=403, 
                    detail="Too many failed attempts. Account locked for 15 minutes."
                )
            
            db.commit()
            print(f"[AUTH] Denied: Fail #{db_user.failed_login_attempts} for '{request.username}'.")
            # Audit: Failed login attempt
            log_audit(
                db=db, action="LOGIN_FAILED", table_name="auth",
                record_id=db_user.user_id, user=db_user,
                new_values={"reason": "wrong_password", "failed_attempts": db_user.failed_login_attempts},
                request=http_request, module="Authentication",
            )
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FATAL ERROR] Auth System Failure: {e}")
        raise HTTPException(status_code=500, detail="Internal Authentication Error")

@app.post("/api/logout")
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Logout endpoint purely for audit trail logging.
    JWTs are stateless — the actual token invalidation happens client-side by clearing localStorage.
    This endpoint records the LOGOUT event so it appears in the Activity History.
    """
    log_audit(
        db=db, action="LOGOUT", table_name="auth",
        record_id=current_user.user_id, user=current_user,
        new_values={"status": "logged_out"},
        module="Authentication",
    )
    print(f"[AUTH] Logout recorded for: {current_user.username}")
    return {"status": "success", "message": "Logout recorded"}


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
                <p style="font-size: 11px; color: #999; text-align: center;">Shoelotskey Villamor-Pasay, Metro Manila</p>
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
    user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # Dynamic Host Detection
    requested_host = request.headers.get("host", "shoelotskey-villamor-pasay.herokuapp.com")
    protocol = "https" if "herokuapp.com" in requested_host or ".app" in requested_host else "http"
    
    # Construction: Reset Link
    reset_link = f"{protocol}://{requested_host}/reset-password?token={token}"
    
    # Debug: Print for logs
    print(f"[AUTH] Generated Reset Link: {reset_link}")

    status = send_reset_email(user.email, reset_link)
    
    # Build response data, hiding debug_token in production
    if ENV == "Production":
        res_success = {"message": "Reset email sent successfully"}
        res_fail = {"message": "Password recovery link generated."}
    else:
        res_success = {"message": "Reset email sent successfully", "debug_token": token}
        res_fail = {"message": "Password recovery link generated.", "debug_token": token}

    if status == 200:
        return res_success
    else:
        # For Defense/Localhost: We print the link to the console if Mailgun fails (mock mode)
        print("\n" + "*"*60)
        print(" [DEVELOPER MODE] PASSWORD RESET LINK GENERATED")
        print(f" LINK: {reset_link}")
        print("*"*60 + "\n")
        return res_fail

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    import os
    from datetime import datetime
    import traceback
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.abspath(os.path.join(base_dir, "..", "dist", "index.html"))
    build_time = "Unknown"
    if os.path.exists(index_path):
        mtime = os.path.getmtime(index_path)
        build_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')

    counts = {}
    user_ids = []
    try:
        counts["users"] = db.query(User).count()
        counts["roles"] = db.query(Role).count()
        counts["statuses"] = db.query(Status).count()
        counts["priorities"] = db.query(PriorityLevel).count()
        counts["orders"] = db.query(Order).count()
        user_ids = [u.user_id for u in db.query(User).limit(5).all()]
    except Exception as e:
        counts["error"] = str(e)

    error_str = "Skipped (Disabled to prevent DB pollution)"

    return {
        "status": "ok", 
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "environment": ENV, 
        "version": "2.0.3-diagnostic",
        "running_from": base_dir,
        "build_time": build_time,
        "counts": counts,
        "sample_user_ids": user_ids,
        "create_order_diagnostic": error_str,
        "db_type": DB_TYPE
    }

@app.post("/api/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db), http_request: Request = None):
    """Verifies the token and updates the password header."""
    print(f"[AUTH] Verifying reset token...")
    user = db.query(User).options(joinedload(User.role)).filter(User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    # 2. Check Expiry
    if user.reset_token_expiry and user.reset_token_expiry < datetime.utcnow():
        print(f"[AUTH] Expired token used for {user.username}")
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    # 1. Update password (Secure Hashing)
    user.password_hash = bcrypt.hash(request.new_password)
    user.reset_token = None # Clear token after use
    user.reset_token_expiry = None
    db.commit()
    
    # Audit trail logging: record password reset event without exposing secret hash values
    log_audit(
        db=db, action="PASSWORD_RESET", table_name="auth",
        record_id=user.user_id, user=user,
        old_values={"password_hash": "[PROTECTED_OLD_HASH]", "reset_token_status": "active"},
        new_values={"password_hash": "[PROTECTED_NEW_HASH]", "reset_token_status": "cleared", "details": f"Password reset completed for account '{user.username}'"},
        request=http_request, module="Authentication",
    )

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
            "predicted_days": int(round((predicted_dt - datetime.now()).total_seconds() / 86400.0)),
            "status": "success",
            "engine": "Shoelotskey SPE v1.0"
        }
    except Exception as e:
        print(f"[ML ERROR] {e}")
        # Return a safe fallback (10 days)
        fallback = datetime.now() + timedelta(days=10)
        return {"predicted_date": fallback.isoformat(), "status": "fallback", "error": str(e)}

@app.post("/api/ml/train")
def train_model(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Triggers retraining of the ML model based on history (Owner only)."""
    success = predictor.train_from_history(db)
    if success:
        log_audit(
            db=db, action="ML_TRAIN", table_name="ml_engine",
            user=current_user, new_values={"status": "success", "retrained_by": current_user.username},
            module="Machine Learning",
        )
        return {"message": "Model retrained successfully"}
    else:
        return {"message": "Retraining skipped - insufficient historical data"}

# ==========================================
# 2.5 USER MANAGEMENT
# ==========================================

@app.get("/api/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Fetch all users (Owner only - OWASP A01)."""
    users = db.query(User).options(joinedload(User.role)).all()
    return users

@app.post("/api/users", response_model=UserSchema)
def create_user(user_data: UserCreateSchema, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Create a new account (Owner only - OWASP A01)."""
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
        password_hash=bcrypt.hash(user_data.password),
        role_id=db_role.role_id,
        is_active=user_data.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_audit(
        db=db, action="CREATE", table_name="users",
        record_id=new_user.user_id, user=current_user,
        new_values={"username": new_user.username, "email": new_user.email, "role": user_data.role_name},
        module="User Management",
    )
    return new_user

@app.put("/api/users/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_update: UserUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Update user details (Owner only)."""
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Capture before-state for audit diff
    old_snapshot = {
        "username": db_user.username,
        "email": db_user.email,
        "is_active": db_user.is_active,
    }

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
        db_user.password_hash = bcrypt.hash(user_update.password)
        
    # [PRIORITY 2 FIX] Prevent demotion or deactivation of the last active Owner
    is_demoting = user_update.role_name and user_update.role_name != 'owner'
    is_deactivating = user_update.is_active is False
    if db_user.role.role_name == 'owner' and db_user.is_active and (is_demoting or is_deactivating):
        active_owner_count = db.query(User).join(Role).filter(Role.role_name == 'owner', User.is_active == True).count()
        if active_owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote or deactivate the last active owner account")

    if user_update.role_name:
        db_role = db.query(Role).filter(Role.role_name == user_update.role_name).first()
        if not db_role:
            raise HTTPException(status_code=400, detail="Invalid role specified")
        db_user.role_id = db_role.role_id
        
    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active

    db.commit()
    db.refresh(db_user)
    log_audit(
        db=db, action="UPDATE", table_name="users",
        record_id=user_id, user=current_user,
        old_values=old_snapshot,
        new_values={"username": db_user.username, "email": db_user.email, "is_active": db_user.is_active},
        module="User Management",
    )
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Remove user access (Owner only). Deactivates account if historical transactions exist to preserve referential integrity."""
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent deleting the last owner
    if db_user.role.role_name == 'owner':
        owner_count = db.query(User).join(Role).filter(Role.role_name == 'owner').count()
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last owner account")

    # [PRIORITY 1 FIX] Prevent Foreign Key constraint violations and preserve audit trail integrity:
    # If the user has any transaction history (Orders, Expenses, Status Logs, Inventory Logs), deactivate instead of hard-deleting.
    has_history = (
        db.query(Order.order_id).filter(Order.processor_id == user_id).first() or
        db.query(Expense.expense_id).filter(Expense.user_id == user_id).first() or
        db.query(StatusLog.log_id).filter(StatusLog.user_id == user_id).first() or
        db.query(InventoryLog.log_id).filter(InventoryLog.user_id == user_id).first()
    )
    if has_history:
        db_user.is_active = False
        db.commit()
        log_audit(
            db=db, action="UPDATE", table_name="users",
            record_id=user_id, user=current_user,
            old_values={"is_active": True},
            new_values={"is_active": False, "reason": "Deactivated instead of hard deletion due to historical transactions"},
            module="User Management",
        )
        return {"status": "success", "message": f"User {user_id} has historical transactions and was deactivated instead of deleted."}

    # Capture before-state for audit trail (after deletion the record is gone)
    deleted_snapshot = {"username": db_user.username, "email": db_user.email, "role": db_user.role.role_name}
    db.delete(db_user)
    db.commit()
    log_audit(
        db=db, action="DELETE", table_name="users",
        record_id=user_id, user=current_user,
        old_values=deleted_snapshot,
        module="User Management",
    )
    return {"status": "success", "message": f"User {user_id} deleted"}

# ==========================================
# 3. JOB ORDERS (Complex 3NF Normalization)
# ==========================================

@app.get("/api/orders", response_model=List[OrderSchema])
def read_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieves all orders with full 3NF hydration (Auth Required)."""
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
def create_order(order_data: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    
    # [IDEMPOTENCY FIX] Check if order number already exists to prevent duplicate sync errors
    order_num = order_data.get("orderNumber")
    if order_num:
        existing_order = db.query(Order).filter(Order.order_number == order_num).first()
        if existing_order:
            print(f"[TRANS] NOTICE: Order {order_num} already exists. Returning existing record to satisfy sync queue.")
            return existing_order

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
            expected_dt = parse_local_date(expected_iso)
        else:
            # AUTO-ML: Generate prediction based on services, material, and workload
            expected_dt = predictor.predict_completion(db, order_data)

        t_date = order_data.get("transactionDate") or order_data.get("createdAt")
        created_dt = parse_local_date(t_date) if t_date else datetime.now()

        db_order = Order(
            order_number=order_data.get("orderNumber") or str(uuid.uuid4())[:8].upper(),
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority_id=db_prio.priority_id,
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=expected_dt,
            created_at=created_dt,
            updated_at=created_dt,
            user_id=current_user.user_id  # Use authenticated user's ID
        )
        db.add(db_order)
        db.flush()

        # Payment Normalization
        # DB stores lowercase: 'cash', 'gcash', 'maya', 'bank-transfer'
        m_name = str(order_data.get("paymentMethod", "cash")).lower()
        if m_name not in ["cash", "gcash", "maya", "bank-transfer"]: m_name = "cash"
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
        
        # Fallback for old format
        if not items_list and (order_data.get("brand") or order_data.get("shoeMaterial")):
            items_list = [{
                "brand": order_data.get("brand"),
                "shoeModel": order_data.get("shoeModel"),
                "shoeMaterial": order_data.get("shoeMaterial"),
                "quantity": order_data.get("quantity", 1),
                "condition": order_data.get("condition", {}),
                "baseService": order_data.get("baseService", []),
                "addOns": order_data.get("addOns", []),
                "inventoryUsed": order_data.get("inventoryUsed", [])
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

            # --- AUTOMATIC INVENTORY DEDUCTION ---
            # item_data['inventoryUsed'] is an array of { itemId: number, amount: number }
            inventory_usage = item_data.get("inventoryUsed") or order_data.get("inventoryUsed") or []
            if isinstance(inventory_usage, list):
                for usage in inventory_usage:
                    inv_id = usage.get("itemId") or usage.get("id")
                    inv_amount = float(usage.get("amount") or 0)
                    
                    if inv_id and inv_amount > 0:
                        inv_item = db.query(Inventory).filter(Inventory.item_id == inv_id).first()
                        if inv_item:
                            print(f"[INVENTORY] Deducting {inv_amount} {inv_item.unit} of '{inv_item.item_name}' for Order {db_order.order_number}")
                            inv_item.stock_quantity = max(0.0, inv_item.stock_quantity - inv_amount)
                            recalculate_inventory_status(inv_item)
                            
                            # Log the stock movement
                            inv_log = InventoryLog(
                                item_id=inv_id,
                                change_amount=-inv_amount,
                                action_type='deduction',
                                order_id=db_order.order_id,
                                user_id=current_user.user_id
                            )
                            db.add(inv_log)
            
            # Save usage to item JSON for 3NF reporting
            db_item.inventory_used = inventory_usage

            # Associate Conditions (3NF Bridge)
            cond_data = item_data.get("condition", {})
            if isinstance(cond_data, dict):
                c_map = {
                    "scratches": "scratches", 
                    "yellowing": "yellowing", 
                    "ripsHoles": "ripsholes", 
                    "deepStains": "deepstains", 
                    "soleSeparation": "soleseparation", 
                    "wornOut": "wornout"
                }
                for key, val in c_map.items():
                    if cond_data.get(key):
                        val_lower = val.replace(' ', '').replace('/', '').lower()
                        c_obj = db.query(Condition).filter(func.replace(func.replace(func.lower(Condition.condition_name), ' ', ''), '/', '') == val_lower).first()
                        if c_obj: 
                            db_item.conditions.append(c_obj)
            
            db.flush()

            # Associate Services
            services_applied = []
            base_s = item_data.get("baseService", [])
            if isinstance(base_s, list): services_applied.extend(base_s)
            
            ads = item_data.get("addOns", [])
            for ad in ads: 
                if isinstance(ad, dict): services_applied.append(ad.get("name"))
                else: services_applied.append(ad)

            for s_name in list(set(services_applied)):
                service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                if service_obj:
                    pricing = ItemServiceMapping(item_id=db_item.item_id, service_id=service_obj.service_id, actual_price=service_obj.base_price)
                    db.add(pricing)

        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Job Order {db_order.order_number} verified with {len(db_order.items)} items.")
        log_audit(
            db=db, action="CREATE", table_name="orders",
            record_id=db_order.order_id, user=current_user,
            new_values={
                "order_number": db_order.order_number,
                "customer": order_data.get("customerName"),
                "grand_total": float(db_order.grand_total),
                "items_count": len(db_order.items),
            },
            module="Job Orders",
        )
        return db_order
        
    except Exception as e:
        print(f"[TRANS ERROR] {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/orders/{order_id}", response_model=OrderSchema)
def update_order(order_id: int, updates: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
        # Case-insensitive lookup and Slug normalization
        status_name = str(updates["status"]).lower().strip()
        status_map = {
            "new-order": "new-order",
            "on-going": "on-going",
            "for-release": "for-release",
            "claimed": "claimed",
            "pending": "new-order",
            "in progress": "on-going",
            "completed": "for-release"
        }
        mapped_status = status_map.get(status_name, "new-order")
        # Direct DB lookup for the status object
        db_status = db.query(Status).filter(func.lower(Status.status_name) == mapped_status.lower()).first()
        if db_status:
            db_order.status_id = db_status.status_id
            
            # Log the change for ML time-tracking
            log = StatusLog(order_id=order_id, status_id=db_status.status_id, user_id=current_user.user_id) 
            db.add(log)
            print(f"[EDIT] Status changed for Order {db_order.order_number}: {mapped_status}")
            
            # Automated stock consumption trigger
            try:
                # Map target trigger keywords
                target_trigger = None
                if mapped_status == "on-going":
                    target_trigger = "on-going"
                elif mapped_status in ["for-release", "claimed"]:
                    target_trigger = "for-release"
                
                if target_trigger:
                    # Query active auto-deduct items matching this trigger (supporting new and legacy names)
                    trigger_names = [target_trigger]
                    if target_trigger == "on-going":
                        trigger_names.append("Job Started")
                    elif target_trigger == "for-release":
                        trigger_names.append("Shoe Released")
                        
                    auto_items = db.query(Inventory).filter(
                        Inventory.is_active == True,
                        Inventory.auto_deduct == True,
                        Inventory.auto_deduct_trigger.in_(trigger_names)
                    ).all()
                    
                    for item in auto_items:
                        # Check if already deducted for this order to prevent duplicate deductions
                        existing_log = db.query(InventoryLog).filter(
                            InventoryLog.item_id == item.item_id,
                            InventoryLog.order_id == order_id,
                            InventoryLog.action_type == "deduction"
                        ).first()
                        
                        if existing_log:
                            print(f"[AUTO-CONSUME] Skipping item '{item.item_name}' for Order {db_order.order_number}: already deducted.")
                            continue
                        
                        # Match trigger service (robust substring matching to handle multiple services)
                        is_match = False
                        if not item.trigger_service or item.trigger_service.lower() in ["all", "all services", ""]:
                            is_match = True
                        else:
                            # Retrieve selected services names for this order
                            svc_names = []
                            for ord_item in db_order.items:
                                for svc in ord_item.services:
                                    svc_names.append(svc.service_name.lower())
                            
                            # Split multiple trigger services by comma
                            trigger_services = [s.strip().lower() for s in item.trigger_service.split(",") if s.strip()]
                            for t_svc in trigger_services:
                                for s_name in svc_names:
                                    if t_svc in s_name or s_name in t_svc:
                                        is_match = True
                                        break
                                if is_match:
                                    break
                                    
                        if is_match:
                            # Calculate consumption in stock units
                            qty_consumed = float(item.consumption_qty) if item.consumption_qty else 0.0
                            deduct_amount = qty_consumed
                            
                            if deduct_amount > 0.0:
                                # Decrement stock quantity without going below zero
                                item.stock_quantity = max(0.0, item.stock_quantity - deduct_amount)
                                
                                recalculate_inventory_status(item)
                                
                                # Add to order's inventory_used list for frontend tracking
                                current_used = db_order.inventory_used or []
                                updated_used = list(current_used)
                                
                                # Check if already in the list to avoid duplicate records
                                found = False
                                for i_used in updated_used:
                                    if i_used.get("itemId") == item.item_id:
                                        i_used["quantity"] = float(i_used.get("quantity", 0.0)) + deduct_amount
                                        found = True
                                        break
                                
                                if not found:
                                    # Use package unit if package_size is set, otherwise default unit
                                    unit_name = item.package_unit if (item.package_size and item.package_size > 0.0) else item.unit
                                    updated_used.append({
                                        "itemId": item.item_id,
                                        "name": item.item_name,
                                        "quantity": deduct_amount,
                                        "unit": unit_name or "units"
                                    })
                                    
                                db_order.inventory_used = updated_used
                                db_order.inventory_applied = True
                                
                                # Log movement
                                consume_log = InventoryLog(
                                    item_id=item.item_id,
                                    change_amount=-deduct_amount,
                                    action_type="deduction",
                                    order_id=order_id,
                                    user_id=current_user.user_id
                                )
                                db.add(consume_log)
                                print(f"[AUTO-CONSUME] Deducted {deduct_amount} units of '{item.item_name}' for Order {db_order.order_number}")
            except Exception as auto_err:
                print(f"[AUTO-CONSUME ERROR] Failed to run consumption: {auto_err}")
        else:
            print(f"[EDIT] Error: Mapped status '{mapped_status}' not found in Status table.")

        if mapped_status == "claimed":
            db_order.claimed_at = datetime.now()
        else:
            db_order.claimed_at = None

        if mapped_status == "for-release":
            db_order.released_at = datetime.now()
        else:
            db_order.released_at = None

    # 2. Handle Priority Level (ML Input)
    if "priorityLevel" in updates:
        p_val = str(updates["priorityLevel"]).lower().strip()
        db_prio = db.query(PriorityLevel).filter(PriorityLevel.priority_name == p_val).first()
        if db_prio: 
            db_order.priority_id = db_prio.priority_id

    # 2.5 Handle Grand Total
    if "grandTotal" in updates:
        db_order.grand_total = updates["grandTotal"]

    # 3. Handle Customer Information (Relational Update)
    if ("customerName" in updates or "contactNumber" in updates) and db_order.customer:
        if "customerName" in updates: db_order.customer.customer_name = updates["customerName"]
        if "contactNumber" in updates: db_order.customer.contact_number = updates["contactNumber"]

    # 4. Handle Payment & Shipping
    if db_order.payments:
        db_pay = db_order.payments[0]
        if "paymentMethod" in updates:
            # DB stores lowercase: 'cash', 'gcash', 'maya', 'bank-transfer'
            m_name = str(updates["paymentMethod"]).lower().strip()
            if m_name not in ["cash", "gcash", "maya", "bank-transfer"]: m_name = "cash"
            db_m = db.query(PaymentMethod).filter(PaymentMethod.method_name == m_name).first()
            if db_m: 
                db_pay.method_id = db_m.method_id
        if "paymentStatus" in updates:
            # DB stores: 'fully-paid', 'downpayment', 'pending'
            ps_raw = str(updates["paymentStatus"]).lower().strip()
            ps_name = ps_raw if ps_raw in ["fully-paid", "downpayment", "pending"] else "fully-paid"
            db_ps = db.query(PaymentStatus).filter(PaymentStatus.status_name == ps_name).first()
            if db_ps: 
                db_pay.status_id = db_ps.p_status_id
        if "amountReceived" in updates: 
            db_pay.amount_received = updates["amountReceived"]
        if "balance" in updates: 
            db_pay.balance = updates["balance"]
        if "referenceNo" in updates: 
            db_pay.reference_no = updates["referenceNo"]
        if "depositAmount" in updates: 
            db_pay.deposit_amount = updates["depositAmount"]

    if db_order.delivery:
        if "shippingPreference" in updates:
            sp_raw = str(updates["shippingPreference"]).lower().strip()
            sp_name = sp_raw if sp_raw in ["pickup", "delivery"] else "pickup"
            db_pref = db.query(ShippingPreference).filter(ShippingPreference.pref_name == sp_name).first()
            if db_pref: 
                db_order.delivery.pref_id = db_pref.pref_id
        
        # Explicit mapping for Delivery fields to handle camelCase -> snake_case
        delivery_fields = {
            "deliveryAddress": "delivery_address",
            "deliveryCourier": "delivery_courier",
            "releaseTime": "release_time",
            "province": "province",
            "city": "city",
            "barangay": "barangay",
            "zipCode": "zip_code"
        }
        for frontend_field, db_col in delivery_fields.items():
            if frontend_field in updates:
                setattr(db_order.delivery, db_col, updates[frontend_field])

    # 5. Handle Item-level Inventory Updates (Dynamic Stock Reconciliation)
    if "items" in updates:
        for item_update in updates["items"]:
            # Safe ID conversion to prevent server crash during offline sync
            u_id_raw = item_update.get("id")
            if u_id_raw and str(u_id_raw).isdigit() and "inventoryUsed" in item_update:
                item_id = int(u_id_raw)
                new_usage = item_update["inventoryUsed"]
                
                db_item = db.query(Item).filter(Item.item_id == item_id).first()
                if db_item:
                    old_usage = db_item.inventory_used or []
                    
                    # Reconciliation: Add back old, subtract new
                    if isinstance(old_usage, list):
                        for u in old_usage:
                            i_id = u.get("itemId") or u.get("id")
                            i_amt = float(u.get("amount") or 0)
                            if i_id:
                                inv_item = db.query(Inventory).filter(Inventory.item_id == i_id).first()
                                if inv_item:
                                    inv_item.stock_quantity += i_amt
                                    recalculate_inventory_status(inv_item)
                    
                    if isinstance(new_usage, list):
                        for u in new_usage:
                            i_id = u.get("itemId") or u.get("id")
                            i_amt = float(u.get("amount") or 0)
                            if i_id and i_amt > 0:
                                inv_item = db.query(Inventory).filter(Inventory.item_id == i_id).first()
                                if inv_item:
                                    inv_item.stock_quantity = max(0.0, inv_item.stock_quantity - i_amt)
                                    recalculate_inventory_status(inv_item)
                                    db.add(InventoryLog(item_id=i_id, change_amount=-i_amt, action_type='manual_edit', order_id=db_order.order_id, user_id=current_user.user_id))
                    
                    db_item.inventory_used = new_usage

    # 5. Handle Inventory Persistence & Dynamic Stock Adjustment
    if "inventoryUsed" in updates: 
        new_usage = updates["inventoryUsed"]
        old_usage = db_order.inventory_used or []
        
        # S.O.L.I.D: Encapsulated Delta Deduction Logic
        # 1. Reverse old deductions (Restock)
        if isinstance(old_usage, list):
            for usage in old_usage:
                inv_id = usage.get("itemId") or usage.get("id")
                inv_amount = float(usage.get("amount") or 0)
                if inv_id and inv_amount > 0:
                    inv_item = db.query(Inventory).filter(Inventory.item_id == inv_id).first()
                    if inv_item:
                        inv_item.stock_quantity += inv_amount # Restock previous usage
                        recalculate_inventory_status(inv_item)
        
        # 2. Apply new usage (Deduct)
        if isinstance(new_usage, list):
            for usage in new_usage:
                inv_id = usage.get("itemId") or usage.get("id")
                inv_amount = float(usage.get("amount") or 0)
                if inv_id and inv_amount > 0:
                    inv_item = db.query(Inventory).filter(Inventory.item_id == inv_id).first()
                    if inv_item:
                        inv_item.stock_quantity = max(0.0, inv_item.stock_quantity - inv_amount) # Deduct new usage
                        recalculate_inventory_status(inv_item)
                        
                        # Log the adjustment
                        db.add(InventoryLog(
                            item_id=inv_id,
                            change_amount=-inv_amount,
                            action_type='order_update',
                            order_id=db_order.order_id,
                            user_id=current_user.user_id
                        ))

        db_order.inventory_used = new_usage
    
    if "inventoryApplied" in updates: 
        db_order.inventory_applied = updates["inventoryApplied"]

    # 5. Handle Date Updates (Order Date & Predicted Completion)
    if "transactionDate" in updates:
        td_iso = updates["transactionDate"]
        if td_iso:
            db_order.created_at = parse_local_date(td_iso)

    if "predictedCompletionDate" in updates:
        expected_iso = updates["predictedCompletionDate"]
        if expected_iso:
            db_order.expected_at = parse_local_date(expected_iso)
        else:
            db_order.expected_at = predictor.predict_completion(db, updates)
    elif "status" in updates or "priorityLevel" in updates:
        # Re-run prediction if status/priority changed but date wasn't manually set
        db_order.expected_at = predictor.predict_completion(db, updates)

    # 6. Cascading Updates: Items, Conditions, and Services
    items_updates = updates.get("items", [])
    if not items_updates and ("brand" in updates or "shoeMaterial" in updates or "shoeModel" in updates or "condition" in updates):
        # Fallback for single-item updates from flat structures
        items_updates = [{
            "brand": updates.get("brand", db_order.items[0].brand if db_order.items else "Unknown"),
            "shoeModel": updates.get("shoeModel", db_order.items[0].shoe_model if db_order.items else "Unknown"),
            "shoeMaterial": updates.get("shoeMaterial", db_order.items[0].material if db_order.items else "Unknown"),
            "quantity": updates.get("quantity", db_order.items[0].quantity if db_order.items else 1),
            "condition": updates.get("condition"),
            "baseService": updates.get("baseService"),
            "addOns": updates.get("addOns")
        }]

    if items_updates and db_order.items:
        # Multi-Item Sync with matching by order-item_id
        for item_data in items_updates:
            # Match by order item ID if provided, otherwise fallback to item 0
            u_id_raw = item_data.get("id")
            db_item = None
            if u_id_raw and str(u_id_raw).isdigit():
                item_id = int(u_id_raw)
                db_item = next((i for i in db_order.items if i.item_id == item_id), None)
            
            if not db_item and db_order.items:
                db_item = db_order.items[0]
                
            if not db_item: continue

            if "brand" in item_data: db_item.brand = item_data["brand"]
            if "shoeModel" in item_data: db_item.shoe_model = item_data["shoeModel"]
            if "shoeMaterial" in item_data: db_item.material = item_data["shoeMaterial"]
            if "quantity" in item_data: db_item.quantity = item_data["quantity"]
            if "condition" in item_data and isinstance(item_data["condition"], dict) and "others" in item_data["condition"]:
                db_item.item_notes = item_data["condition"]["others"]

            # Sync Conditions (3NF Bridge) with normalized matching (strips spaces & slashes)
            if "condition" in item_data and isinstance(item_data["condition"], dict):
                db_item.conditions = [] 
                c_data = item_data["condition"]
                c_map = {"scratches":"scratches", "yellowing":"yellowing", "ripsHoles":"ripsholes", "deepStains":"deepstains", "soleSeparation":"soleseparation", "wornOut":"wornout"}
                for key, val in c_map.items():
                    if c_data.get(key):
                        val_lower = val.replace(' ', '').replace('/', '').lower()
                        c_obj = db.query(Condition).filter(func.replace(func.replace(func.lower(Condition.condition_name), ' ', ''), '/', '') == val_lower).first()
                        if c_obj: db_item.conditions.append(c_obj)

            # Sync Services (Pricing Snapshots)
            if ("baseService" in item_data or "addOns" in item_data):
                db.query(ItemServiceMapping).filter(ItemServiceMapping.item_id == db_item.item_id).delete()
                services_applied = []
                if "baseService" in item_data and isinstance(item_data["baseService"], list): services_applied.extend(item_data["baseService"])
                if "addOns" in item_data and isinstance(item_data["addOns"], list):
                    for ad in item_data["addOns"]:
                        services_applied.append(ad.get("name") if isinstance(ad, dict) else ad)
                
                for s_name in set(services_applied):
                    service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                    if service_obj:
                        db.add(ItemServiceMapping(item_id=db_item.item_id, service_id=service_obj.service_id, actual_price=service_obj.base_price))

    try:
        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Order {db_order.order_number} state synchronized.")
        log_audit(
            db=db, action="UPDATE", table_name="orders",
            record_id=order_id, user=current_user,
            old_values={"order_number": db_order.order_number},
            new_values={k: v for k, v in updates.items() if k not in ("items", "inventoryUsed") and not isinstance(v, (list, dict))},
            module="Job Orders",
        )
        return db_order
    except Exception as e:
        db.rollback()
        print(f"[TRANS ERROR] Failed to sync order update: {e}")
        raise HTTPException(status_code=500, detail="Database Sync Error")

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Permanent removal of order (Use with caution - Owner only)."""
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    deleted_snapshot = {"order_number": db_order.order_number, "grand_total": float(db_order.grand_total)}
    
    # Explicit cascade handling for existing database schemas without ON DELETE CASCADE
    db.query(StatusLog).filter(StatusLog.order_id == order_id).delete(synchronize_session=False)
    db.query(InventoryLog).filter(InventoryLog.order_id == order_id).update({"order_id": None}, synchronize_session=False)
    
    db.delete(db_order)
    db.commit()
    log_audit(
        db=db, action="DELETE", table_name="orders",
        record_id=order_id, user=current_user,
        old_values=deleted_snapshot,
        module="Job Orders",
    )
    return {"status": "success", "message": f"Order {order_id} deleted"}


# ==========================================
# 4. LOOKUPS & UTILITIES (Read-Only Endpoints)
# ==========================================

@app.get("/api/services", response_model=List[ServiceSchema])
def get_catalog(db: Session = Depends(get_db)):
    """Returns the available service catalog with real-time pricing, ordered by user preference."""
    return db.query(Service).filter(Service.is_active == True).order_by(Service.sort_order.asc()).all()

@app.post("/api/services", response_model=ServiceSchema)
def create_service(service_data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Adds a new service to the catalog with category resolution (Owner only)."""
    print(f"[CATALOG] Creating new service: {service_data.get('service_name')}")
    
    # Resolve category string to ID
    cat_name = service_data.get('category', 'base')
    db_cat = db.query(ServiceCategory).filter(ServiceCategory.category_name == cat_name).first()
    category_id = db_cat.category_id if db_cat else 1

    # Auto-assign sort_order to the end if not provided
    sort_order = service_data.get('sort_order')
    if sort_order is None:
        max_order = db.query(func.max(Service.sort_order)).scalar() or 0
        sort_order = max_order + 1

    db_service = Service(
        service_name=service_data.get('service_name'),
        base_price=service_data.get('base_price'),
        category_id=category_id,
        description=service_data.get('description'),
        duration_days=service_data.get('duration_days', 0),
        service_code=service_data.get('service_code'),
        is_active=service_data.get('is_active', True),
        sort_order=sort_order
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    log_audit(
        db=db, action="CREATE", table_name="services",
        record_id=db_service.service_id, user=current_user,
        new_values={"service_name": db_service.service_name, "base_price": float(db_service.base_price), "category": cat_name},
        module="Services",
    )
    return db_service

@app.put("/api/services/reorder")
def reorder_services_bulk(reorder_data: List[dict], db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """
    BULK REORDER: Updates sort_order for multiple services in one transaction (Owner only).
    Payload: [{"id": 1, "sort_order": 1}, {"id": 2, "sort_order": 2}]
    """
    print(f"[CATALOG] Bulk reordering {len(reorder_data)} services...")
    try:
        for item in reorder_data:
            svc_id = item.get("id")
            new_order = item.get("sort_order")
            db.query(Service).filter(Service.service_id == svc_id).update({"sort_order": new_order})
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Bulk reorder failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save new order")

@app.put("/api/services/{service_id}", response_model=ServiceSchema)
def update_service(service_id: int, service_update: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Updates an existing service with category string-to-ID resolution (Owner only)."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Capture before-state
    old_svc_snapshot = {"service_name": db_service.service_name, "base_price": float(db_service.base_price), "is_active": db_service.is_active}

    # Handle category update via string resolution if provided
    if "category" in service_update:
        cat_name = service_update.pop("category")
        db_cat = db.query(ServiceCategory).filter(ServiceCategory.category_name == cat_name).first()
        if db_cat:
            db_service.category_id = db_cat.category_id
    
    # Map other fields
    for key, value in service_update.items():
        if hasattr(db_service, key) and key != "service_id":
            setattr(db_service, key, value)
            
    db.commit()
    db.refresh(db_service)
    log_audit(
        db=db, action="UPDATE", table_name="services",
        record_id=service_id, user=current_user,
        old_values=old_svc_snapshot,
        new_values={"service_name": db_service.service_name, "base_price": float(db_service.base_price), "is_active": db_service.is_active},
        module="Services",
    )
    return db_service

@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Removes a service from the catalog (Owner only)."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check if this service is referenced in any order item mappings
    referenced = db.query(ItemServiceMapping).filter(ItemServiceMapping.service_id == service_id).first()
    svc_name = db_service.service_name
    
    if referenced:
        # Soft delete to maintain 3NF Integrity with past orders
        db_service.is_active = False
        db.commit()
        log_audit(
            db=db, action="DEACTIVATE", table_name="services",
            record_id=service_id, user=current_user,
            old_values={"service_name": svc_name, "was_active": True},
            new_values={"is_active": False, "reason": "linked_to_past_orders"},
            module="Services",
        )
        return {"status": "success", "message": "Service deactivated (Soft Delete) because it is linked to past orders"}
    else:
        # Permanent hard delete (clean up duplicates or unused services)
        db.delete(db_service)
        db.commit()
        log_audit(
            db=db, action="DELETE", table_name="services",
            record_id=service_id, user=current_user,
            old_values={"service_name": svc_name},
            module="Services",
        )
        return {"status": "success", "message": "Service deleted permanently"}


@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def get_statuses(db: Session = Depends(get_db)):
    """Returns all order lifecycle statuses for UI drop-downs."""
    return db.query(Status).all()


@app.get("/api/expenses", response_model=List[ExpenseSchema])
def get_expenses(db: Session = Depends(get_db)):
    """Tracks business overhead costs + dynamically includes inventory restock costs as expenses."""
    from decimal import Decimal
    # 1. Fetch standard overhead expenses
    standard_expenses = db.query(Expense).all()
    
    # 2. Fetch inventory restock logs (exclude order-specific adjustments)
    restock_logs = db.query(InventoryLog).filter(InventoryLog.action_type == 'restock', InventoryLog.order_id == None).all()
    
    # 3. Format restock logs as virtual ExpenseSchema objects
    virtual_expenses = []
    for log in restock_logs:
        item = log.inventory_item
        if not item:
            continue
            
        unit_price = item.unit_price if item.unit_price is not None else Decimal('0.0')
        divisor = 1.0
        has_pkg = False
        if item.package_size and item.package_size > 0:
            divisor = float(item.package_size)
            has_pkg = True
        else:
            unit_lower = (item.unit or "").lower()
            if unit_lower in ['ml', 'g', 'grams']:
                divisor = 1000.0
                has_pkg = True
                
        qty_packages = log.change_amount / divisor
        cost = Decimal(str(qty_packages)) * unit_price
        
        qty_str = f"{int(qty_packages)}" if qty_packages.is_integer() else f"{qty_packages:.2f}"
        if has_pkg:
            pkg_unit = item.package_unit or "packages"
            description = f"INVENTORY || Restock: {item.item_name} (+{qty_str} {pkg_unit})"
        else:
            description = f"INVENTORY || Restock: {item.item_name} (+{qty_str} {item.unit or ''})"
        
        virtual_expenses.append({
            "expense_id": 1000000 + log.log_id,
            "amount": cost,
            "description": description,
            "expense_date": log.created_at,
            "user_id": log.user_id,
            "created_at": log.created_at
        })
        
    return list(standard_expenses) + virtual_expenses

@app.post("/api/expenses", response_model=ExpenseSchema)
def create_expense(expense_data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Logs a new business expense (Auth Required)."""
    # Logic: If date is missing, use now. Use first admin user as fallback for user_id.
    user_id = expense_data.get('user_id', current_user.user_id)
    
    # Map frontend 'date' if provided
    exp_date = expense_data.get('date')
    if exp_date:
        exp_date = parse_local_date(exp_date)
    else:
        exp_date = datetime.now()
        
    # Standardize description format: "Category || Notes"
    cat = expense_data.get('category', 'Misc Expense')
    notes = expense_data.get('notes', '')
    description = f"{cat} || {notes}" if notes else cat
    
    new_expense = Expense(
        amount=expense_data['amount'],
        description=description,
        expense_date=exp_date,
        user_id=user_id
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    log_audit(
        db=db, action="CREATE", table_name="expenses",
        record_id=new_expense.expense_id, user=current_user,
        new_values={"amount": float(new_expense.amount), "description": new_expense.description},
        module="Expenses",
    )
    return new_expense

@app.put("/api/expenses/{expense_id}", response_model=ExpenseSchema)
def update_expense(expense_id: int, expense_data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Updates an existing expense (Auth Required)."""
    if expense_id >= 1000000:
        log_id = expense_id - 1000000
        log = db.query(InventoryLog).filter(InventoryLog.log_id == log_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Expense (Restock Log) not found")
        item = log.inventory_item
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item for restock log not found")
            
        from decimal import Decimal
        unit_price = item.unit_price if item.unit_price is not None else Decimal('0.0')
        
        # If amount is changed, we adjust the change_amount and the inventory stock level
        if 'amount' in expense_data:
            new_amount = Decimal(str(expense_data['amount']))
            if unit_price > 0:
                qty_packages = float(new_amount / unit_price)
                old_change = log.change_amount
                
                divisor = 1.0
                if item.package_size and item.package_size > 0:
                    divisor = float(item.package_size)
                else:
                    unit_lower = (item.unit or "").lower()
                    if unit_lower in ['ml', 'g', 'grams']:
                        divisor = 1000.0
                        
                new_change = qty_packages * divisor
                log.change_amount = new_change
                # Adjust stock quantity by the difference
                item.stock_quantity += (new_change - old_change)
                recalculate_inventory_status(item)
                
        if 'date' in expense_data:
            exp_date = expense_data['date']
            if exp_date:
                log.created_at = parse_local_date(exp_date)
                
        db.commit()
        db.refresh(log)
        
        # Calculate virtual values for response
        divisor = 1.0
        has_pkg = False
        if item.package_size and item.package_size > 0:
            divisor = float(item.package_size)
            has_pkg = True
        else:
            unit_lower = (item.unit or "").lower()
            if unit_lower in ['ml', 'g', 'grams']:
                divisor = 1000.0
                has_pkg = True
                
        qty_packages = log.change_amount / divisor
        cost = Decimal(str(qty_packages)) * unit_price
        
        qty_str = f"{int(qty_packages)}" if qty_packages.is_integer() else f"{qty_packages:.2f}"
        if has_pkg:
            pkg_unit = item.package_unit or "packages"
            description = f"INVENTORY || Restock: {item.item_name} (+{qty_str} {pkg_unit})"
        else:
            description = f"INVENTORY || Restock: {item.item_name} (+{qty_str} {item.unit or ''})"
            
        return {
            "expense_id": expense_id,
            "amount": cost,
            "description": description,
            "expense_date": log.created_at,
            "user_id": log.user_id,
            "created_at": log.created_at
        }

    db_exp = db.query(Expense).filter(Expense.expense_id == expense_id).first()
    if not db_exp:
        raise HTTPException(status_code=404, detail="Expense not found")

    old_exp_snapshot = {"amount": float(db_exp.amount), "description": db_exp.description}
    
    if 'amount' in expense_data:
        db_exp.amount = expense_data['amount']
        
    cat = expense_data.get('category')
    notes = expense_data.get('notes')
    if cat is None or notes is None:
        parts = (db_exp.description or '').split(' || ')
        curr_cat = parts[0] if len(parts) > 0 else 'Misc Expense'
        curr_notes = parts[1] if len(parts) > 1 else ''
        cat = cat if cat is not None else curr_cat
        notes = notes if notes is not None else curr_notes

    db_exp.description = f"{cat} || {notes}" if notes else cat
    
    if 'date' in expense_data:
        exp_date = expense_data['date']
        if exp_date:
            db_exp.expense_date = parse_local_date(exp_date)
                
    db.commit()
    db.refresh(db_exp)
    log_audit(
        db=db, action="UPDATE", table_name="expenses",
        record_id=expense_id, user=current_user,
        old_values=old_exp_snapshot,
        new_values={"amount": float(db_exp.amount), "description": db_exp.description},
        module="Expenses",
    )
    return db_exp

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Permanently deletes an expense record (Owner only)."""
    if expense_id >= 1000000:
        log_id = expense_id - 1000000
        log = db.query(InventoryLog).filter(InventoryLog.log_id == log_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Expense (Restock Log) not found")
        item = log.inventory_item
        if item:
            # Reverse the restock quantity from stock_quantity without going below zero
            item.stock_quantity = max(0.0, item.stock_quantity - log.change_amount)
            recalculate_inventory_status(item)
        db.delete(log)
        db.commit()
        log_audit(
            db=db, action="DELETE", table_name="expenses",
            record_id=expense_id, user=current_user,
            old_values={"type": "inventory_restock", "item": item.item_name if item else "unknown"},
            module="Expenses",
        )
        return {"status": "success", "message": "Restock log deleted."}

    db_exp = db.query(Expense).filter(Expense.expense_id == expense_id).first()
    if not db_exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    exp_snapshot = {"amount": float(db_exp.amount), "description": db_exp.description}
    db.delete(db_exp)
    db.commit()
    log_audit(
        db=db, action="DELETE", table_name="expenses",
        record_id=expense_id, user=current_user,
        old_values=exp_snapshot,
        module="Expenses",
    )
    return {"status": "success", "message": "Expense deleted."}

@app.get("/api/activities")
def get_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("owner")),  # SECURITY FIX: Owner-only (OWASP A01)
    limit: int = 100,
    offset: int = 0,
    module: Optional[str] = None,
    action: Optional[str] = None,
    username: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    OWNER-ONLY: Retrieves paginated, filterable audit logs for the Activity History UI.

    Security: Requires owner role. Staff users receive HTTP 403.
    Performance: Uses denormalized username/module columns (no N+1 joins).
    Pagination: Accepts ?limit=&offset= for large datasets.
    Filtering: Supports ?module=, ?action=, ?username=, ?start_date=, ?end_date=
    """
    READABLE_TABLE_MAP = {
        "orders":           "Job Orders",
        "items":            "Job Orders",
        "users":            "User Management",
        "inventory":        "Inventory",
        "inventory_logs":   "Inventory",
        "services":         "Services",
        "expenses":         "Expenses",
        "auth":             "Authentication",
        "audit_logs":       "System",
        "backend_v2":       "System",
        "ml_engine":        "Machine Learning",
        "payments":         "Sales",
        "deliveries":       "Job Orders",
        "customers":        "Job Orders",
    }

    def resolve_details(log) -> str:
        """Build a human-readable detail string without raw JSON."""
        if log.action_type in ("404_NOT_FOUND",) and log.old_values:
            broken_url = log.old_values.get("broken_url", "unknown")
            client = log.new_values.get("client", "unknown") if log.new_values else "unknown"
            return f"Page Not Found: {broken_url} (from {client})"
        if log.action_type == "SERVER_ERROR" and (log.new_values or log.old_values):
            f_name = (log.new_values or {}).get("file", "unknown")
            line   = (log.new_values or {}).get("line", 0)
            error  = (log.old_values or {}).get("error", "Unknown error")
            return f"CRITICAL: {error} | File: {f_name} | Line: {line}"
        if log.action_type in ("LOGIN", "LOGIN_SUCCESS"):
            actor = log.username or "unknown user"
            return f"{actor} logged into the system"
        if log.action_type in ("LOGIN_FAILED",):
            actor = log.username or "unknown user"
            return f"Failed login attempt for '{actor}'"
        if log.action_type == "LOGOUT":
            actor = log.username or "unknown user"
            return f"{actor} logged out"
        if log.action_type == "PASSWORD_RESET":
            actor = log.username or "unknown user"
            return f"{actor} reset their password"
        if log.action_type == "ML_TRAIN":
            return "Machine Learning model retrained on latest historical data"

        # Generic meaningful detail
        readable_table = READABLE_TABLE_MAP.get(log.table_name or "", log.table_name or "Record")
        if log.action_type == "CREATE":
            return f"New {readable_table} record created (ID: {log.record_id})"
        if log.action_type == "UPDATE":
            changed_keys = list((log.new_values or {}).keys()) or ["fields"]
            return f"{readable_table} record #{log.record_id} updated — changed: {', '.join(changed_keys[:5])}"
        if log.action_type == "DELETE":
            return f"{readable_table} record #{log.record_id} permanently deleted"
        return f"{log.action_type} on {readable_table}"

    # Build base query
    q = db.query(AuditLog)

    # Apply server-side filters
    if module and module.lower() not in ("all", "all types", ""):
        q = q.filter(AuditLog.module == module)
    if action and action.lower() not in ("all", ""):
        # Match against action_type (stored without spaces, e.g. LOGIN_SUCCESS)
        action_clean = action.upper().replace(" ", "_")
        q = q.filter(AuditLog.action_type == action_clean)
    if username and username.lower() not in ("all", ""):
        q = q.filter(AuditLog.username == username)
    if start_date:
        try:
            q = q.filter(AuditLog.created_at >= parse_local_date(start_date))
        except Exception:
            pass
    if end_date:
        try:
            from datetime import timedelta
            end_dt = parse_local_date(end_date) + timedelta(days=1)
            q = q.filter(AuditLog.created_at < end_dt)
        except Exception:
            pass

    total_count = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for log in logs:
        readable_table = READABLE_TABLE_MAP.get(log.table_name or "", log.table_name or "System")
        resolved_module = log.module or readable_table

        # Action type classification for frontend badge coloring
        action_upper = (log.action_type or "").upper()
        if action_upper in ("SERVER_ERROR", "DELETE", "LOGIN_FAILED"):
            log_type = "critical"
        elif action_upper in ("404_NOT_FOUND", "SYSTEM"):
            log_type = "system"
        elif action_upper in ("LOGIN", "LOGIN_SUCCESS", "LOGOUT", "PASSWORD_RESET"):
            log_type = "auth"
        else:
            log_type = "order"

        results.append({
            "id":         str(log.audit_log_id),
            "timestamp":  log.created_at.strftime('%m/%d/%Y, %H:%M') if log.created_at else "",
            "user":       log.username or "System",       # Uses denormalized column (no N+1)
            "role":       log.role or "system",
            "action":     (log.action_type or "").replace("_", " "),
            "actionRaw":  log.action_type or "",          # Raw for badge mapping
            "module":     resolved_module,
            "table":      readable_table,
            "recordId":   log.record_id,
            "oldValues":  log.old_values,
            "newValues":  log.new_values,
            "details":    resolve_details(log),
            "type":       log_type,
            "ipAddress":  log.ip_address,
        })
    return {
        "total":  total_count,
        "offset": offset,
        "limit":  limit,
        "items":  results,
    }

@app.post("/api/activities")
def log_custom_activity(activity: dict, db: Session = Depends(get_db)):
    """
    Frontend event logger for UI-specific actions (PRINT, LOGOUT, etc.).
    Now correctly maps all action types — no more hardcoded 'UPDATE'/'CREATE' fallback.

    Note: No auth required intentionally — frontend logs events like LOGOUT after the token is cleared.
    The endpoint ONLY creates log entries; it cannot read, modify, or delete existing logs.
    """
    # Resolve user by username (fallback to user_id if provided)
    actor_username = activity.get("user") or activity.get("username")
    actor_user_id = activity.get("userId") or activity.get("user_id")
    u = None
    if actor_username:
        u = db.query(User).filter(User.username == actor_username).first()
    elif actor_user_id:
        try:
            u = db.query(User).filter(User.user_id == int(actor_user_id)).first()
        except Exception:
            pass

    # Map action type — pass through as-is (no more hardcoded fallback)
    action_type = (activity.get("action") or activity.get("type") or "CREATE").upper().replace(" ", "_")

    # Resolve module from payload or from table name
    table_name = activity.get("table") or activity.get("module") or "system"
    module = activity.get("module") or TABLE_TO_MODULE.get(table_name, table_name.replace('_', ' ').title())

    entry = log_audit(
        db=db,
        action=action_type,
        table_name=table_name,
        record_id=activity.get("recordId") or activity.get("record_id") or None,
        user=u,
        old_values=activity.get("oldValues") or activity.get("old_values"),
        new_values={"details": activity.get("details")} if activity.get("details") else (activity.get("newValues") or activity.get("new_values")),
        module=module,
    )
    return {"status": "logged", "id": entry.audit_log_id if entry else None}



# (Relocated UI Hosting section at EOF)
# ==========================================
# 12. INVENTORY ENDPOINTS
# ==========================================

@app.get("/api/inventory", response_model=List[InventorySchema])
def get_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all supply items."""
    repo = InventoryRepository(db)
    return repo.get_all()

@app.post("/api/inventory", response_model=InventorySchema)
def create_inventory_item(item: InventorySchema, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner"]))):
    """Admin-only: Add new material to catalog."""
    if item.stock_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock quantity cannot be negative.")
    new_item = Inventory(
        item_name=item.item_name,
        category=item.category,
        stock_quantity=item.stock_quantity,
        unit=item.unit,
        unit_price=item.unit_price,
        is_active=item.is_active,
        auto_deduct=item.auto_deduct,
        auto_deduct_trigger=item.auto_deduct_trigger,
        trigger_service=item.trigger_service,
        consumption_qty=item.consumption_qty,
        consumption_unit=item.consumption_unit,
        package_size=item.package_size,
        package_unit=item.package_unit,
        low_stock_threshold=item.low_stock_threshold
    )
    recalculate_inventory_status(new_item)
    repo = InventoryRepository(db)
    repo.add(new_item)
    
    # S.O.L.I.D & 3NF: Log initial stock as restock to record it in expenses
    if new_item.stock_quantity > 0:
        db.add(InventoryLog(
            item_id=new_item.item_id,
            change_amount=new_item.stock_quantity,
            action_type='restock',
            user_id=current_user.user_id
        ))
        repo.commit()

    log_audit(
        db=db, action="CREATE", table_name="inventory",
        record_id=new_item.item_id, user=current_user,
        new_values={"item_name": new_item.item_name, "stock_quantity": new_item.stock_quantity, "unit": new_item.unit, "unit_price": float(new_item.unit_price)},
        module="Inventory",
    )
    return new_item

@app.put("/api/inventory/{item_id}", response_model=InventorySchema)
def update_inventory_item(item_id: int, updates: InventoryUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Modify stock or metadata."""
    repo = InventoryRepository(db)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Store old stock quantity to compute the diff
    old_stock = item.stock_quantity
    
    # Store old snapshot for audit diff
    old_inv_snapshot = {"item_name": item.item_name, "stock_quantity": item.stock_quantity}

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
        
    if item.stock_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock quantity cannot be negative.")
        
    recalculate_inventory_status(item)
    
    # S.O.L.I.D & 3NF: Log stock difference if it changed
    if item.stock_quantity != old_inv_snapshot["stock_quantity"]:
        diff = item.stock_quantity - old_inv_snapshot["stock_quantity"]
        db.add(InventoryLog(
            item_id=item.item_id,
            change_amount=diff,
            action_type='restock' if diff > 0 else 'deduction',
            user_id=current_user.user_id
        ))
    
    repo.commit()
    repo.refresh(item)
    log_audit(
        db=db, action="UPDATE", table_name="inventory",
        record_id=item_id, user=current_user,
        old_values=old_inv_snapshot,
        new_values={"item_name": item.item_name, "stock_quantity": item.stock_quantity},
        module="Inventory",
    )
    return item

@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner"]))):
    """Admin-only: Soft-delete item from catalog."""
    repo = InventoryRepository(db)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Soft delete to preserve transaction logs and relational integrity (3NF)
    item_name = item.item_name
    item.is_active = False
    repo.commit()
    log_audit(
        db=db, action="DELETE", table_name="inventory",
        record_id=item_id, user=current_user,
        old_values={"item_name": item_name, "was_active": True},
        new_values={"is_active": False},
        module="Inventory",
    )
    return {"status": "success", "message": "Item deactivated"}

@app.post("/api/inventory/adjust")
def adjust_stock(
    item_id: int = Body(...), 
    amount: float = Body(...), 
    action: str = Body(...), # 'deduction', 'restock'
    order_id: Optional[int] = Body(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Record stock movement and update balance."""
    repo = InventoryRepository(db)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if amount < 0:
        raise HTTPException(status_code=400, detail="Adjustment amount cannot be negative.")
    old_stock = item.stock_quantity

    # 1. Update the inventory balance
    if action == 'deduction':
        if (item.stock_quantity - amount) < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock: quantity cannot be negative.")
        item.stock_quantity = max(0.0, item.stock_quantity - amount)
    else:
        item.stock_quantity += amount
    
    # 2. Update status using helper
    recalculate_inventory_status(item)

    # 3. Log the transaction
    log = InventoryLog(
        item_id=item_id,
        change_amount=amount if action == 'restock' else -amount,
        action_type=action,
        order_id=order_id,
        user_id=current_user.user_id
    )
    
    db.add(log)
    repo.commit()
    
    # Write manual inventory adjustment to system audit trail
    log_audit(
        db=db, action="UPDATE", table_name="inventory",
        record_id=item_id, user=current_user,
        old_values={"item_name": item.item_name, "stock_quantity": old_stock},
        new_values={"item_name": item.item_name, "stock_quantity": item.stock_quantity, "action": action, "amount": amount},
        module="Inventory",
    )
    return {"status": "success", "new_stock": item.stock_quantity}

# ------------------------------------------
# DEFENSE DEBUGGING TOOLS
# ------------------------------------------
@app.get("/api/test-crash")
def test_crash(current_user: User = Depends(require_role("owner"))):
    """Endpoint to simulate a server-side exception for debugging demos (Owner only)."""
    if ENV == "Production":
        raise HTTPException(status_code=403, detail="Debug endpoints disabled in production")
    raise ValueError("DEFENSE_SIMULATION: Critical Database Connection Interrupted!")


# ------------------------------------------
# UI HOSTING & SPA SUPPORT
# ------------------------------------------
# Resolves paths relative to main.py to find the 'dist' folder correctly.
# NOTE: Use '../dist' because main.py is inside the 'backend' folder.

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
