# Shoelotskey SMS - Main Entry

from fastapi import FastAPI, Depends, HTTPException, Body, Request, Security, Response
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, inspect, func, or_, case
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any, Union, Optional
from datetime import datetime, timedelta, date
import os
import uuid
import json
import sys
import re
import requests
import shutil
from decimal import Decimal
import time


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

# P0-3 (SECURITY/RELIABILITY FIX): auto_organize_workspace() used to run unconditionally
# on every application boot (including every Heroku dyno restart/deploy), moving,
# rewriting, and deleting source files on disk. Application startup must be a pure,
# read-only operation with respect to the repository's file layout — mutating source
# files as a side effect of importing main.py is unpredictable and unsafe on a
# production entry point. The function is intentionally left unused/uninvoked rather
# than deleted, in case a maintainer needs it for a one-off, manually-triggered local
# cleanup (it is NOT wired into any route or startup hook).
# auto_organize_workspace()  # DO NOT re-enable on app startup — see P0-3.

def _configure_import_paths():
    """
    Read-only replacement for the import-path side effect that
    auto_organize_workspace() used to bundle together with its destructive file
    moves. backend/auth_utils.py and a few backend/db/*.py scripts do a bare
    `from database import ...` (not `from db.database import ...`), which only
    resolves if backend/db is directly on sys.path. This performs ONLY that path
    registration — no files are created, moved, rewritten, or deleted.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_dir = os.path.join(base_dir, "db")
    if db_dir not in sys.path:
        sys.path.insert(0, db_dir)

_configure_import_paths()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, RedirectResponse
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
    Inventory, InventoryLog, MaterialConsumption, CashSession,
    HistoricalOrder, HistoricalItem, HistoricalItemService, HistoricalPrediction, HistoricalImage,
    ResearchTestRun, ResearchMeasurement
)
from db.repositories import InventoryRepository
from schemas import (
    OrderSchema, ServiceSchema, ExpenseSchema, UserSchema, LoginRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, RoleSchema, StatusSchema, 
    ItemSchema, PaymentSchema, DeliverySchema, UserCreateSchema, UserUpdateSchema,
    InventorySchema, InventoryUpdateSchema, InventoryLogSchema, OrderMaterialPayload,
    OpenCashRegisterRequest, CloseCashRegisterRequest
)
from db.database import (
    engine, get_db, SessionLocal, DATABASE_URL, is_sqlite, conn_error,
    LOCAL_SQLITE_PATH, LOCAL_SQLITE, persist_user_to_sqlite_file,
    checkpoint_sqlite, reconcile_sqlite_users_into_session,
)
from ml.ml_engine import predictor, live_order_payload_from_db_order
from ml.historical_ml_engine import historical_ml_engine
from ml.business_rules import color_count_conflict_message
from auth_utils import (
    get_current_user,
    require_role,
    create_access_token,
    sanitize_error,
    humanize_server_error,
    frontend_base_for_reset_link,
    local_vite_auth_redirect,
    is_eval_account,
    is_user_session_active,
    register_user_session,
    revoke_user_session,
    invalidate_user_cache,
    security,
    SECRET_KEY,
    ALGORITHM,
)

# ------------------------------------------
# SYSTEM INITIALIZATION
# ------------------------------------------
DB_TYPE = "PostgreSQL" if "postgresql" in DATABASE_URL else "SQLite"
# Heroku always injects PORT (and usually DYNO). Local uvicorn should leave PORT unset
# unless intentionally simulating production. ENV=production|prod is an explicit override.
_IS_PRODUCTION = (
    bool(os.getenv("PORT"))
    or bool(os.getenv("DYNO"))
    or str(os.getenv("ENV", "")).strip().lower() in ("production", "prod")
)
ENV = "Production" if _IS_PRODUCTION else "Localhost"

def parse_local_date(date_input: Optional[Any]) -> datetime:
    from datetime import date as dt_date, datetime as dt_datetime
    if not date_input:
        return dt_datetime.now()
    if isinstance(date_input, dt_datetime):
        return date_input.astimezone().replace(tzinfo=None) if date_input.tzinfo else date_input
    if isinstance(date_input, dt_date):
        return dt_datetime(date_input.year, date_input.month, date_input.day)

    raw_str = str(date_input).strip()
    if not raw_str:
        return dt_datetime.now()

    # 1. Try ISO format
    try:
        clean_str = raw_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is not None:
            return dt.astimezone().replace(tzinfo=None)
        return dt
    except Exception:
        pass

    # 2. Try common formats (e.g. MM/dd/yyyy, HH:mm or YYYY-MM-DD HH:mm:ss)
    formats = [
        "%m/%d/%Y, %H:%M",
        "%m/%d/%Y, %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y, %I:%M %p",
        "%m/%d/%Y %I:%M %p",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%m/%d/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw_str, fmt)
        except ValueError:
            continue

    print(f"[DATE PARSER] Warning: Failed to parse '{date_input}', returning current time.")
    return datetime.now()


def resolve_activity_datetime(
    raw_timestamp: Optional[Any] = None,
    order_number: Optional[str] = None,
    order_date: Optional[str] = None,
    order_time: Optional[str] = None,
    details: Optional[str] = None,
) -> datetime:
    """
    Chronologically pins an activity/order log to its true historical or specified intake date & time.
    Resolution priority:
    1. Explicit order_date + order_time
    2. Order number pattern (ORD-YYYY-MM-DD-XXX or JO-YYYY-MM-DD-XXX) + order_time
    3. raw_timestamp string (ISO or local formatted)
    4. Order number regex from details string
    5. Fallback to datetime.now()
    """
    def parse_time_parts(t_str: Optional[str]):
        if not t_str:
            return None
        cleaned = str(t_str).strip()
        is_pm = bool(re.search(r'pm', cleaned, re.IGNORECASE))
        is_am = bool(re.search(r'am', cleaned, re.IGNORECASE))
        m = re.search(r'(\d{1,2}):(\d{2})', cleaned)
        if m:
            h = int(m.group(1))
            minute = int(m.group(2))
            if is_pm and h < 12:
                h += 12
            elif is_am and h == 12:
                h = 0
            return h, minute
        return None

    time_tuple = parse_time_parts(order_time)

    # 1. Explicit order_date
    if order_date:
        d_str = str(order_date).strip()
        parsed_d = None
        if "-" in d_str:
            parts = d_str.split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                try:
                    parsed_d = (int(parts[0]), int(parts[1]), int(parts[2]))
                except ValueError:
                    pass
        elif "/" in d_str:
            parts = d_str.split("/")
            if len(parts) == 3:
                try:
                    parsed_d = (int(parts[2]), int(parts[0]), int(parts[1]))
                except ValueError:
                    pass
        if parsed_d:
            h = time_tuple[0] if time_tuple else 0
            mi = time_tuple[1] if time_tuple else 0
            return datetime(parsed_d[0], parsed_d[1], parsed_d[2], h, mi, 0)

    # 2. Order number pattern: e.g. ORD-2026-09-17-002
    target_num = order_number or ""
    if not target_num and details:
        m_num = re.search(r'(?:ORD|JO)-(\d{4})-(\d{2})-(\d{2})-\d+', str(details))
        if m_num:
            target_num = m_num.group(0)

    if target_num:
        m_date = re.search(r'(\d{4})-(\d{2})-(\d{2})', str(target_num))
        if m_date:
            y, m, d = int(m_date.group(1)), int(m_date.group(2)), int(m_date.group(3))
            h = time_tuple[0] if time_tuple else 0
            mi = time_tuple[1] if time_tuple else 0
            if not time_tuple and raw_timestamp:
                try:
                    ts_dt = parse_local_date(raw_timestamp)
                    if ts_dt and (ts_dt.hour != 0 or ts_dt.minute != 0):
                        h, mi = ts_dt.hour, ts_dt.minute
                except Exception:
                    pass
            return datetime(y, m, d, h, mi, 0)

    # 3. raw_timestamp fallback
    if raw_timestamp:
        return parse_local_date(raw_timestamp)

    return datetime.now()

def recalculate_inventory_status(item: Inventory):
    item.recalculate_status()


def lock_inventory_row(db: Session, inv_id: int):
    """Row-lock inventory for safe concurrent stock updates (PostgreSQL; best-effort on SQLite)."""
    q = db.query(Inventory).filter(Inventory.item_id == inv_id)
    try:
        bind = db.get_bind()
        if bind and bind.dialect.name == "sqlite":
            return q.first()
        return q.with_for_update().first()
    except Exception:
        return q.first()



def assert_assignable_role(actor: User, role_name: str) -> str:
    """Prevent Owner privilege escalation into Admin."""
    requested = str(role_name or "").strip().lower()
    actor_role = str(getattr(getattr(actor, "role", None), "role_name", "") or "").strip().lower()
    if requested not in ("owner", "staff", "front staff", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role specified")
    if requested == "admin" and actor_role != "admin":
        raise HTTPException(status_code=403, detail="Only an Admin can assign the Admin role")
    if actor_role == "owner" and requested not in ("owner", "staff", "front staff"):
        raise HTTPException(status_code=403, detail="Owner accounts may only assign Owner, Staff, or Front Staff roles")
    return requested

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
    "cash_sessions":       "Cash Register",
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
    "historical_orders":   "Historical Records",
    "historical_items":    "Historical Records",
    "historical_images":   "Historical Records",
}

# Human labels for Activity History / audit diffs (never show raw snake_case alone).
AUDIT_FIELD_LABELS: dict = {
    "service_name": "Service Name",
    "base_price": "Price",
    "duration_days": "Duration (Days)",
    "category": "Category",
    "description": "Description",
    "service_code": "Service Code",
    "is_active": "Status",
    "was_active": "Previous Status",
    "username": "Username",
    "email": "Email",
    "role": "Role",
    "role_name": "Role",
    "password_changed": "Password Changed",
    "item_name": "Item Name",
    "inventory_number": "Inventory Number",
    "stock_quantity": "Stock Quantity",
    "unit": "Unit",
    "unit_price": "Unit Price",
    "retail_price": "Retail Price",
    "status": "Status",
    "amount": "Amount",
    "order_number": "Order Number",
    "orderNumber": "Order Number",
    "customer_name": "Customer",
    "customerName": "Customer",
    "contact_number": "Contact Number",
    "contactNumber": "Contact Number",
    "priorityLevel": "Priority",
    "grandTotal": "Grand Total",
    "grand_total": "Grand Total",
    "paymentMethod": "Payment Method",
    "paymentStatus": "Payment Status",
    "predictedCompletionDate": "Estimated Date",
    "previous_status": "Previous Status",
    "soft_delete": "Soft Delete",
    "reason": "Reason",
    "action": "Adjustment Type",
    "notes": "Notes",
    "expense_date": "Expense Date",
    "reorder_count": "Services Reordered",
    "order_id": "Order ID",
    "date_received": "Date Received",
    "ocr_status": "OCR Status",
    "branch": "Branch",
    "priority": "Priority",
}

_AUDIT_SKIP_KEYS = {
    "details", "password", "password_hash", "token", "history",
    "inventory_used", "inventoryUsed", "items",
}


def _audit_values_equal(a, b) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        if isinstance(a, (int, float)) or isinstance(b, (int, float)):
            return float(a) == float(b)
    except (TypeError, ValueError):
        pass
    if isinstance(a, bool) or isinstance(b, bool):
        return bool(a) == bool(b)
    if isinstance(a, (dict, list)) or isinstance(b, (dict, list)):
        try:
            return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
        except Exception:
            return str(a) == str(b)
    return str(a).strip() == str(b).strip()


def _human_audit_value(key: str, value) -> str:
    if value is None or value == "":
        return "None"
    if key in ("is_active", "was_active"):
        return "Active" if value in (True, "true", 1, "1") else "Inactive"
    if key in ("soft_delete", "password_changed", "auto_deduct", "is_retail", "inventoryApplied"):
        return "Yes" if value in (True, "true", 1, "1") else "No"
    if key in ("base_price", "unit_price", "retail_price", "grandTotal", "grand_total", "amount", "amountReceived", "balance", "depositAmount"):
        try:
            return f"₱{float(value):,.2f}"
        except (TypeError, ValueError):
            pass
    if key in ("status", "priorityLevel", "paymentMethod", "paymentStatus", "shippingPreference"):
        return str(value).replace("-", " ").replace("_", " ").strip().title()
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        if not value:
            return "None"
        parts = []
        for entry in value:
            if isinstance(entry, dict):
                parts.append(str(entry.get("name") or entry.get("item_name") or entry.get("service_name") or entry))
            else:
                parts.append(str(entry))
        return ", ".join(parts)
    return str(value)


def _audit_entity_name(old_values: Optional[dict], new_values: Optional[dict]) -> Optional[str]:
    ov = old_values if isinstance(old_values, dict) else {}
    nv = new_values if isinstance(new_values, dict) else {}
    for key in (
        "order_number", "orderNumber", "service_name", "item_name",
        "username", "customer_name", "customerName", "description",
    ):
        val = nv.get(key) if nv.get(key) not in (None, "") else ov.get(key)
        if val not in (None, ""):
            return str(val)
    return None


def build_audit_change_bits(old_values: Optional[dict], new_values: Optional[dict], limit: int = 8) -> list:
    """Return human-readable 'Label: old → new' fragments for Activity History."""
    ov = old_values if isinstance(old_values, dict) else {}
    nv = new_values if isinstance(new_values, dict) else {}
    bits = []
    for key in sorted(set(list(ov.keys()) + list(nv.keys()))):
        if key in _AUDIT_SKIP_KEYS:
            continue
        if key not in ov:
            bits.append(f"{AUDIT_FIELD_LABELS.get(key, key.replace('_', ' ').title())}: (new) {_human_audit_value(key, nv.get(key))}")
        elif key not in nv:
            bits.append(f"{AUDIT_FIELD_LABELS.get(key, key.replace('_', ' ').title())}: {_human_audit_value(key, ov.get(key))} → (removed)")
        elif not _audit_values_equal(ov.get(key), nv.get(key)):
            label = AUDIT_FIELD_LABELS.get(key, key.replace("_", " ").title())
            bits.append(
                f"{label}: {_human_audit_value(key, ov.get(key))} → {_human_audit_value(key, nv.get(key))}"
            )
        if len(bits) >= limit:
            break
    return bits


def ensure_audit_details(
    action: str,
    table_name: str,
    old_values: Optional[dict],
    new_values: Optional[dict],
) -> Optional[dict]:
    """
    Guarantee every mutating audit row carries a human-readable `details` string
    so Activity History never shows an empty 'Updated' card.
    """
    ov = dict(old_values) if isinstance(old_values, dict) else {}
    nv = dict(new_values) if isinstance(new_values, dict) else {}
    if isinstance(nv.get("details"), str) and nv["details"].strip():
        return nv or None

    module = TABLE_TO_MODULE.get(table_name, (table_name or "Record").replace("_", " ").title())
    entity = _audit_entity_name(ov, nv)
    who = f" '{entity}'" if entity else ""
    action_u = (action or "").upper()
    bits = build_audit_change_bits(ov, nv)

    if action_u in ("CREATE",):
        nv["details"] = f"{module} record{who} created" + (f" — {'; '.join(bits[:4])}" if bits else "")
    elif action_u in ("CANCEL",):
        prev = ov.get("status") or ov.get("previous_status") or nv.get("previous_status")
        nv["details"] = (
            f"Job order{who} cancelled"
            + (f" (was {str(prev).replace('-', ' ').title()})" if prev else "")
            + "."
        )
    elif action_u in ("DELETE", "DEACTIVATE"):
        soft = bool(nv.get("soft_delete") or nv.get("is_active") is False or action_u == "DEACTIVATE")
        verb = "removed from catalog (soft delete)" if soft else "permanently deleted"
        nv["details"] = f"{module} record{who} {verb}" + (f" — {'; '.join(bits[:3])}" if bits else "")
    elif action_u in ("UPDATE", "RESTOCK", "DEDUCT"):
        if bits:
            nv["details"] = f"{module} record{who} updated — {'; '.join(bits)}"
        else:
            nv["details"] = f"{module} record{who} updated (saved; no field value changes detected)"
    else:
        nv["details"] = f"{action_u.replace('_', ' ').title()} on {module}{who}"

    return nv


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
    created_at: Optional[datetime] = None,
) -> Optional[AuditLog]:
    """
    Centralized, fail-safe audit log writer.

    Design Principles:
    - NEVER raises an exception. A logging failure must never abort a business transaction.
    - Captures username/role at event-time (forensic integrity — not via JOIN at query-time).
    - Automatically resolves module from table_name if not explicitly provided.
    - Auto-injects human-readable `details` for Activity History when missing.

    Args:
        db:          Active SQLAlchemy session.
        action:      Action type string (CREATE, UPDATE, DELETE, CANCEL, LOGIN, LOGOUT, etc.)
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

        # Mutating business actions should always carry readable details for the UI.
        action_u = (action or "").upper()
        if action_u in (
            "CREATE", "UPDATE", "DELETE", "DEACTIVATE", "CANCEL", "RESTOCK", "DEDUCT"
        ) or table_name in (
            "orders", "users", "services", "inventory", "expenses", "historical_orders"
        ):
            if isinstance(old_values, dict) or isinstance(new_values, dict) or action_u in ("CREATE", "DELETE", "CANCEL"):
                new_values = ensure_audit_details(action_u, table_name, old_values, new_values)

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

        actor_username = user.username if user else "system"
        action_u = (action or "").upper().replace(" ", "_")

        # Deduplication check: prevent duplicate logs for the same user, action, table, and record within a recent window
        # EXEMPTION: Status transitions and undos (e.g. order status changes) must ALWAYS be logged and never deduplicated!
        is_status_transition = False
        if old_values and new_values and isinstance(old_values, dict) and isinstance(new_values, dict):
            old_st = str(old_values.get("status") or old_values.get("order_status") or "").strip().lower()
            new_st = str(new_values.get("status") or new_values.get("order_status") or "").strip().lower()
            if old_st and new_st and old_st != new_st:
                is_status_transition = True
        if new_values and isinstance(new_values, dict):
            det = str(new_values.get("details") or "").lower()
            if "status changed" in det or "status reverted" in det or "undo" in det or "reverted from" in det:
                is_status_transition = True

        if not is_status_transition:
            try:
                from datetime import timedelta
                dedup_window_secs = 60 if action_u in ("LOGIN", "LOGIN_SUCCESS", "PRINT", "REPORT_GENERATED", "EXPORT_PDF", "EXPORT_CSV") else 10
                window_start = datetime.now() - timedelta(seconds=dedup_window_secs)
                recent_q = db.query(AuditLog).filter(
                    AuditLog.username == actor_username,
                    AuditLog.action_type == action,
                    AuditLog.table_name == table_name,
                    AuditLog.created_at >= window_start,
                )
                if record_id is not None:
                    recent_q = recent_q.filter(AuditLog.record_id == record_id)
                else:
                    recent_q = recent_q.filter(AuditLog.record_id.is_(None))
                
                existing = recent_q.order_by(AuditLog.audit_log_id.desc()).first()
                if existing:
                    # Non-destructive overwrite: enrich new_values if existing lacked details
                    if new_values and isinstance(new_values, dict) and not existing.new_values:
                        existing.new_values = new_values
                        db.commit()
                    return existing
            except Exception:
                pass  # Fail safe to ensure logging continues

        entry_kwargs = {
            "user_id": user.user_id if user else None,
            "username": user.username if user else "system",
            "role": user.role.role_name if (user and user.role) else "system",
            "action_type": action,
            "module": resolved_module,
            "table_name": table_name,
            "record_id": record_id,
            "old_values": old_values,
            "new_values": new_values,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
        if created_at is not None:
            entry_kwargs["created_at"] = created_at
        entry = AuditLog(**entry_kwargs)
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

# Initialize FastAPI — hide interactive OpenAPI surface in Production
app = FastAPI(
    title="Shoelotskey 3NF & ML SMS",
    description="Backend API for Normalized Service Management",
    version="2.0.0",
    swagger_ui_parameters={"filter": True},
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
    openapi_url=None if _IS_PRODUCTION else "/openapi.json",
)

from api.research import router as research_router
app.include_router(research_router)

# Defense-in-depth: even if docs routes were somehow mounted, block them in Production.
if _IS_PRODUCTION:
    @app.middleware("http")
    async def _block_public_api_docs(request: Request, call_next):
        path = (request.url.path or "").rstrip("/") or "/"
        if path in ("/docs", "/redoc", "/openapi.json") or path.startswith("/docs/") or path.startswith("/redoc/"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        return await call_next(request)

# Configure Templates for custom error pages
# Look in the same directory as main.py for the 'templates' folder
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# Note: Schema migration and table sync are cleanly handled in @app.on_event("startup") startup_sequence().

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
    
    # [VITAL DEFENSE TOOL] Log to DB for Audit UI — store Owner-readable text only
    try:
        db = SessionLocal()
        log_audit(
            db=db,
            action="SERVER_ERROR",
            table_name="backend_v2",
            record_id=0,
            user=None,
            old_values={
                "error": safe_msg,
                "error_class": type(exc).__name__,
            },
            new_values={
                "file": file_name,
                "line": line_no,
                "url": request.url.path,
                "method": request.method,
                "summary": safe_msg,
            },
            request=request,
            module="System"
        )
    except: pass
    finally:
        if 'db' in locals(): db.close()

    print(f"[SECURITY ALERT] Unhandled Exception at {file_name}:{line_no} -> {raw_msg}")
    
    content = {
        "detail": safe_msg,
        "error_id": str(uuid.uuid4())[:8],
    }
    if not _IS_PRODUCTION:
        content["debug_info"] = {"file": file_name, "line": line_no}
    return JSONResponse(status_code=500, content=content)

# Mount Brand Assets & Historical Documents
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="brand_assets")

# Scanned job-order forms must not be world-readable. Serve via authenticated
# /api/historical/image/... only. Optional local debug mount:
#   EXPOSE_HISTORICAL_STATIC=1  (ignored when PORT/ENV marks Production)
hist_dir = os.path.join(os.path.dirname(__file__), "historical_data")
os.makedirs(hist_dir, exist_ok=True)
_expose_hist_static = os.getenv("EXPOSE_HISTORICAL_STATIC", "").strip().lower() in ("1", "true", "yes")
if _expose_hist_static and ENV != "Production":
    app.mount("/historical_data", StaticFiles(directory=hist_dir), name="historical_data")
    print("[SECURITY] Local historical_data static mount enabled (EXPOSE_HISTORICAL_STATIC)")
else:
    print("[SECURITY] historical_data is not publicly mounted — use /api/historical/image/")
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
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
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
    global engine, is_sqlite, SessionLocal, DATABASE_URL, DB_TYPE
    import db.database as db_mod
    
    print(f"[BOOT] Target: {str(db_mod.engine.url).split('@')[-1] if db_mod.engine else 'None'}")
    
    # Ensure local fallback database is ALWAYS ready even if we are online — but ONLY
    # for Localhost/defense continuity. P0-5: Production must never provision/maintain
    # a local SQLite file with seeded credentials on the Heroku ephemeral disk.
    if ENV != "Production":
        try:
            from sqlalchemy import create_engine
            local_engine = create_engine(LOCAL_SQLITE)
            if hasattr(db_mod, "ensure_sqlite_schema_and_defaults"):
                db_mod.ensure_sqlite_schema_and_defaults(local_engine)
            else:
                Base.metadata.create_all(bind=local_engine)
            local_engine.dispose()
            print("[BOOT] Local Fallback (shoelotskey.db) Structure & Defaults: OK.")
        except Exception as e:
            print(f"[BOOT] LOCAL DB SYNC WARNING: {e}")
    else:
        print("[BOOT] Production environment — skipping local SQLite fallback provisioning (P0-5).")

    # 1. Verify primary database connection and fallback to Local SQLite if Cloud Postgres is unreachable
    try:
        with db_mod.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[DATABASE] SUCCESS: Connected to Online PostgreSQL")
        # P0-5: Clear the outage flag if a transient blip during module import has
        # since recovered by the time the app-level startup event fires.
        db_mod.DB_UNAVAILABLE = False
    except Exception as e:
        if ENV == "Production":
            print(f"[DATABASE FATAL ERROR] Cloud Postgres unreachable in Production ({str(e)[:80]}...). Halting startup to prevent downgrade attack (P0-5 — no SQLite fallback in Production).")
            raise RuntimeError("Database connection failed in Production environment.")
        print(f"[DATABASE OFFLINE AUTO-SWITCH] Cloud Postgres unreachable ({str(e)[:80]}...). Switching directly to Local SQLite.")
        if hasattr(db_mod, "switch_to_offline_sqlite"):
            db_mod.switch_to_offline_sqlite()
        else:
            from sqlalchemy.orm import sessionmaker
            db_mod.is_sqlite = True
            db_mod.DATABASE_URL = LOCAL_SQLITE
            db_mod.engine = create_engine(LOCAL_SQLITE, connect_args={"check_same_thread": False})
            db_mod.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_mod.engine)
    
    engine = db_mod.engine
    is_sqlite = db_mod.is_sqlite
    SessionLocal = db_mod.SessionLocal
    DATABASE_URL = db_mod.DATABASE_URL
    DB_TYPE = "SQLite" if is_sqlite else "PostgreSQL"

    # 2. Schema Verification & Creation (Active Engine)
    try:
        Base.metadata.create_all(bind=engine)
        print(f"[DATABASE] Operating in Mode: {'OFFLINE (Local SQLite)' if is_sqlite else 'ONLINE (Cloud PostgreSQL)'}")
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
    except Exception as init_err:
        print(f"[DATABASE] Notice during schema verification: {init_err}")
        if not is_sqlite and ENV != "Production":
            print("[DATABASE] Auto-switching to SQLite due to schema verification failure.")
            if hasattr(db_mod, "switch_to_offline_sqlite"):
                db_mod.switch_to_offline_sqlite()
            else:
                from sqlalchemy.orm import sessionmaker
                db_mod.is_sqlite = True
                db_mod.DATABASE_URL = LOCAL_SQLITE
                db_mod.engine = create_engine(LOCAL_SQLITE, connect_args={"check_same_thread": False})
                db_mod.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_mod.engine)
            engine = db_mod.engine
            is_sqlite = db_mod.is_sqlite
            SessionLocal = db_mod.SessionLocal
            DATABASE_URL = db_mod.DATABASE_URL
            DB_TYPE = "SQLite"
            Base.metadata.create_all(bind=engine)
            inspector = inspect(engine)
            existing_tables = set(inspector.get_table_names())
        else:
            existing_tables = set()
    
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
                if "active_session_id" not in columns:
                    try: conn.execute(text("ALTER TABLE users ADD COLUMN active_session_id VARCHAR(100)"))
                    except: pass
                else:
                    try: conn.execute(text("UPDATE users SET active_session_id = NULL WHERE active_session_id IS NOT NULL"))
                    except: pass
    except Exception as e:
        print(f">>> Migration Warning (users table): {e}")

    # Historical items: per-item claimed dates from paper notes
    try:
        if "historical_items" in existing_tables:
            columns = [c['name'] for c in inspector.get_columns("historical_items")]
            with engine.begin() as conn:
                if "claimed_date" not in columns:
                    print(">>> Migration: Adding claimed_date to historical_items")
                    try:
                        conn.execute(text("ALTER TABLE historical_items ADD COLUMN claimed_date TIMESTAMP NULL"))
                    except Exception:
                        pass
    except Exception as e:
        print(f">>> Migration Warning (historical_items table): {e}")

    # Historical orders: original (pre-discount) paper total
    try:
        if "historical_orders" in existing_tables:
            columns = [c['name'] for c in inspector.get_columns("historical_orders")]
            with engine.begin() as conn:
                if "original_grand_total" not in columns:
                    print(">>> Migration: Adding original_grand_total to historical_orders")
                    try:
                        conn.execute(text("ALTER TABLE historical_orders ADD COLUMN original_grand_total NUMERIC(10, 2) NULL"))
                    except Exception:
                        pass
    except Exception as e:
        print(f">>> Migration Warning (historical_orders original_grand_total): {e}")

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
            if "connected_addons" not in columns:
                print(">>> Migration: Adding connected_addons to services")
                with engine.begin() as conn:
                    try:
                        col_type = "JSONB" if not is_sqlite else "JSON"
                        conn.execute(text(f"ALTER TABLE services ADD COLUMN connected_addons {col_type} NULL"))
                    except:
                        try: conn.execute(text("ALTER TABLE services ADD COLUMN connected_addons TEXT NULL"))
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
                            ("low_stock_threshold", "DOUBLE PRECISION DEFAULT 0.0" if not is_sqlite_target else "REAL DEFAULT 0.0"),
                            ("is_retail", "BOOLEAN DEFAULT FALSE"),
                            ("retail_price", "DOUBLE PRECISION DEFAULT 0.0" if not is_sqlite_target else "REAL DEFAULT 0.0"),
                        ]:
                            if col_name not in target_columns:
                                try:
                                    conn.execute(text(f"ALTER TABLE inventory ADD COLUMN {col_name} {col_type}"))
                                    print(f">>> Migration: Added {col_name} to inventory in {db_name}")
                                except Exception as col_err:
                                    print(f"[SCHEMA MIGRATION WARNING] Could not add {col_name} on {db_name}: {col_err}")
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
                    if 'pre_cancellation_state' not in cols:
                        print(f">>> Migration ({engine_name}): Adding orders.pre_cancellation_state ({json_type})")
                        conn.execute(text(f"ALTER TABLE orders ADD COLUMN pre_cancellation_state {json_type}"))
                
                # Fix ITEMS table
                if 'items' in tables:
                    cols = [c['name'] for c in inspector.get_columns('items')]
                    if 'inventory_used' not in cols:
                        print(f">>> Migration ({engine_name}): Adding items.inventory_used ({json_type})")
                        if is_pg:
                            conn.execute(text(f"ALTER TABLE items ADD COLUMN inventory_used {json_type} DEFAULT '[]'::jsonb"))
                        else:
                            conn.execute(text(f"ALTER TABLE items ADD COLUMN inventory_used {json_type} DEFAULT '[]'"))
                
                # Fix INVENTORY table — add low_stock_threshold if missing and expand trigger_service to TEXT on PostgreSQL
                if 'inventory' in tables:
                    inv_cols = [c['name'] for c in inspector.get_columns('inventory')]
                    if 'low_stock_threshold' not in inv_cols:
                        print(f">>> Migration ({engine_name}): Adding inventory.low_stock_threshold")
                        conn.execute(text("ALTER TABLE inventory ADD COLUMN low_stock_threshold FLOAT DEFAULT 0.0"))
                    if is_pg and 'trigger_service' in inv_cols:
                        try:
                            conn.execute(text("ALTER TABLE inventory ALTER COLUMN trigger_service TYPE TEXT;"))
                        except Exception:
                            pass

                # Fix INVENTORY_LOGS table — add service_name and execution_ref
                if 'inventory_logs' in tables:
                    log_cols = [c['name'] for c in inspector.get_columns('inventory_logs')]
                    if 'service_name' not in log_cols:
                        print(f">>> Migration ({engine_name}): Adding inventory_logs.service_name")
                        conn.execute(text("ALTER TABLE inventory_logs ADD COLUMN service_name VARCHAR(100) NULL"))
                    if 'execution_ref' not in log_cols:
                        print(f">>> Migration ({engine_name}): Adding inventory_logs.execution_ref")
                        conn.execute(text("ALTER TABLE inventory_logs ADD COLUMN execution_ref VARCHAR(100) NULL"))
                
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
                    col_meta = {c['name']: c for c in al_inspector.get_columns("audit_logs")}
                    # 1. ATOMIC MIGRATION: Drop NOT NULL constraint and convert action_type enum only if needed
                    if is_pg:
                        try:
                            if 'user_id' in col_meta and not col_meta['user_id'].get('nullable', True):
                                with sync_engine.begin() as pg_conn:
                                    pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL"))
                                print(f">>> Migration ({engine_label}): Successfully executed ALTER TABLE audit_logs DROP NOT NULL on user_id and COMMITTED.")
                        except Exception as uid_err:
                            print(f">>> Migration Notice (audit_logs.user_id on {engine_label}): {uid_err}")

                        try:
                            if 'record_id' in col_meta and not col_meta['record_id'].get('nullable', True):
                                with sync_engine.begin() as pg_conn:
                                    pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN record_id DROP NOT NULL"))
                                print(f">>> Migration ({engine_label}): Successfully executed ALTER TABLE audit_logs DROP NOT NULL on record_id and COMMITTED.")
                        except Exception as rec_err:
                            print(f">>> Migration Notice (audit_logs.record_id on {engine_label}): {rec_err}")

                        try:
                            act_type_str = str(col_meta.get('action_type', {}).get('type', '')).upper()
                            if 'VARCHAR' not in act_type_str and 'TEXT' not in act_type_str and 'STRING' not in act_type_str:
                                with sync_engine.begin() as pg_conn:
                                    pg_conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN action_type TYPE VARCHAR(100) USING action_type::text"))
                                print(f">>> Migration ({engine_label}): Successfully converted audit_logs.action_type from enum to VARCHAR(100) and COMMITTED.")
                        except Exception as act_err:
                            print(f">>> Migration Notice (audit_logs.action_type on {engine_label}): {act_err}")
                    else:
                        try:
                            with sync_engine.begin() as conn:
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

            # 4. ATOMIC MIGRATIONS: services & orders new feature columns
            try:
                feat_inspector = inspect(sync_engine)
                tbl_names = feat_inspector.get_table_names()

                # services.connected_addons
                if "services" in tbl_names:
                    svc_cols = [c['name'] for c in feat_inspector.get_columns("services")]
                    if "connected_addons" not in svc_cols:
                        col_type = "JSON" if is_pg else "JSON"
                        try:
                            with sync_engine.begin() as col_conn:
                                col_conn.execute(text(f"ALTER TABLE services ADD COLUMN connected_addons {col_type}"))
                            print(f">>> Migration ({engine_label}): Added services.connected_addons")
                        except Exception as c_err:
                            print(f">>> Migration Notice (services.connected_addons on {engine_label}): {c_err}")

                # orders cancellation and refund columns
                if "orders" in tbl_names:
                    ord_cols = [c['name'] for c in feat_inspector.get_columns("orders")]
                    for col_name, pg_t, sq_t in [
                        ("cancellation_stage",  "VARCHAR(30)", "VARCHAR(30)"),
                        ("cancellation_reason", "VARCHAR(255)", "VARCHAR(255)"),
                        ("refund_status",       "VARCHAR(30)", "VARCHAR(30)"),
                        ("refund_amount",       "NUMERIC(10, 2) DEFAULT 0.0", "DECIMAL(10, 2) DEFAULT 0.0"),
                        ("refund_reason",       "VARCHAR(255)", "VARCHAR(255)"),
                        ("cancelled_at",        "TIMESTAMP", "TIMESTAMP"),
                    ]:
                        if col_name not in ord_cols:
                            col_type = pg_t if is_pg else sq_t
                            try:
                                with sync_engine.begin() as col_conn:
                                    col_conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                                print(f">>> Migration ({engine_label}): Added orders.{col_name}")
                            except Exception as c_err:
                                print(f">>> Migration Notice (orders.{col_name} on {engine_label}): {c_err}")

                # items individual status, release and claimed dates
                if "items" in tbl_names:
                    item_cols = [c['name'] for c in feat_inspector.get_columns("items")]
                    for col_name, pg_t, sq_t in [
                        ("status",       "VARCHAR(30)", "VARCHAR(30)"),
                        ("released_at",  "TIMESTAMP", "TIMESTAMP"),
                        ("claimed_at",   "TIMESTAMP", "TIMESTAMP"),
                    ]:
                        if col_name not in item_cols:
                            col_type = pg_t if is_pg else sq_t
                            try:
                                with sync_engine.begin() as col_conn:
                                    col_conn.execute(text(f"ALTER TABLE items ADD COLUMN {col_name} {col_type}"))
                                print(f">>> Migration ({engine_label}): Added items.{col_name}")
                            except Exception as c_err:
                                print(f">>> Migration Notice (items.{col_name} on {engine_label}): {c_err}")
            except Exception as feat_mig_err:
                print(f">>> Feature Migration Notice on {engine_label}: {feat_mig_err}")

            # 5. ATOMIC MIGRATION: Cash Sessions table
            try:
                CashSession.__table__.create(bind=sync_engine, checkfirst=True)
            except Exception as cs_mig_err:
                print(f">>> Migration Notice (cash_sessions on {engine_label}): {cs_mig_err}")
    except Exception as al_outer_err:
        print(f">>> Migration Warning (audit_logs outer): {al_outer_err}")



    # 3. Seed Lookups & Static Data
    # ------------------------------------------
    db = SessionLocal()
    try:
        seed_lookups(db)
        reconcile_sqlite_users_into_session(db)
        checkpoint_sqlite()
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

    try:
        # Older claimed/for-release rows often have released_at cleared (claim used to
        # wipe it). Restore the first For Release status-log time, then claimed_at.
        filled_from_log = db.execute(text("""
            UPDATE orders
            SET released_at = (
                SELECT MIN(sl.changed_at)
                FROM status_log sl
                JOIN status s ON s.status_id = sl.status_id
                WHERE sl.order_id = orders.order_id
                  AND lower(s.status_name) = 'for-release'
            )
            WHERE released_at IS NULL
              AND status_id IN (
                  SELECT status_id FROM status
                  WHERE lower(status_name) IN ('for-release', 'claimed')
              )
        """))
        filled_from_claim = db.execute(text("""
            UPDATE orders
            SET released_at = claimed_at
            WHERE released_at IS NULL
              AND claimed_at IS NOT NULL
              AND status_id IN (
                  SELECT status_id FROM status
                  WHERE lower(status_name) IN ('for-release', 'claimed')
              )
        """))
        db.commit()
        restored = (filled_from_log.rowcount or 0) + (filled_from_claim.rowcount or 0)
        if restored:
            print(f">>> Restored missing released_at on {restored} for-release/claimed order(s).")
    except Exception as release_backfill_err:
        db.rollback()
        print(f">>> Release-date backfill warning: {release_backfill_err}")
    
    # Seed Roles
    if db.query(Role).count() == 0:
        print(">>> Seeding Roles...")
        roles = [Role(role_name="owner"), Role(role_name="staff"), Role(role_name="front staff"), Role(role_name="admin")]
        db.add_all(roles)
        db.commit()
    else:
        # Ensure admin role exists dynamically
        admin_role = db.query(Role).filter(Role.role_name == "admin").first()
        if not admin_role:
            db.add(Role(role_name="admin"))
            db.commit()
        # Ensure front staff role exists dynamically
        front_staff_role = db.query(Role).filter(Role.role_name == "front staff").first()
        if not front_staff_role:
            front_staff_role = Role(role_name="front staff")
            db.add(front_staff_role)
            db.commit()

    # Ensure front_staff user has the front staff role
    front_staff_role = db.query(Role).filter(Role.role_name == "front staff").first()
    if front_staff_role:
        fs_u = db.query(User).filter(User.username == "front_staff").first()
        if fs_u and fs_u.role_id != front_staff_role.role_id:
            fs_u.role_id = front_staff_role.role_id
            db.commit()
            print(">>> Updated user 'front_staff' to role 'front staff'.")

    # Seed Admin User
    import bcrypt
    admin_u = db.query(User).filter(User.username == "admin").first()
    if not admin_u:
        print(">>> Seeding Admin User...")
        role_admin = db.query(Role).filter(Role.role_name == "admin").first()
        if role_admin:
            admin_pw_hash = bcrypt.hashpw(b"@admin123", bcrypt.gensalt()).decode("utf-8")
            db.add(User(
                username="admin", 
                email="charmaineroseangeles@gmail.com", 
                password_hash=admin_pw_hash, 
                role_id=role_admin.role_id, 
                is_active=True
            ))
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

    # Seed Payment Methods — must match frontend: 'cash', 'gcash', 'maya', 'bank-transfer'
    for m in ['cash', 'gcash', 'maya', 'bank-transfer']:
        if not db.query(PaymentMethod).filter(PaymentMethod.method_name == m).first():
            db.add(PaymentMethod(method_name=m))
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
        {"service_name": "Undersole", "base_price": 150, "category": "addon", "duration_days": 25, "service_code": "USL", "is_active": True, "sort_order": 10},
        {"service_name": "Midsole", "base_price": 150, "category": "addon", "duration_days": 25, "service_code": "MSL", "is_active": True, "sort_order": 11},
        {"service_name": "Minor Restoration", "base_price": 300, "category": "addon", "duration_days": 25, "service_code": "MRS", "is_active": True, "sort_order": 12},
        {"service_name": "Minor Retouch", "base_price": 125, "category": "addon", "duration_days": 20, "service_code": "MRT", "is_active": True, "sort_order": 13},
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
            # Do NOT re-insert catalog rows on every boot. Owner deletes (hard or soft)
            # must stick — previously Midsole/Undersole Full Reglue were force-added here
            # whenever missing, which made them reappear after every server restart.
            print(f">>> Catalog Sync: {service_count} services found. Skipping forced service inserts.")

            # Deactivate legacy duplicate service names unconditionally so they stop cluttering Add-ons
            for legacy_name in ("Midsole Full Reglue", "Undersole Full Reglue"):
                legacy_svcs = db.query(Service).filter(
                    Service.service_name == legacy_name,
                    Service.is_active == True,
                ).all()
                for ls in legacy_svcs:
                    ls.is_active = False
                    print(f"  -> Deactivated legacy duplicate '{legacy_name}'")
            
            # ── Clean up duplicate Color Renewal services safely ──
            cr_services = db.query(Service).filter(Service.service_name == "Color Renewal").all()
            if len(cr_services) > 1:
                print(">>> Cleaning up duplicate Color Renewal services...")
                kept = False
                for cr in sorted(cr_services, key=lambda x: x.base_price, reverse=True):
                    if not kept:
                        kept = True
                        cr.is_active = True
                    else:
                        cr.is_active = False
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
            # Cleaner: 1 jug = 4000 mL, start with 1 jug (4000 mL), low stock = 1000 mL (1 liter), 2000 mL/day usage
            {"item_name": "Cleaner",
             "category": "Chemical", "stock_quantity": 4000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "jug",
             "low_stock_threshold": 1000.0, "consumption_qty": 2000.0, "consumption_unit": "mL"},
            # Bleach: 3 jugs default, 1 jug = 4000 mL -> 12000 mL; low stock = 1000 mL (1 liter), 1000 mL/day usage
            {"item_name": "Bleach",
             "category": "Chemical", "stock_quantity": 12000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "jug",
             "low_stock_threshold": 1000.0, "consumption_qty": 1000.0, "consumption_unit": "mL"},
            # Stain Remover: 1 jug = 4000 mL; low stock = 1000 mL (1 liter), 1000 mL/day usage
            {"item_name": "Stain Remover",
             "category": "Chemical", "stock_quantity": 4000.0, "unit": "mL",
             "package_size": 4000.0, "package_unit": "jug",
             "low_stock_threshold": 1000.0, "consumption_qty": 1000.0, "consumption_unit": "mL"},
            # Leather Conditioner: 1 tub = 260 g; low stock = 50 g, 5 g/day (1 swipe of palm)
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
            "Cleaner":            (4000.0,  "mL", 4000.0, "jug",    1000.0, 2000.0, "mL"),
            "Bleach":             (12000.0, "mL", 4000.0, "jug",    1000.0, 1000.0, "mL"),
            "Stain Remover":      (4000.0,  "mL", 4000.0, "jug",    1000.0, 1000.0, "mL"),
            "Leather Conditioner":(260.0,   "g",  260.0,  "tub",     50.0,     5.0, "g"),
            "Deodorizer":         (4320.0,  "mL", 360.0,  "can",    360.0,  180.0, "mL"),
        }
        for name, (stock, unit, pkg_sz, pkg_unit, threshold, cons_qty, cons_unit) in migration_map.items():
            inv_item = db.query(Inventory).filter(Inventory.item_name == name).first()
            if inv_item:
                # Force update packaging, consumption, and unit settings if they are out of specification or set to 1
                if (inv_item.unit != unit or inv_item.package_size <= 1.0 or inv_item.package_unit != pkg_unit or 
                    inv_item.low_stock_threshold != threshold or inv_item.consumption_qty != cons_qty):
                    print(f">>> Inventory Migration: Synchronizing '{name}' to {pkg_sz} {unit}/{pkg_unit} consumption tracking")
                    inv_item.unit = unit
                    inv_item.package_size = pkg_sz
                    inv_item.package_unit = pkg_unit
                    inv_item.low_stock_threshold = threshold
                    inv_item.consumption_qty = cons_qty
                    inv_item.consumption_unit = cons_unit
                    # If Bleach had package size 1 or default 4000 stock from prior seed, reset stock to 12000 (3 jugs)
                    if name == "Bleach" and inv_item.stock_quantity <= 4000.0 and inv_item.package_size == 4000.0:
                        inv_item.stock_quantity = 12000.0
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

    # 5.5 Reconcile SQLite orders to PostgreSQL (Cloud) and purge stale diagnostic/guest orders
    try:
        # Delete associated payments, items, delivery, etc for HEALTH-, E3FE31C5, or Guest orders from PostgreSQL
        from sqlalchemy import or_
        guest_customers = db.query(Customer).filter(Customer.customer_name.ilike('guest%')).all()
        guest_ids = [c.customer_id for c in guest_customers] if guest_customers else [-1]

        test_orders = db.query(Order).filter(or_(Order.order_number.like('HEALTH-%'), Order.order_number == 'E3FE31C5', Order.customer_id.in_(guest_ids))).all()
        if test_orders:
            for ho in test_orders:
                db.execute(text("DELETE FROM payments WHERE order_id = :oid"), {"oid": ho.order_id})
                db.execute(text("DELETE FROM deliveries WHERE order_id = :oid"), {"oid": ho.order_id})
                db.query(StatusLog).filter(StatusLog.order_id == ho.order_id).delete(synchronize_session=False)
                db.query(InventoryLog).filter(InventoryLog.order_id == ho.order_id).update({"order_id": None}, synchronize_session=False)
                items = db.query(Item).filter(Item.order_id == ho.order_id).all()
                for item in items:
                    db.execute(text("DELETE FROM item_service_mapping WHERE item_id = :itid"), {"itid": item.item_id})
                    db.execute(text("DELETE FROM item_condition_mapping WHERE item_id = :itid"), {"itid": item.item_id})
                    db.delete(item)
                db.delete(ho)
            db.commit()
            print(f">>> Boot Cleanup (Cloud PostgreSQL): Purged {len(test_orders)} diagnostic/guest orders.")
            
        # Reconcile any missing orders from SQLite backup to Cloud
        if not is_sqlite:
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            local_eng = create_engine(LOCAL_SQLITE)
            LocalSession = sessionmaker(bind=local_eng)
            with LocalSession() as ldb:
                # Also purge HEALTH-, E3FE31C5, and Guest orders from local SQLite while we are at it
                ldb_guest = ldb.query(Customer).filter(Customer.customer_name.ilike('guest%')).all()
                ldb_guest_ids = [c.customer_id for c in ldb_guest] if ldb_guest else [-1]
                ldb_health = ldb.query(Order).filter(or_(Order.order_number.like('HEALTH-%'), Order.order_number == 'E3FE31C5', Order.customer_id.in_(ldb_guest_ids))).all()
                if ldb_health:
                    for lho in ldb_health:
                        ldb.execute(text("DELETE FROM payments WHERE order_id = :oid"), {"oid": lho.order_id})
                        ldb.execute(text("DELETE FROM deliveries WHERE order_id = :oid"), {"oid": lho.order_id})
                        ldb.query(StatusLog).filter(StatusLog.order_id == lho.order_id).delete(synchronize_session=False)
                        ldb.query(InventoryLog).filter(InventoryLog.order_id == lho.order_id).update({"order_id": None}, synchronize_session=False)
                        litems = ldb.query(Item).filter(Item.order_id == lho.order_id).all()
                        for li in litems:
                            ldb.execute(text("DELETE FROM item_service_mapping WHERE item_id = :itid"), {"itid": li.item_id})
                            ldb.execute(text("DELETE FROM item_condition_mapping WHERE item_id = :itid"), {"itid": li.item_id})
                            ldb.delete(li)
                        ldb.delete(lho)
                    ldb.commit()
                    print(f">>> Boot Cleanup (Local SQLite): Purged {len(ldb_health)} diagnostic/guest orders.")

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
        import os
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
                
        if os.environ.get("DISABLE_AUTO_SYNC", "false").lower() == "true":
            print("[AUTO-SYNC] Background synchronization disabled via DISABLE_AUTO_SYNC=true.")
            print("[AUTO-SYNC] Run 'python backend/db/sync_to_local.py' manually if offline fallback data is needed.")
        else:
            threading.Thread(target=auto_sync_loop, daemon=True).start()
            print("[AUTO-SYNC] Background synchronization engine initialized.")
    except Exception as t_err:
        print(f"[AUTO-SYNC] Failed to initialize background thread: {t_err}")

# Startup events are now handled by startup_sequence()

@app.on_event("shutdown")
def shutdown_event():
    """Flush SQLite WAL then dispose pools so created users survive restart."""
    try:
        checkpoint_sqlite()
        if engine:
            engine.dispose()
            print("[SHUTDOWN] Cleanly terminated database connection pool.")
    except Exception as e:
        print(f"[SHUTDOWN WARNING] {e}")

@app.get("/api/health-check")
def health_check_extended(db: Session = Depends(get_db)):
    """Lightweight liveness probe. Exposes dialect label only — no filesystem paths."""
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "online" if db_ok else "degraded",
        "database": "PostgreSQL (Remote)" if not is_sqlite else "SQLite (Local)",
        "environment": ENV,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Owner-only diagnostic snapshot (counts, build path). Use /api/health-check for uptime probes."""
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
        logger.warning(f"[DIAGNOSTIC] Counts query failed: {e}")
        counts["error"] = "Diagnostic counts query unavailable"

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
        
        # Purge test/deleted dummy orders from SQLite immediately
        try:
            cursor.execute("DELETE FROM orders WHERE order_number LIKE '%E3FE%' OR order_number = 'E3FE31C5'")
            cursor.execute("DELETE FROM orders WHERE customer_id IN (SELECT customer_id FROM customers WHERE customer_name LIKE '%Guest%')")
            conn.commit()
        except Exception:
            pass
        
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
            if "E3FE" in str(off_o[1]) or str(off_o[1]) == "E3FE31C5":
                continue
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
                    # Soft-delete must stick: never reactivate from a stale offline SQLite row.
                    exists_i.is_active = bool(exists_i.is_active) and i_active_bool
                    exists_i.auto_deduct = i_auto_bool
                    exists_i.auto_deduct_trigger = i_trigger
                    exists_i.trigger_service = i_service
                    exists_i.consumption_qty = i_cq
                    exists_i.consumption_unit = i_cu
                    exists_i.package_size = i_ps
                    exists_i.package_unit = i_pu
            print("[SYNC] Inventory table sync processed successfully.")
        except Exception as inv_sync_err:
            db.rollback()
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
            db.rollback()
            print(f"[SYNC WARNING] Skipping expenses table sync: {exp_sync_err}")

        # 1.7. Sync audit_logs from SQLite to PG (Batch memory check to avoid connection dropouts)
        try:
            cursor.execute("SELECT username, role, action_type, module, table_name, record_id, old_values, new_values, ip_address, created_at FROM audit_logs ORDER BY rowid DESC LIMIT 100")
            existing_pg_logs = {
                f"{l.username}_{l.action_type}_{l.record_id}_{l.table_name}_{l.created_at.strftime('%Y-%m-%d %H:%M') if l.created_at else ''}"
                for l in db.query(AuditLog.username, AuditLog.action_type, AuditLog.record_id, AuditLog.table_name, AuditLog.created_at).all()
            }
            for off_log in cursor.fetchall():
                created_m = str(off_log[9])[:16] if off_log[9] else ""
                log_key = f"{off_log[0]}_{off_log[2]}_{off_log[5]}_{off_log[4]}_{created_m}"
                if log_key not in existing_pg_logs:
                    parsed_cat = None
                    if off_log[9]:
                        try:
                            parsed_cat = datetime.fromisoformat(str(off_log[9]))
                        except Exception:
                            parsed_cat = datetime.now()
                    else:
                        parsed_cat = datetime.now()
                    new_log = AuditLog(
                        username=off_log[0],
                        role=off_log[1],
                        action_type=off_log[2],
                        module=off_log[3],
                        table_name=off_log[4],
                        record_id=off_log[5],
                        old_values=json.loads(off_log[6]) if off_log[6] and isinstance(off_log[6], str) else off_log[6],
                        new_values=json.loads(off_log[7]) if off_log[7] and isinstance(off_log[7], str) else off_log[7],
                        ip_address=off_log[8],
                        created_at=parsed_cat,
                    )
                    db.add(new_log)
                    existing_pg_logs.add(log_key)
            print("[SYNC] Audit logs table sync processed successfully.")
        except Exception as log_sync_err:
            db.rollback()
            print(f"[SYNC WARNING] Skipping audit_logs table sync: {log_sync_err}")
        
        db.commit()
        conn.close()
        
        # Active database is kept intact and synced (No file duplication/renaming)
        
        return {"status": "success", "synced_records": synced_count}
    except Exception as e:
        db.rollback()
        print(f"[RECONCILE ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# ==========================================
# 0.6 CAPSTONE STORED PROCEDURE DEMO
# ==========================================
@app.post("/api/trigger-analytics-procedure")
def trigger_daily_sales_procedure(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """
    Capstone Defense Route: Manually executes the PostgreSQL Stored Procedure 
    instead of waiting for the midnight pg_cron job. Falls back to SQLite emulation 
    if running offline (Hybrid Persistence Bridge).

    SECURITY (OWASP A01 / P0-1): Owner-only. This mutates the daily_analytics_summary
    cache table and must not be callable by unauthenticated clients.
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
            
            # 3. Aggregate totals from normalized orders table (lessening refunds, accounting for retained cancellation deposits)
            result = db.execute(text("""
            SELECT COALESCE(SUM(
                CASE 
                    WHEN status_id = 4 THEN (
                        COALESCE((SELECT COALESCE(SUM(p.amount_received), 0.0) FROM payments p WHERE p.order_id = orders.order_id), 0.0) 
                        - COALESCE(refund_amount, 0.0)
                    )
                    ELSE grand_total - COALESCE(refund_amount, 0.0)
                END
            ), 0.0), 
            COUNT(CASE WHEN status_id != 4 THEN order_id END)
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
    
    login_input = str(request.username or "").strip()
    norm_user = login_input.lower()
    if norm_user == "ownerowner":
        norm_user = "owner"
    elif norm_user == "staffstaff":
        norm_user = "staff"
    elif norm_user == "adminadmin":
        norm_user = "admin"

    try:
        try:
            db_user = db.query(User).options(joinedload(User.role)).filter(
                or_(
                    func.lower(User.username) == norm_user,
                    func.lower(User.email) == login_input.lower(),
                    func.lower(User.username) == login_input.lower()
                )
            ).first()
        except Exception as query_err:
            import db.database as db_mod
            # P0-5: Production must fail safely (503) rather than silently authenticate
            # against a local SQLite file that may contain seeded/weak credentials.
            if db_mod.IS_PRODUCTION_ENV:
                print(f"[AUTH] Login query failed against PostgreSQL in Production ({query_err}). Rejecting (P0-5 — no SQLite failover in Production).")
                raise HTTPException(status_code=503, detail="Database service temporarily unavailable. Please try again shortly.")
            print(f"[AUTH OFFLINE RESILIENCE] Primary query failed ({query_err}). Auto-switching to offline SQLite...")
            db.close()
            fallback_session_maker = db_mod.switch_to_offline_sqlite()
            db = fallback_session_maker()
            db_user = db.query(User).options(joinedload(User.role)).filter(
                or_(
                    func.lower(User.username) == norm_user,
                    func.lower(User.email) == login_input.lower(),
                    func.lower(User.username) == login_input.lower()
                )
            ).first()
        
        if not db_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # 0. CHECK ACTIVE STATUS (Block Deactivated Users)
        if not db_user.is_active:
            print(f"[AUTH] Denied: Account '{request.username}' is inactive/deactivated.")
            raise HTTPException(status_code=403, detail="Account is deactivated. Please contact an administrator.")

        # 1. CHECK LOCK STATUS (Admin account is completely immune to lockouts)
        is_admin_account = (db_user.username or '').lower() == 'admin' or (db_user.role and db_user.role.role_name.lower() == 'admin')
        if is_admin_account:
            if db_user.locked_until is not None or (db_user.failed_login_attempts or 0) > 0:
                db_user.locked_until = None
                db_user.failed_login_attempts = 0
                try:
                    db.commit()
                except Exception:
                    db.rollback()
        elif db_user.locked_until:
            if db_user.locked_until > datetime.utcnow():
                if db_user.locked_until.year >= 2099:
                    print(f"[AUTH] Denied: Account '{request.username}' has been restricted by an administrator.")
                    raise HTTPException(
                        status_code=403, 
                        detail="Account access has been restricted by an administrator. Please contact your manager or owner to unlock."
                    )
                import math
                remaining = max(1, int(math.ceil((db_user.locked_until - datetime.utcnow()).total_seconds() / 60.0)))
                print(f"[AUTH] Denied: Account '{request.username}' is locked for {remaining} more mins.")
                raise HTTPException(
                    status_code=403, 
                    detail=f"Account locked. Try again in {remaining} minute{'s' if remaining != 1 else ''}."
                )
            else:
                # Lock has expired. Reset attempts to prevent immediate re-locking on next failure.
                db_user.failed_login_attempts = 0
                db_user.locked_until = None
                db.commit()

        if db_user.failed_login_attempts is None:
            db_user.failed_login_attempts = 0

        # 2. VALIDATE PASSWORD (Bcrypt with Plaintext Migration Disabled)
        pw_match = False
        try:
            pw_match = bcrypt.verify(request.password, db_user.password_hash)
            if not pw_match and request.password.strip() != request.password:
                pw_match = bcrypt.verify(request.password.strip(), db_user.password_hash)
        except Exception:
            # If the stored hash is invalid (e.g., legacy plaintext), we DO NOT
            # migrate it automatically as it introduces a pass-the-hash vulnerability.
            pass

        if pw_match:
            # SUCCESS: Reset attempts and unlock
            try:
                db_user.failed_login_attempts = 0
                db_user.locked_until = None
                db.commit()
            except Exception as auth_db_err:
                print(f"[AUTH RESILIENCE] Non-fatal warning: Failed to reset attempt counters: {auth_db_err}")
                db.rollback()

            session_id = str(uuid.uuid4())
            register_user_session(db, db_user, session_id, http_request)
            invalidate_user_cache(db_user.username)

            # Security Log: AUTH_LOGIN_SUCCESS (OWASP A09)
            log_audit(
                db=db, action="AUTH_LOGIN_SUCCESS", table_name="auth",
                record_id=db_user.user_id, user=db_user,
                new_values={"status": "success", "username": db_user.username, "session_id": session_id[:8] + "..."},
                request=http_request, module="Authentication",
            )

            print(f"[AUTH] Granted: {db_user.username} authenticated (session: {session_id}).")
            access_token = create_access_token(data={"sub": db_user.username}, session_id=session_id)

            return {
                "user_id": db_user.user_id,
                "username": db_user.username,
                "role": db_user.role.role_name,
                "email": db_user.email,
                "access_token": access_token,
                "token_type": "bearer"
            }
        else:
            # FAILURE: Increment attempts (Admin account never locks out)
            if is_admin_account:
                db_user.failed_login_attempts = 0
                db_user.locked_until = None
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                print(f"[AUTH] Denied: Bad password for admin account '{request.username}'. Lockout bypassed (Admin account is immune).")
                log_audit(
                    db=db, action="LOGIN_FAILED", table_name="auth",
                    record_id=db_user.user_id, user=db_user,
                    new_values={"reason": "wrong_password", "failed_attempts": 0, "admin_immunity": True},
                    request=http_request, module="Authentication",
                )
                raise HTTPException(status_code=401, detail="Invalid username or password")

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
def logout(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    """
    Logout endpoint for session invalidation and audit trail logging.
    Revokes ONLY the current session (identified by session_id/sid),
    leaving other sessions belonging to the same account active.
    """
    token_sid = getattr(current_user, '_current_token_sid', None)
    if not token_sid and credentials and credentials.credentials:
        try:
            import jwt
            p = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            token_sid = p.get("sid")
        except Exception:
            pass

    if token_sid:
        revoke_user_session(db, current_user.username, session_id=token_sid)

    invalidate_user_cache(current_user.username)

    log_audit(
        db=db, action="AUTH_LOGOUT", table_name="auth",
        record_id=current_user.user_id, user=current_user,
        new_values={"status": "logged_out", "username": current_user.username, "session_id": (str(token_sid)[:8] + "...") if token_sid else ""},
        module="Authentication",
    )
    print(f"[AUTH] Logout recorded for: {current_user.username} (session: {token_sid})")
    return {"status": "success", "message": "Logout recorded"}

@app.get("/api/auth/verify-token")
@app.get("/api/me")
def verify_token(current_user: User = Depends(get_current_user)):
    """
    OWASP A07 / A01: Validates active JWT session with backend on startup.
    Ensures UI pages cannot be accessed by fabricated client storage without a valid server-recognized session.
    """
    return {
        "status": "valid",
        "user_id": current_user.user_id,
        "username": current_user.username,
        "role": current_user.role.role_name,
        "email": current_user.email
    }


# ==========================================
# 2.2 PASSWORD RECOVERY (Mailgun Integration)
# ==========================================

def _public_email_logo_url() -> str:
    """Gmail cannot fetch localhost images. Always embed the public site logo."""
    base = (os.environ.get("PUBLIC_APP_URL") or "https://shoelotskey-villamor-pasay.app").rstrip("/")
    return f"{base}/login.png"


def send_reset_email(user_email, reset_link):
    """Integrates with Mailgun API to send real emails."""
    api_key = os.environ.get('MAILGUN_API_KEY')
    domain = "www.shoelotskey-villamor-pasay.app" 
    
    if not api_key:
        print("[EMAIL ERROR] MAILGUN_API_KEY not found in environment.")
        return 500

    logo_url = _public_email_logo_url()

    url = f"https://api.mailgun.net/v3/{domain}/messages"
    
    payload = {
        "from": '"Shoelotskey Support" <postmaster@www.shoelotskey-villamor-pasay.app>',
        "to": [user_email],
        "subject": "Reset Your Shoelotskey Password",
        "html": f"""
            <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 500px; margin: 0 auto; background-color: white;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="{logo_url}" alt="Shoelotskey Logo" style="height: 100px; width: auto;" />
                </div>
                <h3 style="color: #e11d48; text-align: center; margin-top: 0;">Password Reset Request</h3>
                <p>We received a request to reset your password for your Shoelotskey account.</p>
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
        print(f"[EMAIL] Reset link sent to {user_email}. Status: {response.status_code} Logo: {logo_url}")
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

    frontend_base = frontend_base_for_reset_link(
        request.headers.get("host", "shoelotskey-villamor-pasay.herokuapp.com"),
        request.headers.get("origin", ""),
        request.headers.get("referer", ""),
    )
    reset_link = f"{frontend_base}/reset-password?token={token}"
    
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

@app.get("/api/verify-reset-token")
async def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """Check if a reset token is valid and active before displaying the password form."""
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Missing reset token.")
    user = db.query(User).filter(User.reset_token == token.strip()).first()
    if not user:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has already been used.")
    if user.reset_token_expiry and user.reset_token_expiry < datetime.utcnow():
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="This password reset link has expired. Please request a new one.")
    return {"valid": True, "username": user.username}

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

    # 3. Check if new password is identical to current password (OWASP A07 / NIST 800-63B)
    is_same_password = False
    try:
        is_same_password = bcrypt.verify(request.new_password, user.password_hash)
    except:
        if user.password_hash == request.new_password:
            is_same_password = True

    if is_same_password:
        print(f"[AUTH] Security: Rejected password reset for {user.username} (identical to current password).")
        raise HTTPException(status_code=400, detail="The new password must be different from the current password.")

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

_PREDICT_MEMO: Dict[str, Any] = {}

@app.post("/api/predict")
def get_prediction(
    order_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dual-result estimate: official Shoelotskey business-rule release date plus
    an independent Random Forest prediction. The official operational date is
    always the business-rule result. Authenticated staff only.
    """
    import json
    import time
    memo_key = None
    try:
        memo_key = json.dumps(order_data, sort_keys=True)
        cached = _PREDICT_MEMO.get(memo_key)
        if cached and (time.time() - cached["time"] < 20.0):
            return cached["response"]
    except Exception:
        pass

    try:
        estimate = predictor.estimate_order_release(db, order_data)
        official_dt = estimate["business_rule_date"]
        ml_dt = estimate.get("ml_predicted_date")
        ml_status = estimate.get("ml_status") or "unavailable"
        resp = {
            "authoritative": "business_rule",
            "business_rule_days": estimate["business_rule_days"],
            "business_rule_date": official_dt.strftime("%Y-%m-%d"),
            "ml_predicted_days": estimate.get("ml_predicted_days"),
            "ml_predicted_date": ml_dt.strftime("%Y-%m-%d") if ml_dt else None,
            "ml_model": estimate.get("ml_model") or "Random Forest Regression",
            "ml_status": ml_status,
            "ml_source": estimate.get("ml_source") or "random_forest",
            "ml_reason": estimate.get("ml_reason"),
            # Backward-compatible official fields used by the Job Order Form date input.
            "predicted_date": official_dt.isoformat(),
            "predicted_date_ymd": official_dt.strftime("%Y-%m-%d"),
            "predicted_days": int(estimate["business_rule_days"]),
            "status": "success",
            "engine": "Shoelotskey SPE v1.0",
            "source": "business_rule",
            "fallback_reason": estimate.get("ml_reason") if ml_status != "valid" else None,
            "model_loaded": bool(estimate.get("model_loaded")),
            "algorithm": "Shoelotskey Business Rules",
        }

        # ML System Logging (Phase 20)
        log_audit(
            db=db,
            action="ML_PREDICTION_COMPLETED",
            table_name="orders",
            user=current_user,
            new_values={
                "model_version": "1.2",
                "ml_status": ml_status,
                "ml_predicted_days": estimate.get("ml_predicted_days"),
                "business_rule_days": estimate.get("business_rule_days"),
                "total_pairs": len(order_data.get("items") or [1]),
                "status": "SUCCESS"
            },
            module="Machine Learning"
        )

        if memo_key:
            _PREDICT_MEMO[memo_key] = {"response": resp, "time": time.time()}
        return resp
    except Exception as e:
        import traceback
        print(f"[ML ERROR] Prediction exception: {e}")
        traceback.print_exc()
        return {
            "authoritative": "business_rule",
            "business_rule_days": 0,
            "business_rule_date": None,
            "ml_predicted_days": None,
            "ml_predicted_date": None,
            "ml_model": "Random Forest Regression",
            "ml_status": "unavailable",
            "ml_source": "random_forest",
            "ml_reason": "ML estimation pipeline temporarily unavailable",
            "predicted_date": None,
            "predicted_date_ymd": None,
            "predicted_days": None,
            "status": "error",
            "error": "ML estimation pipeline temporarily unavailable",
            "source": "error_fallback",
            "fallback_reason": "ML estimation pipeline temporarily unavailable",
            "model_loaded": False,
            "algorithm": "Shoelotskey Business Rules",
        }

@app.get("/api/ml/status")
def ml_status(current_user: User = Depends(get_current_user)):
    """P0-4/P1-13: Honest model-availability status for the Job Order ML prediction engine."""
    return predictor.get_status()

@app.post("/api/ml/train")
def train_model(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Triggers retraining of the ML model based on history (Owner only)."""
    result = predictor.train_from_history(db)
    if result.get("status") == "success":
        log_audit(
            db=db, action="ML_TRAIN", table_name="ml_engine",
            user=current_user,
            new_values={
                "status": "success", "retrained_by": current_user.username,
                "dataset_size": result.get("dataset_size"), "mae": result.get("mae"), "r2_score": result.get("r2_score"),
            },
            module="Machine Learning",
        )
        return {"message": "Model retrained successfully", **result}
    else:
        return {"message": "Retraining skipped - insufficient historical data", **result}

# ==========================================
# 2.5 USER MANAGEMENT
# ==========================================

@app.get("/api/users", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Fetch all users (Owner only - OWASP A01). Supports seamless offline SQLite failover."""
    try:
        users = db.query(User).options(joinedload(User.role)).order_by(User.created_at.desc()).all()
    except Exception as e:
        import db.database as db_mod
        # P0-5: No SQLite failover in Production — fail safely instead.
        if db_mod.IS_PRODUCTION_ENV:
            print(f"[USER MGT] Query failed against PostgreSQL in Production ({e}). Rejecting (P0-5).")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable. Please try again shortly.")
        print(f"[USER MGT OFFLINE RESILIENCE] Query failed ({e}). Auto-switching to SQLite...")
        db.close()
        fallback_maker = db_mod.switch_to_offline_sqlite()
        db = fallback_maker()
        users = db.query(User).options(joinedload(User.role)).order_by(User.created_at.desc()).all()
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
    assert_assignable_role(current_user, user_data.role_name)

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
    persist_user_to_sqlite_file(
        new_user.username, new_user.email, new_user.password_hash,
        user_data.role_name, bool(new_user.is_active),
    )
    checkpoint_sqlite()
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
        
    if db_user.username.lower() == "admin" or (db_user.role and db_user.role.role_name.lower() == "admin"):
        raise HTTPException(status_code=403, detail="System account cannot be modified.")
        
    # Capture before-state for audit diff (include role so Activity History can show role changes)
    old_snapshot = {
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role.role_name if db_user.role else None,
        "is_active": db_user.is_active,
    }
    password_changed = False

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
        is_same_password = False
        try:
            is_same_password = bcrypt.verify(user_update.password, db_user.password_hash)
        except:
            if db_user.password_hash == user_update.password:
                is_same_password = True
        if is_same_password:
            raise HTTPException(status_code=400, detail="The new password must be different from the current password.")
        db_user.password_hash = bcrypt.hash(user_update.password)
        password_changed = True
        
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
        assert_assignable_role(current_user, user_update.role_name)
        db_user.role_id = db_role.role_id
        
    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active

    db.commit()
    db.refresh(db_user)
    from auth_utils import invalidate_user_cache
    invalidate_user_cache(db_user.username)
    persist_user_to_sqlite_file(
        db_user.username, db_user.email, db_user.password_hash,
        db_user.role.role_name if db_user.role else "staff",
        bool(db_user.is_active),
    )
    checkpoint_sqlite()
    new_user_snapshot = {
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role.role_name if db_user.role else None,
        "is_active": db_user.is_active,
        "password_changed": password_changed,
    }
    log_audit(
        db=db, action="UPDATE", table_name="users",
        record_id=user_id, user=current_user,
        old_values=old_snapshot,
        new_values=new_user_snapshot,
        module="User Management",
    )
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Remove user access (Owner only). Deactivates account if historical transactions exist to preserve referential integrity."""
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.username.lower() in ["admin", "owner", "front_staff", "staff"] or (db_user.role and db_user.role.role_name.lower() == "admin"):
        raise HTTPException(status_code=403, detail="System and protected operational accounts (admin, owner, front_staff, staff) cannot be deleted.")
        
    # Prevent deleting the last owner
    if db_user.role.role_name == 'owner':
        owner_count = db.query(User).join(Role).filter(Role.role_name == 'owner').count()
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last owner account")

    # [PRIORITY 1 FIX] Prevent Foreign Key constraint violations and preserve audit trail integrity:
    # If the user has any transaction history (Orders, Expenses, Status Logs, Inventory Logs), deactivate instead of hard-deleting.
    has_history = (
        db.query(Order.order_id).filter(Order.user_id == user_id).first() or
        db.query(Expense.expense_id).filter(Expense.user_id == user_id).first() or
        db.query(StatusLog.status_log_id).filter(StatusLog.user_id == user_id).first() or
        db.query(InventoryLog.log_id).filter(InventoryLog.user_id == user_id).first()
    )
    if has_history:
        db_user.is_active = False
        db.commit()
        from auth_utils import invalidate_user_cache
        invalidate_user_cache(db_user.username)
        persist_user_to_sqlite_file(
            db_user.username, db_user.email, db_user.password_hash,
            db_user.role.role_name if db_user.role else "staff",
            False,
        )
        checkpoint_sqlite()
        log_audit(
            db=db, action="DEACTIVATE", table_name="users",
            record_id=user_id, user=current_user,
            old_values={
                "username": db_user.username,
                "email": db_user.email,
                "role": db_user.role.role_name if db_user.role else None,
                "is_active": True,
            },
            new_values={
                "username": db_user.username,
                "email": db_user.email,
                "role": db_user.role.role_name if db_user.role else None,
                "is_active": False,
                "soft_delete": True,
                "reason": "Deactivated instead of hard deletion due to historical transactions",
            },
            module="User Management",
        )
        return {"status": "success", "message": f"User {user_id} has historical transactions and was deactivated instead of deleted."}

    # Capture before-state for audit trail (after deletion the record is gone)
    deleted_snapshot = {
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role.role_name if db_user.role else None,
        "is_active": db_user.is_active,
    }
    db.delete(db_user)
    db.commit()
    from auth_utils import invalidate_user_cache
    invalidate_user_cache(deleted_snapshot["username"])
    checkpoint_sqlite()
    log_audit(
        db=db, action="DELETE", table_name="users",
        record_id=user_id, user=current_user,
        old_values=deleted_snapshot,
        new_values={"username": deleted_snapshot["username"]},
        module="User Management",
    )
    return {"status": "success", "message": f"User {user_id} deleted"}

@app.post("/api/users/{user_id}/unlock")
def unlock_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Unlock a locked user account and reset failed login attempts (Owner, Expert Owner, and Admin only)."""
    allowed_roles = ['owner', 'admin']
    allowed_usernames = ['admin', 'owner', 'expert_owner']
    user_role = (current_user.role.role_name if current_user.role else '').lower()
    user_name = (current_user.username or '').lower()
    if user_role not in allowed_roles and user_name not in allowed_usernames:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Owner, Expert Owner, and Admin can unlock accounts.")

    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    old_attempts = db_user.failed_login_attempts or 0
    was_locked = bool(db_user.locked_until and db_user.locked_until > datetime.utcnow())

    db_user.failed_login_attempts = 0
    db_user.locked_until = None
    db.commit()
    db.refresh(db_user)

    from auth_utils import invalidate_user_cache
    invalidate_user_cache(db_user.username)

    # Sync to local SQLite if file exists
    try:
        import sqlite3
        conn = sqlite3.connect("backend/db/shoelotskey.db")
        conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ? OR username = ?", (user_id, db_user.username))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[UNLOCK USER] SQLite sync warning: {e}")

    log_audit(
        db=db, action="UNLOCK", table_name="users",
        record_id=user_id, user=current_user,
        old_values={"failed_attempts": old_attempts, "locked": was_locked},
        new_values={"failed_attempts": 0, "locked": False, "username": db_user.username},
        module="User Management",
    )
    return {
        "status": "success",
        "message": f"Account '{db_user.username}' unlocked successfully. Login attempts reset to 0.",
        "user_id": db_user.user_id,
        "username": db_user.username
    }

@app.post("/api/users/{user_id}/lock")
def lock_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually lock a user account (Owner, Expert Owner, and Admin only)."""
    allowed_roles = ['owner', 'admin']
    allowed_usernames = ['admin', 'owner', 'expert_owner']
    user_role = (current_user.role.role_name if current_user.role else '').lower()
    user_name = (current_user.username or '').lower()
    if user_role not in allowed_roles and user_name not in allowed_usernames:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Owner, Expert Owner, and Admin can lock accounts.")

    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_role = (db_user.role.role_name if db_user.role else '').lower()
    target_name = (db_user.username or '').lower()
    if target_name == 'admin' or target_role == 'admin':
        raise HTTPException(status_code=400, detail="System administrator account cannot be locked.")

    db_user.failed_login_attempts = 3
    db_user.locked_until = datetime(2099, 12, 31, 23, 59, 59)
    db_user.active_session_id = None
    db.commit()
    db.refresh(db_user)

    from auth_utils import invalidate_user_cache, revoke_user_session
    invalidate_user_cache(db_user.username)
    revoke_user_session(db, db_user.username, session_id=None)

    try:
        import sqlite3
        conn = sqlite3.connect("backend/db/shoelotskey.db")
        conn.execute("UPDATE users SET failed_login_attempts = 3, locked_until = '2099-12-31 23:59:59', active_session_id = NULL WHERE user_id = ? OR username = ?", (user_id, db_user.username))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[LOCK USER] SQLite sync warning: {e}")

    log_audit(
        db=db, action="LOCK", table_name="users",
        record_id=user_id, user=current_user,
        old_values={"locked": False},
        new_values={"locked": True, "restriction_type": "administrative", "username": db_user.username},
        module="User Management",
    )
    return {
        "status": "success",
        "message": f"Account '{db_user.username}' has been restricted and locked until unlocked by an administrator.",
        "user_id": db_user.user_id,
        "username": db_user.username
    }

# ==========================================
# 3. JOB ORDERS (Complex 3NF Normalization)
# ==========================================

@app.get("/api/orders", response_model=List[OrderSchema])
def read_orders(
    request: Request,
    test_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all orders with full 3NF hydration (Auth Required)."""
    t0 = time.perf_counter()
    print("[QUERY] Fetching Order history...")
    orders = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.status),
        joinedload(Order.priority),
        joinedload(Order.processor).joinedload(User.role),
        joinedload(Order.status_logs).joinedload(StatusLog.status),
        joinedload(Order.status_logs).joinedload(StatusLog.user).joinedload(User.role),
        joinedload(Order.payments).joinedload(Payment.method),
        joinedload(Order.payments).joinedload(Payment.p_status),
        joinedload(Order.delivery).joinedload(Delivery.preference),
        joinedload(Order.items).joinedload(Item.services).joinedload(Service.category),
        joinedload(Order.items).joinedload(Item.conditions),
    ).order_by(Order.created_at.desc()).all()

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Objective 1 Logging: Measure digital retrieval duration
    tid = test_id or request.headers.get("X-Test-Id") or f"O1-RET-{int(time.time()*1000)%100000:05d}"
    log_audit(
        db=db,
        action="JOB_ORDER_RETRIEVED",
        table_name="orders",
        user=current_user,
        new_values={
            "test_id": tid,
            "order_reference": "All Orders",
            "duration_ms": round(elapsed_ms, 2),
            "result_count": len(orders),
            "status": "SUCCESS"
        },
        module="Job Orders"
    )

    return orders

@app.get("/api/orders/search")
def search_orders(
    request: Request,
    q: Optional[str] = None,
    status_filter: Optional[str] = "active",
    limit: int = 150,
    test_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Searchable and filterable job orders endpoint for Combobox selectors.
    Supports partial matching by Order Number, Customer Name, and status filters.
    """
    t0 = time.perf_counter()
    query = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.status)
    ).join(Order.customer).join(Order.status)

    sf = (status_filter or "active").lower().strip()
    if sf in ("active", "active orders", "active_orders"):
        query = query.filter(
            func.lower(Status.status_name).in_([
                "new order", "new-order", "new",
                "on-going", "ongoing", "in progress",
                "for release", "for-release", "ready"
            ])
        )
    elif sf in ("new order", "new-order", "new_order"):
        query = query.filter(func.lower(Status.status_name).in_(["new order", "new-order", "new"]))
    elif sf in ("on-going", "ongoing", "on_going", "in progress"):
        query = query.filter(func.lower(Status.status_name).in_(["on-going", "ongoing", "in progress"]))
    elif sf in ("for release", "for-release", "for_release", "ready"):
        query = query.filter(func.lower(Status.status_name).in_(["for release", "for-release", "ready"]))
    elif sf in ("claimed", "completed"):
        query = query.filter(func.lower(Status.status_name).in_(["claimed", "completed"]))
    # "all" or "all orders" applies no status filter

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Order.order_number).like(term),
                func.lower(Customer.customer_name).like(term)
            )
        )

    results = query.order_by(Order.created_at.desc()).limit(limit).all()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Objective 1 Logging: Measure digital retrieval duration for search queries
    tid = test_id or request.headers.get("X-Test-Id") or f"O1-RET-{int(time.time()*1000)%100000:05d}"
    log_audit(
        db=db,
        action="JOB_ORDER_RETRIEVED",
        table_name="orders",
        user=current_user,
        new_values={
            "test_id": tid,
            "order_reference": q or f"Status: {status_filter}",
            "duration_ms": round(elapsed_ms, 2),
            "result_count": len(results),
            "status": "SUCCESS"
        },
        module="Job Orders"
    )

    return [
        {
            "id": o.order_id,
            "orderNumber": o.order_number,
            "customerName": o.customer.customer_name if o.customer else "Unknown",
            "status": o.status.status_name if o.status else "New Order",
            "createdAt": o.created_at.isoformat() if o.created_at else None
        }
        for o in results
    ]

@app.get("/api/orders/track/{tracking_number}")
@app.get("/orders/track/{tracking_number}")
def track_order_public(
    tracking_number: str,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Public Order Tracking Endpoint for Customer QR Scanning.
    No authentication required.
    Allows customers to track the status, progress, target release date, and balance
    of their footwear in real-time.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    tn = tracking_number.strip()
    if tn.startswith("#"):
        tn = tn[1:]
    
    # Query order by order_number or numeric order_id
    query = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.status),
        joinedload(Order.priority),
        joinedload(Order.status_logs).joinedload(StatusLog.status),
        joinedload(Order.payments).joinedload(Payment.method),
        joinedload(Order.payments).joinedload(Payment.p_status),
        joinedload(Order.delivery).joinedload(Delivery.preference),
        joinedload(Order.items).joinedload(Item.services).joinedload(Service.category),
        joinedload(Order.items).joinedload(Item.conditions),
    )
    
    order = query.filter(func.lower(Order.order_number) == tn.lower()).first()
    if not order and tn.isdigit():
        order = query.filter(Order.order_id == int(tn)).first()
        
    if not order:
        raise HTTPException(status_code=404, detail="Order not found. Please verify your tracking number.")
    
    # Calculate payment balance
    grand_total = float(order.grand_total or 0)
    paid_sum = 0.0
    for p in (order.payments or []):
        st = (p.p_status.status_name.lower()) if (p.p_status and getattr(p.p_status, 'status_name', None)) else ""
        if "paid" in st or "complete" in st:
            paid_sum += float(p.amount_received or 0)
        elif float(p.deposit_amount or 0) > 0:
            paid_sum += float(p.deposit_amount or 0)
            
    is_claimed = (order.status.status_name.lower() == "claimed") if order.status else False
    if is_claimed or paid_sum >= grand_total:
        balance_due = 0.0
        payment_status = "Fully Paid"
    elif paid_sum > 0:
        balance_due = max(0.0, grand_total - paid_sum)
        payment_status = "Partial (Downpayment Paid)"
    else:
        balance_due = grand_total
        payment_status = "Unpaid"
        
    # Customer name: provide first name and last initial for customer privacy
    raw_name = order.customer.customer_name if order.customer else "Valued Customer"
    parts = raw_name.split()
    if len(parts) >= 2:
        masked_name = f"{parts[0]} {parts[-1][0]}."
    else:
        masked_name = raw_name

    # Build items list
    items_data = []
    for it in (order.items or []):
        services_list = [s.service_name for s in (it.services or [])]
        conds = [c.condition_name for c in (it.conditions or [])]
        items_data.append({
            "id": it.item_id,
            "brand": it.brand or "Footwear",
            "shoeModel": it.shoe_model or "",
            "material": it.material or "",
            "color": it.color or "",
            "shoeSize": it.shoe_size or "",
            "quantity": it.quantity or 1,
            "status": it.status or (order.status.status_name if order.status else "In Service"),
            "services": services_list,
            "conditions": conds,
            "notes": it.item_notes or ""
        })

    # Timeline logs
    timeline = []
    for log in (order.status_logs or []):
        st_name = log.status.status_name if log.status else "Updated"
        timeline.append({
            "status": st_name,
            "timestamp": log.changed_at.isoformat() if log.changed_at else None
        })
    timeline.sort(key=lambda x: x["timestamp"] or "")

    status_map = {
        "new-order": "New Order",
        "on-going": "On-Going",
        "for-release": "For Release",
        "claimed": "Claimed",
        "pending": "New Order",
        "ongoing": "On-Going",
        "in-progress": "On-Going",
        "in progress": "On-Going",
        "ready": "For Release",
        "ready for release": "For Release",
        "completed": "For Release",
        "cancelled": "Cancelled",
        "canceled": "Cancelled"
    }
    raw_st = (order.status.status_name if order.status else "new-order").strip().lower()
    pretty_status = status_map.get(raw_st, raw_st.replace("-", " ").title())

    last_log_time = order.status_logs[-1].changed_at if (order.status_logs and len(order.status_logs) > 0) else order.created_at

    return {
        "orderNumber": order.order_number,
        "customerName": masked_name,
        "status": pretty_status,
        "priority": order.priority.priority_name if order.priority else "Regular",
        "createdAt": order.created_at.isoformat() if order.created_at else None,
        "updatedAt": last_log_time.isoformat() if last_log_time else None,
        "targetDate": (order.expected_at or order.predicted_at).isoformat() if (order.expected_at or order.predicted_at) else None,
        "claimedAt": order.claimed_at.isoformat() if order.claimed_at else None,
        "releasedAt": order.released_at.isoformat() if order.released_at else None,
        "fulfillment": order.delivery.preference.pref_name if (order.delivery and order.delivery.preference) else "Store Pickup",
        "grandTotal": grand_total,
        "amountPaid": paid_sum,
        "balanceDue": balance_due,
        "paymentStatus": payment_status,
        "items": items_data,
        "timeline": timeline
    }

import threading
_ORDER_CONCURRENCY_LOCK = threading.Lock()
_RESERVED_ORDER_NUMBERS: set = set()

def clean_shoe_field(val: Any) -> str:
    if not val:
        return ""
    s = str(val).strip()
    if s.lower() in ["unknown", "other", "others", "none", "n/a", "na", "other (specify)", "footwear"]:
        return ""
    return s


def _live_canonical_order_number(db: Session, created_dt: datetime) -> str:
    """Same ORD-YYYY-MM-DD-NNN rule as JobOrderForm when the client omits orderNumber."""
    from order_numbering import generate_canonical_order_id
    return generate_canonical_order_id(db, created_dt, reserved=_RESERVED_ORDER_NUMBERS)


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
    
    # [IDEMPOTENCY & CONCURRENCY FIX]
    order_num = order_data.get("orderNumber")
    if order_num:
        existing_order = db.query(Order).filter(Order.order_number == order_num).first()
        if existing_order:
            # Only treat as idempotent replay if customer name and grand_total match
            raw_cname = str(order_data.get("customerName", "") or "").strip().lower()
            ex_cname = str(existing_order.customer.customer_name if existing_order.customer else "").strip().lower()
            ex_gt = float(existing_order.grand_total or 0.0)
            req_gt = float(order_data.get("grandTotal", 0.0) or 0.0)
            if raw_cname and raw_cname == ex_cname and abs(ex_gt - req_gt) < 0.01:
                print(f"[TRANS] NOTICE: Order {order_num} already exists and matches payload. Returning existing record to satisfy sync queue.")
                return existing_order
            else:
                # Collision with another concurrent order: reallocate fresh canonical order number
                print(f"[CONCURRENCY] Order number collision detected for '{order_num}'. Allocating fresh canonical order number.")
                order_num = None

    final_order_num = None
    try:
        # Step 1: Customer Normalization (soft unique lookup; DB unique deferred while duplicates remain)
        raw_customer_name = str(order_data.get("customerName", "Guest") or "Guest").strip()
        from order_numbering import validate_customer_name, normalize_customer_name
        is_valid, err_msg, customer_name = validate_customer_name(raw_customer_name)
        if not is_valid:
            raise HTTPException(status_code=400, detail=err_msg)
        contact = str(order_data.get("contactNumber", "0000000000") or "0000000000").strip()
        db_customer = db.query(Customer).filter(
            func.lower(func.trim(Customer.customer_name)) == customer_name.lower(),
            func.trim(Customer.contact_number) == contact,
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
            "cancelled": "cancelled", "canceled": "cancelled",
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

        # Official release date is always the Shoelotskey business-rule date.
        # Random Forest ML estimate is persisted to predicted_at and predicted_days.
        est = predictor.estimate_order_release(db, order_data)
        expected_iso = order_data.get("predictedCompletionDate")
        ml_auto_predicted = bool(order_data.get("mlAutoPredicted"))
        if expected_iso and not ml_auto_predicted:
            expected_dt = parse_local_date(expected_iso)
        else:
            expected_dt = est["business_rule_date"]

        # ML predicted date & days to persist in DB
        pred_dt = None
        raw_pred_at = order_data.get("predicted_at") or order_data.get("ml_predicted_date") or order_data.get("predictedAt")
        if raw_pred_at:
            pred_dt = parse_local_date(raw_pred_at)
        elif est.get("ml_predicted_date"):
            pred_dt = est["ml_predicted_date"]

        pred_days = None
        raw_pred_days = (
            order_data.get("predicted_days")
            if order_data.get("predicted_days") is not None
            else (
                order_data.get("ml_predicted_days")
                if order_data.get("ml_predicted_days") is not None
                else order_data.get("predictedDays")
            )
        )
        if raw_pred_days is not None:
            try:
                pred_days = int(raw_pred_days)
            except (ValueError, TypeError):
                pred_days = None
        elif est.get("ml_predicted_days") is not None:
            try:
                pred_days = int(est["ml_predicted_days"])
            except (ValueError, TypeError):
                pred_days = None

        t_date = order_data.get("transactionDate") or order_data.get("createdAt")
        ord_date = order_data.get("orderDate")
        ord_time = order_data.get("orderTime")
        created_dt = resolve_activity_datetime(
            raw_timestamp=t_date,
            order_number=order_num,
            order_date=ord_date,
            order_time=ord_time
        )

        with _ORDER_CONCURRENCY_LOCK:
            if not order_num or order_num in _RESERVED_ORDER_NUMBERS or db.query(Order).filter(Order.order_number == order_num).first():
                final_order_num = _live_canonical_order_number(db, created_dt)
            else:
                final_order_num = order_num
            _RESERVED_ORDER_NUMBERS.add(final_order_num)

        claimed_dt = None
        released_dt = None
        if mapped_status == "claimed" or order_data.get("claimedAt"):
            claimed_dt = parse_local_date(order_data.get("claimedAt")) if order_data.get("claimedAt") else expected_dt
            released_dt = parse_local_date(order_data.get("releasedAt")) if order_data.get("releasedAt") else expected_dt
        elif mapped_status == "for-release" or order_data.get("releasedAt"):
            released_dt = parse_local_date(order_data.get("releasedAt")) if order_data.get("releasedAt") else expected_dt

        db_order = Order(
            order_number=final_order_num,
            customer_id=db_customer.customer_id,
            status_id=db_status.status_id,
            priority_id=db_prio.priority_id,
            grand_total=order_data.get("grandTotal", 0.0),
            expected_at=expected_dt,
            predicted_at=pred_dt,
            predicted_days=pred_days,
            claimed_at=claimed_dt,
            released_at=released_dt,
            created_at=created_dt,
            updated_at=created_dt,
            user_id=current_user.user_id  # Use authenticated user's ID
        )
        db.add(db_order)
        db.flush()

        # Initial status log entry
        db.add(StatusLog(order_id=db_order.order_id, status_id=db_status.status_id, user_id=current_user.user_id, changed_at=created_dt))
        if mapped_status == "claimed" and claimed_dt and claimed_dt != created_dt:
            db.add(StatusLog(order_id=db_order.order_id, status_id=db_status.status_id, user_id=current_user.user_id, changed_at=claimed_dt))

        # Payment Normalization
        # DB stores lowercase: 'cash', 'gcash', 'maya', 'bank-transfer'
        ref_raw = str(order_data.get("referenceNo") or "").strip()
        ref_clean = re.sub(r'[^a-zA-Z0-9]', '', ref_raw)
        m_name = str(order_data.get("paymentMethod", "")).lower().strip()
        if "maya" in m_name or len(ref_clean) == 12 or ref_raw.lower().startswith(("may", "my")):
            m_name = "maya"
        elif "gcash" in m_name or len(re.sub(r'\D', '', ref_raw)) == 13 or ref_raw.lower().startswith("gc"):
            m_name = "gcash"
        elif m_name not in ["cash", "gcash", "maya", "bank-transfer"]:
            m_name = "cash"
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
            deposit_amount=order_data.get("depositAmount", 0.0),
            created_at=created_dt
        )
        db_payment.method = db_method
        db_payment.p_status = db_p_status
        db.add(db_payment)
        db_order.payments = [db_payment]

        if mapped_status == "claimed" and ps_name == "downpayment":
            db_paid_status = db.query(PaymentStatus).filter(PaymentStatus.status_name == "fully-paid").first() or db_p_status
            db_cash_method = db.query(PaymentMethod).filter(PaymentMethod.method_name == "cash").first() or db_method
            dp_val = float(order_data.get("depositAmount", 0.0) or 0.0)
            gt_val = float(order_data.get("grandTotal", 0.0) or 0.0)
            settle_amt = max(0.0, gt_val - dp_val)
            if settle_amt > 0:
                settle_payment = Payment(
                    order_id=db_order.order_id,
                    method_id=db_cash_method.method_id,
                    status_id=db_paid_status.p_status_id,
                    amount_received=settle_amt,
                    balance=0.0,
                    reference_no=None,
                    deposit_amount=0.0,
                    created_at=claimed_dt or created_dt
                )
                settle_payment.method = db_cash_method
                settle_payment.p_status = db_paid_status
                db.add(settle_payment)
                db_order.payments = [db_payment, settle_payment]
        
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
                "shoeSize": order_data.get("shoeSize") or order_data.get("size"),
                "color": order_data.get("color"),
                "quantity": order_data.get("quantity", 1),
                "condition": order_data.get("condition", {}),
                "baseService": order_data.get("baseService", []),
                "addOns": order_data.get("addOns", []),
                "inventoryUsed": order_data.get("inventoryUsed", [])
            }]

        conflict = color_count_conflict_message(items_list)
        if conflict:
            raise HTTPException(status_code=400, detail=conflict)

        for item_data in items_list:
            item_color = item_data.get("color") or order_data.get("color") or ""
            if isinstance(item_color, list):
                item_color = ", ".join(str(c).strip() for c in item_color if str(c).strip())
            db_item = Item(
                order_id=db_order.order_id, 
                brand=clean_shoe_field(item_data.get("brand") or order_data.get("brand") or ""), 
                shoe_model=clean_shoe_field(item_data.get("shoeModel") or order_data.get("shoeModel") or ""),
                material=clean_shoe_field(item_data.get("shoeMaterial") or order_data.get("shoeMaterial") or ""),
                shoe_size=str(item_data.get("shoeSize") or item_data.get("size") or order_data.get("shoeSize") or order_data.get("size") or ""),
                color=clean_shoe_field(item_color or ""),
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
                        inv_item = lock_inventory_row(db, inv_id)
                        if inv_item:
                            available_stock = float(inv_item.stock_quantity or 0)
                            if (available_stock - inv_amount) < 0:
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Insufficient stock for '{inv_item.item_name}'. Available: {available_stock:.2f}, Required: {inv_amount:.2f}"
                                )
                            print(f"[INVENTORY] Deducting {inv_amount} {inv_item.unit} of '{inv_item.item_name}' for Order {db_order.order_number}")
                            inv_item.stock_quantity = max(0.0, available_stock - inv_amount)
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
            base_s = item_data.get("baseService") or []
            if isinstance(base_s, list): services_applied.extend(base_s)
            
            ads = item_data.get("addOns") or []
            for ad in ads: 
                if isinstance(ad, dict): services_applied.append(ad.get("name"))
                else: services_applied.append(ad)

            for s_name in list(set(services_applied)):
                if not s_name: continue
                service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                if service_obj:
                    pricing = ItemServiceMapping(item_id=db_item.item_id, service_id=service_obj.service_id, actual_price=service_obj.base_price)
                    db.add(pricing)

        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Job Order {db_order.order_number} verified with {len(db_order.items)} items.")

        # Objective 1: Digital Job Order Entry Duration Empirical Logging
        # TRANSACTION ISOLATION: Recorded in a dedicated separate SessionLocal session so
        # research logging failure can NEVER roll back or corrupt an authoritative business transaction.
        research_db = None
        try:
            raw_entry_start = order_data.get("entry_started_at") or order_data.get("form_started_at")
            started_at = None
            if raw_entry_start:
                started_at = parse_local_date(raw_entry_start)
            elif order_data.get("formDurationSeconds"):
                dur_s = float(order_data.get("formDurationSeconds"))
                started_at = datetime.now() - timedelta(seconds=dur_s)

            if started_at:
                saved_at = datetime.now()
                dur_ms = max(1.0, (saved_at - started_at).total_seconds() * 1000.0)
                test_run_id = order_data.get("test_run_id") or order_data.get("test_id")
                entry_meas = ResearchMeasurement(
                    test_run_id=int(test_run_id) if str(test_run_id or "").isdigit() else None,
                    objective="Objective 1",
                    measurement_type="JOB_ORDER_CREATED",
                    reference_id=db_order.order_number,
                    started_at=started_at,
                    completed_at=saved_at,
                    duration_ms=dur_ms,
                    status="SUCCESS",
                    value_numeric=dur_ms,
                    value_text=f"{dur_ms / 1000.0:.2f}s",
                    metadata_json={
                        "order_id": db_order.order_id,
                        "order_number": db_order.order_number,
                        "customer_name": order_data.get("customerName"),
                        "items_count": len(db_order.items or []),
                        "user_id": current_user.user_id if current_user else None,
                        "username": current_user.username if current_user else "staff",
                    }
                )
                research_db = SessionLocal()
                research_db.add(entry_meas)
                research_db.commit()
        except Exception as res_err:
            if research_db:
                research_db.rollback()
            print(f"[RESEARCH LOGGING WARNING] Could not persist JOB_ORDER_CREATED measurement: {res_err}")
        finally:
            if research_db:
                research_db.close()

        create_snapshot = build_order_snapshot(db_order)
        create_snapshot["order_number"] = db_order.order_number
        create_snapshot["customer_name"] = order_data.get("customerName") or create_snapshot.get("customerName")
        create_snapshot["items_count"] = len(db_order.items or [])
        create_snapshot["shoes_count"] = len(db_order.items or [])
        disc_val = float(order_data.get("discountAmount") or order_data.get("discount") or 0.0)
        if disc_val > 0:
            create_snapshot["discount"] = disc_val
        if order_data.get("formDurationFormatted") or order_data.get("formDurationSeconds"):
            dur_fmt = order_data.get("formDurationFormatted") or f"{order_data.get('formDurationSeconds')}s"
            create_snapshot["encoding_time"] = dur_fmt
            create_snapshot["efficiency_vs_paper"] = order_data.get("efficiencyMetric") or f"{dur_fmt} (Paper manual baseline: ~5–10 mins)"
        if ord_date:
            create_snapshot["order_date"] = ord_date
        if ord_time:
            create_snapshot["order_time"] = ord_time
        dur_note = f" [Creation Time: {create_snapshot['encoding_time']}]" if "encoding_time" in create_snapshot else ""
        create_snapshot["details"] = f"Created new Job Order #{db_order.order_number} for {create_snapshot['customer_name']}{dur_note}"
        log_audit(
            db=db, action="CREATE", table_name="orders",
            record_id=db_order.order_id, user=current_user,
            new_values=create_snapshot,
            module="Job Orders",
            created_at=created_dt
        )
        return db_order
        
    except HTTPException as he:
        db.rollback()
        # Record failed research entry in an isolated session if entry_started_at was provided
        fail_db = None
        try:
            raw_entry_start = order_data.get("entry_started_at") or order_data.get("form_started_at")
            if raw_entry_start:
                started_at = parse_local_date(raw_entry_start)
                failed_at = datetime.now()
                dur_ms = max(1.0, (failed_at - started_at).total_seconds() * 1000.0)
                test_run_id = order_data.get("test_run_id") or order_data.get("test_id")
                fail_meas = ResearchMeasurement(
                    test_run_id=int(test_run_id) if str(test_run_id or "").isdigit() else None,
                    objective="Objective 1",
                    measurement_type="JOB_ORDER_CREATED",
                    reference_id=final_order_num or "FAILED_ATTEMPT",
                    started_at=started_at,
                    completed_at=failed_at,
                    duration_ms=dur_ms,
                    status="FAILED",
                    value_numeric=dur_ms,
                    value_text="FAILED",
                    metadata_json={"error_detail": getattr(he, "detail", str(he))}
                )
                fail_db = SessionLocal()
                fail_db.add(fail_meas)
                fail_db.commit()
        except Exception:
            if fail_db:
                fail_db.rollback()
        finally:
            if fail_db:
                fail_db.close()
        raise
    except Exception as e:
        print(f"[TRANS ERROR] {e}")
        db.rollback()
        fail_db = None
        try:
            raw_entry_start = order_data.get("entry_started_at") or order_data.get("form_started_at")
            if raw_entry_start:
                started_at = parse_local_date(raw_entry_start)
                failed_at = datetime.now()
                dur_ms = max(1.0, (failed_at - started_at).total_seconds() * 1000.0)
                test_run_id = order_data.get("test_run_id") or order_data.get("test_id")
                fail_meas = ResearchMeasurement(
                    test_run_id=int(test_run_id) if str(test_run_id or "").isdigit() else None,
                    objective="Objective 1",
                    measurement_type="JOB_ORDER_CREATED",
                    reference_id=final_order_num or "FAILED_ATTEMPT",
                    started_at=started_at,
                    completed_at=failed_at,
                    duration_ms=dur_ms,
                    status="FAILED",
                    value_numeric=dur_ms,
                    value_text="FAILED",
                    metadata_json={"error_detail": str(e)}
                )
                fail_db = SessionLocal()
                fail_db.add(fail_meas)
                fail_db.commit()
        except Exception:
            if fail_db:
                fail_db.rollback()
        finally:
            if fail_db:
                fail_db.close()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if final_order_num:
            _RESERVED_ORDER_NUMBERS.discard(final_order_num)


def _item_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(part).strip() for part in value if str(part).strip())
    return str(value).strip()


def _keep_item_text(existing, incoming) -> str:
    """Never blank an existing size/color with an empty edit/sync payload."""
    incoming_text = _item_text(incoming)
    existing_text = _item_text(existing)
    return incoming_text if incoming_text else existing_text


def build_order_snapshot(db_order) -> dict:
    """Serializes the complete business object for audit logging (snapshot)."""
    if not db_order: return {}
    snapshot = {
        "orderNumber": db_order.order_number,
        "status": db_order.status.status_name if getattr(db_order, "status", None) else "new-order",
        "priorityLevel": db_order.priority.priority_name if getattr(db_order, "priority", None) else "normal",
        "grandTotal": float(db_order.grand_total) if getattr(db_order, "grand_total", None) else 0.0,
        "transactionDate": db_order.created_at.isoformat() if getattr(db_order, "created_at", None) else None,
        "predictedCompletionDate": db_order.expected_at.isoformat() if getattr(db_order, "expected_at", None) else None,
        "inventoryApplied": getattr(db_order, "inventory_applied", False),
        "inventoryUsed": getattr(db_order, "inventory_used", []),
        "cancellationStage": getattr(db_order, "cancellation_stage", None),
        "cancellationReason": getattr(db_order, "cancellation_reason", None),
        "refundStatus": getattr(db_order, "refund_status", None),
        "refundAmount": float(db_order.refund_amount) if getattr(db_order, "refund_amount", None) is not None else 0.0,
        "refundReason": getattr(db_order, "refund_reason", None),
        "cancelledAt": db_order.cancelled_at.isoformat() if getattr(db_order, "cancelled_at", None) else None,
        "preCancellationState": getattr(db_order, "pre_cancellation_state", None),
    }
    if getattr(db_order, "customer", None):
        snapshot["customerName"] = db_order.customer.customer_name
        snapshot["contactNumber"] = db_order.customer.contact_number
    if getattr(db_order, "payments", None) and len(db_order.payments) > 0:
        pay = db_order.payments[0]
        m_obj = getattr(pay, "method", None)
        ps_obj = getattr(pay, "p_status", None) or getattr(pay, "status", None)
        snapshot["paymentMethod"] = (m_obj.method_name if m_obj else None) or "cash"
        snapshot["paymentStatus"] = (ps_obj.status_name if ps_obj else None) or "pending"
        snapshot["amountReceived"] = float(pay.amount_received) if getattr(pay, "amount_received", None) else 0.0
        snapshot["balance"] = float(pay.balance) if getattr(pay, "balance", None) else 0.0
        snapshot["referenceNo"] = pay.reference_no
        snapshot["depositAmount"] = float(pay.deposit_amount) if getattr(pay, "deposit_amount", None) else 0.0
    if getattr(db_order, "delivery", None):
        snapshot["shippingPreference"] = db_order.delivery.preference.pref_name if getattr(db_order.delivery, "preference", None) else "pickup"
        snapshot["deliveryAddress"] = db_order.delivery.delivery_address
        snapshot["deliveryCourier"] = db_order.delivery.delivery_courier
        snapshot["releaseTime"] = db_order.delivery.release_time
        snapshot["province"] = db_order.delivery.province
        snapshot["city"] = db_order.delivery.city
        snapshot["barangay"] = db_order.delivery.barangay
        snapshot["zipCode"] = db_order.delivery.zip_code
    if hasattr(db_order, "discount_amount") and getattr(db_order, "discount_amount") is not None:
        snapshot["discount"] = float(db_order.discount_amount)
    elif hasattr(db_order, "discount") and getattr(db_order, "discount") is not None:
        snapshot["discount"] = float(db_order.discount)

    if getattr(db_order, "items", None) and len(db_order.items) > 0:
        all_shoe_descs = []
        all_services = []
        items_arr = []
        for idx, it in enumerate(db_order.items):
            b = clean_shoe_field(it.brand)
            m = clean_shoe_field(it.shoe_model)
            mat = clean_shoe_field(it.material)
            sz = (it.shoe_size or "").strip()
            clr = clean_shoe_field(it.color)

            it_srvs = []
            if getattr(it, "services", None):
                for s_map in it.services:
                    s_name = getattr(s_map, "service_name", "")
                    if s_name:
                        it_srvs.append(s_name)
                        if s_name not in all_services:
                            all_services.append(s_name)

            pair_title = " ".join([p for p in [b, m] if p]) or f"Pair #{idx + 1}"
            spec_parts = []
            if sz: spec_parts.append(f"Size: {sz}")
            if clr: spec_parts.append(f"Color: {clr}")
            if mat: spec_parts.append(f"Material: {mat}")
            if it_srvs: spec_parts.append(f"Services: {', '.join(it_srvs)}")
            desc = f"Pair #{idx + 1}: {pair_title}" + (f" ({'; '.join(spec_parts)})" if spec_parts else "")
            all_shoe_descs.append(desc)

            items_arr.append({
                "id": it.item_id,
                "brand": b,
                "shoeModel": m,
                "shoeMaterial": mat,
                "shoeSize": sz,
                "color": clr,
                "quantity": it.quantity,
                "services": it_srvs
            })

        snapshot["shoes"] = " \n".join(all_shoe_descs)
        snapshot["services"] = ", ".join(all_services)
        snapshot["items_count"] = len(db_order.items)
        snapshot["shoes_count"] = len(db_order.items)
        snapshot["items"] = items_arr

        item = db_order.items[0]
        snapshot["brand"] = clean_shoe_field(item.brand)
        snapshot["shoeModel"] = clean_shoe_field(item.shoe_model)
        snapshot["shoeMaterial"] = clean_shoe_field(item.material)
        snapshot["shoeSize"] = item.shoe_size
        snapshot["color"] = clean_shoe_field(item.color)
        snapshot["quantity"] = item.quantity
        c_dict = {}
        if getattr(item, "conditions", None):
            for c in item.conditions:
                n = c.condition_name.lower().replace(" ", "").replace("/", "")
                if "scratch" in n: c_dict["scratches"] = True
                elif "yellow" in n: c_dict["yellowing"] = True
                elif "rip" in n or "hole" in n: c_dict["ripsHoles"] = True
                elif "stain" in n: c_dict["deepStains"] = True
                elif "separat" in n: c_dict["soleSeparation"] = True
                elif "worn" in n: c_dict["wornOut"] = True
        if getattr(item, "item_notes", None): c_dict["others"] = clean_shoe_field(item.item_notes)
        snapshot["condition"] = c_dict
        services = []
        addons = []
        if getattr(item, "services", None):
            for s_map in item.services:
                s_name = getattr(s_map, "service_name", "")
                if any(x in s_name.lower() for x in ["cleaning", "reglue", "repaint", "unyellowing"]): services.append(s_name)
                else: addons.append(s_name)
        snapshot["baseService"] = services
        snapshot["addOns"] = addons
    return snapshot


@app.put("/api/orders/{order_id}", response_model=OrderSchema)
def update_order(order_id: str, updates: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Updates order status, priority, or customer details.
    Accepts either integer order_id or order_number string (e.g. ORD-2026-09-11-001).
    """
    print(f"[TRANS] Trace: Updating Order '{order_id}' with {updates.keys()}")
    db_order = None
    if str(order_id).isdigit():
        db_order = db.query(Order).filter(Order.order_id == int(order_id)).first()
    if not db_order:
        db_order = db.query(Order).filter(Order.order_number == str(order_id).strip()).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="System Error: Order record missing.")

    if "items" in updates:
        conflict = color_count_conflict_message(updates.get("items"))
        if conflict:
            raise HTTPException(status_code=400, detail=conflict)
    
    old_order_snapshot = build_order_snapshot(db_order)
    
    # 1. Status Lifecycle & Analytics Logging
    if "status" in updates:
        # Case-insensitive lookup and Slug normalization
        status_name = str(updates["status"]).lower().strip()
        status_map = {
            "new-order": "new-order",
            "on-going": "on-going",
            "for-release": "for-release",
            "claimed": "claimed",
            "cancelled": "cancelled",
            "canceled": "cancelled",
            "pending": "new-order",
            "in progress": "on-going",
            "completed": "for-release"
        }
        mapped_status = status_map.get(status_name, "new-order")
        old_status_name = (db_order.status.status_name if db_order.status else "") or ""
        old_mapped = status_map.get(old_status_name.lower().strip(), old_status_name.lower().strip())
        # Direct DB lookup for the status object
        db_status = db.query(Status).filter(func.lower(Status.status_name) == mapped_status.lower()).first()
        if db_status:
            db_order.status_id = db_status.status_id
            
            # Log the change for ML time-tracking with authoritative integer order_id
            log = StatusLog(order_id=db_order.order_id, status_id=db_status.status_id, user_id=current_user.user_id) 
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
                        
                    auto_q = db.query(Inventory).filter(
                        Inventory.is_active == True,
                        Inventory.auto_deduct == True,
                        Inventory.auto_deduct_trigger.in_(trigger_names)
                    )
                    try:
                        bind = db.get_bind()
                        if bind and bind.dialect.name == "sqlite":
                            auto_items = auto_q.all()
                        else:
                            auto_items = auto_q.with_for_update().all()
                    except Exception:
                        auto_items = auto_q.all()
                    
                    int_oid = int(order_id) if str(order_id).isdigit() else getattr(db_order, "order_id", None)
                    order_services = []
                    for ord_item in (getattr(db_order, "items", None) or []):
                        for svc in (getattr(ord_item, "services", None) or []):
                            s_name = getattr(svc, "service_name", None)
                            if s_name and isinstance(s_name, str):
                                s_name = s_name.strip()
                                if 'rush' not in s_name.lower():
                                    order_services.append(s_name)

                    current_used = list(db_order.inventory_used or [])

                    for item in auto_items:
                        # Determine configured services and consumption amounts
                        # Format 1: JSON array: [{"service": "Basic Cleaning", "quantity": 20}, ...]
                        # Format 2: JSON object: {"Basic Cleaning": 20, "Unyellowing": 30}
                        # Format 3: Legacy comma-separated or "All"
                        configured_services = [] # list of (service_name, quantity)
                        ts = (item.trigger_service or "").strip()
                        
                        if ts.startswith("[") or ts.startswith("{"):
                            try:
                                parsed = json.loads(ts)
                                if isinstance(parsed, list):
                                    for entry in parsed:
                                        if isinstance(entry, dict) and entry.get("service"):
                                            qty = float(entry.get("quantity") or entry.get("amount") or item.consumption_qty or 0)
                                            if qty > 0:
                                                configured_services.append((str(entry.get("service")).strip(), qty))
                                elif isinstance(parsed, dict):
                                    for s_name, s_qty in parsed.items():
                                        qty = float(s_qty or 0)
                                        if qty > 0:
                                            configured_services.append((str(s_name).strip(), qty))
                            except Exception:
                                pass
                        
                        if not configured_services:
                            # Fallback to legacy string or "All"
                            default_qty = float(item.consumption_qty or 0.0)
                            if default_qty > 0:
                                if not ts or ts.lower() in ["all", "all services"]:
                                    unique_order_services = list(dict.fromkeys([s for s in order_services if s]))
                                    for s_name in unique_order_services:
                                        configured_services.append((s_name, default_qty))
                                else:
                                    t_svcs = [s.strip() for s in ts.split(",") if s.strip()]
                                    for t_s in t_svcs:
                                        configured_services.append((t_s, default_qty))

                        # Process each configured service for this item
                        for svc_target, qty_to_deduct in configured_services:
                            # Check if the order contains this service
                            matches_order = any(svc_target.lower() == s.lower() or svc_target.lower() in s.lower() for s in order_services)
                            if not matches_order:
                                continue
                            
                            # Logical Idempotency Key: order_id + item_id + service_name + action_type
                            svc_clean = svc_target.lower().replace(" ", "_")
                            exec_ref = f"ORD-{int_oid}_ITEM-{item.item_id}_SVC-{svc_clean}_auto_deduct"
                            
                            existing_log = db.query(InventoryLog).filter(
                                InventoryLog.item_id == item.item_id,
                                InventoryLog.order_id == int_oid,
                                (
                                    (InventoryLog.execution_ref == exec_ref) |
                                    (
                                        (func.lower(InventoryLog.service_name) == svc_target.lower()) &
                                        (InventoryLog.action_type.in_(["auto_deduct", "deduction"]))
                                    )
                                )
                            ).first()
                            
                            if existing_log:
                                print(f"[AUTO-CONSUME] Skipping '{item.item_name}' for service '{svc_target}' on Order {db_order.order_number}: already deducted.")
                                continue
                            
                            if qty_to_deduct > 0:
                                item.stock_quantity = max(0.0, float(item.stock_quantity or 0) - qty_to_deduct)
                                recalculate_inventory_status(item)
                                
                                # Add to order's inventory_used list
                                current_used.append({
                                    "itemId": item.item_id,
                                    "name": item.item_name,
                                    "service": svc_target,
                                    "quantity": qty_to_deduct,
                                    "unit": item.unit or "units"
                                })
                                
                                # Log stock movement with execution reference and service name
                                consume_log = InventoryLog(
                                    item_id=item.item_id,
                                    change_amount=-qty_to_deduct,
                                    action_type="auto_deduct",
                                    order_id=int_oid,
                                    service_name=svc_target,
                                    execution_ref=exec_ref,
                                    user_id=current_user.user_id
                                )
                                db.add(consume_log)
                                print(f"[AUTO-CONSUME] Deducted {qty_to_deduct} {item.unit} of '{item.item_name}' for service '{svc_target}' on Order {db_order.order_number}")

                    db_order.inventory_used = current_used
                    db_order.inventory_applied = True
            except Exception as auto_err:
                print(f"[AUTO-CONSUME ERROR] Failed to run consumption: {auto_err}")
        else:
            print(f"[EDIT] Error: Mapped status '{mapped_status}' not found in Status table.")

        if mapped_status == "claimed":
            if updates.get("claimedAt") or updates.get("claimed_at") or updates.get("actualCompletionDate"):
                db_order.claimed_at = parse_local_date(updates.get("claimedAt") or updates.get("claimed_at") or updates.get("actualCompletionDate"))
            elif old_mapped != "claimed":
                db_order.claimed_at = datetime.now()
        else:
            if "claimedAt" in updates or "claimed_at" in updates or "actualCompletionDate" in updates:
                c_val = updates.get("claimedAt") if "claimedAt" in updates else (updates.get("claimed_at") if "claimed_at" in updates else updates.get("actualCompletionDate"))
                db_order.claimed_at = parse_local_date(c_val) if c_val else None
            else:
                db_order.claimed_at = None

        def _first_for_release_log():
            return (
                db.query(StatusLog)
                .join(Status, StatusLog.status_id == Status.status_id)
                .filter(
                    StatusLog.order_id == db_order.order_id,
                    func.lower(Status.status_name) == "for-release",
                )
                .order_by(StatusLog.changed_at.asc())
                .first()
            )

        if mapped_status == "for-release":
            if updates.get("actualReleaseDate") or updates.get("released_at"):
                db_order.released_at = parse_local_date(updates.get("actualReleaseDate") or updates.get("released_at"))
            elif db_order.released_at:
                # Preserve existing valid historical release date
                pass
            else:
                prev_release = _first_for_release_log()
                db_order.released_at = prev_release.changed_at if (prev_release and prev_release.changed_at) else datetime.now()
        elif mapped_status == "claimed":
            if updates.get("actualReleaseDate") or updates.get("released_at"):
                db_order.released_at = parse_local_date(updates.get("actualReleaseDate") or updates.get("released_at"))
            elif not db_order.released_at:
                prev_release = _first_for_release_log()
                db_order.released_at = prev_release.changed_at if prev_release else (db_order.claimed_at or datetime.now())
        else:
            if "actualReleaseDate" not in updates and "released_at" not in updates:
                db_order.released_at = None

        if mapped_status != "cancelled":
            db_order.cancelled_at = None
            db_order.cancellation_stage = None
            db_order.refund_status = None
            db_order.refund_amount = Decimal('0.0')
            db_order.refund_reason = None

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
        if "customerName" in updates:
            from order_numbering import validate_customer_name
            is_valid, err_msg, valid_cname = validate_customer_name(updates["customerName"])
            if not is_valid:
                raise HTTPException(status_code=400, detail=err_msg)
            db_order.customer.customer_name = valid_cname
        if "contactNumber" in updates: db_order.customer.contact_number = updates["contactNumber"]

    # 4. Handle Payment & Shipping
    if db_order.payments:
        db_pay = db_order.payments[0]
        is_claim_settlement = (
            "finalPaymentMethod" in updates or 
            (updates.get("status") == "claimed" and updates.get("paymentStatus") == "fully-paid" and float(db_pay.deposit_amount or 0) > 0)
        )
        
        if is_claim_settlement:
            # Preserve db_pay as downpayment, do NOT overwrite its payment method or reference number!
            db_pay.balance = 0.0
            
            # Determine claim settlement payment method
            claim_m_raw = str(updates.get("finalPaymentMethod") or updates.get("paymentMethod") or "cash").lower().strip()
            if "," in claim_m_raw:
                claim_m_raw = claim_m_raw.split(",")[-1].strip()
            if claim_m_raw not in ["cash", "gcash", "maya", "bank-transfer"]:
                claim_m_raw = "cash"
            db_m_claim = db.query(PaymentMethod).filter(PaymentMethod.method_name == claim_m_raw).first() or db_pay.method
            db_ps_full = db.query(PaymentStatus).filter(PaymentStatus.status_name == "fully-paid").first() or db_pay.p_status
            
            total_recv = float(updates.get("amountReceived") or 0.0)
            dp_amount = float(db_pay.deposit_amount or db_pay.amount_received or 0.0)
            claim_amt = max(0.0, total_recv - dp_amount)
            claim_ref = updates.get("claimReferenceNo") or (updates.get("referenceNo") if claim_m_raw in ["gcash", "maya"] else None)

            if len(db_order.payments) > 1:
                # Update existing second payment
                second_pay = db_order.payments[1]
                second_pay.method_id = db_m_claim.method_id
                second_pay.status_id = db_ps_full.p_status_id
                second_pay.amount_received = claim_amt
                second_pay.balance = 0.0
                second_pay.reference_no = claim_ref
            else:
                # Add second payment row (3NF normalized multi-payment)
                second_pay = Payment(
                    order_id=db_order.order_id,
                    method_id=db_m_claim.method_id,
                    status_id=db_ps_full.p_status_id,
                    amount_received=claim_amt,
                    balance=0.0,
                    reference_no=claim_ref,
                    deposit_amount=0.0,
                    created_at=datetime.now()
                )
                db.add(second_pay)
        else:
            # Standard single payment update
            if "paymentMethod" in updates or "referenceNo" in updates:
                # DB stores lowercase: 'cash', 'gcash', 'maya', 'bank-transfer'
                ref_u = str(updates.get("referenceNo") or db_pay.reference_no or "").strip()
                ref_clean = re.sub(r'[^a-zA-Z0-9]', '', ref_u)
                m_name = str(updates.get("paymentMethod") or (db_pay.method.method_name if db_pay.method else "cash")).lower().strip()
                if "," in m_name:
                    m_name = m_name.split(",")[0].strip()
                if "maya" in m_name or len(ref_clean) == 12 or ref_u.lower().startswith(("may", "my")):
                    m_name = "maya"
                elif "gcash" in m_name or len(re.sub(r'\D', '', ref_u)) == 13 or ref_u.lower().startswith("gc"):
                    m_name = "gcash"
                elif m_name not in ["cash", "gcash", "maya", "bank-transfer"]:
                    m_name = "cash"
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

    # 5. Handle Item-level Updates (Brand, Model, Material, Color, Size, Inventory)
    if "items" in updates:
        for item_update in updates["items"]:
            u_id_raw = item_update.get("id")
            if u_id_raw and str(u_id_raw).isdigit():
                item_id = int(u_id_raw)
                db_item = db.query(Item).filter(Item.item_id == item_id).first()
                if db_item:
                    if "brand" in item_update: db_item.brand = item_update["brand"]
                    if "shoeModel" in item_update: db_item.shoe_model = item_update["shoeModel"]
                    if "shoeMaterial" in item_update: db_item.material = item_update["shoeMaterial"]
                    if "color" in item_update:
                        db_item.color = _keep_item_text(db_item.color, item_update.get("color"))
                    if "shoeSize" in item_update or "size" in item_update:
                        db_item.shoe_size = _keep_item_text(
                            db_item.shoe_size,
                            item_update.get("shoeSize") or item_update.get("size"),
                        )
                    if "quantity" in item_update: db_item.quantity = item_update["quantity"]

                    if "inventoryUsed" in item_update:
                        db_item.inventory_used = item_update["inventoryUsed"]

    # 5. Handle Inventory Metadata Persistence (Stock deductions handled strictly via POST /materials)
    if "inventoryUsed" in updates: 
        db_order.inventory_used = updates["inventoryUsed"]
    
    if "inventoryApplied" in updates: 
        db_order.inventory_applied = updates["inventoryApplied"]

    # 5. Handle Date Updates (Order Date & Predicted Completion)
    if "transactionDate" in updates:
        td_iso = updates["transactionDate"]
        if td_iso:
            db_order.created_at = parse_local_date(td_iso)

    if "predictedCompletionDate" in updates:
        expected_iso = updates["predictedCompletionDate"]
        ml_auto = bool(updates.get("mlAutoPredicted"))
        if expected_iso and not ml_auto:
            db_order.expected_at = parse_local_date(expected_iso)
        else:
            db_order.expected_at = predictor.estimate_order_release(
                db, live_order_payload_from_db_order(db_order, updates)
            )["business_rule_date"]
    elif "items" in updates or "priorityLevel" in updates:
        db_order.expected_at = predictor.estimate_order_release(
            db, live_order_payload_from_db_order(db_order, updates)
        )["business_rule_date"]

    if "predicted_at" in updates or "ml_predicted_date" in updates or "predictedAt" in updates:
        raw_pred = updates.get("predicted_at") or updates.get("ml_predicted_date") or updates.get("predictedAt")
        if raw_pred:
            db_order.predicted_at = parse_local_date(raw_pred)
        else:
            db_order.predicted_at = None

    if "predicted_days" in updates or "ml_predicted_days" in updates or "predictedDays" in updates:
        raw_days = updates.get("predicted_days") if updates.get("predicted_days") is not None else (updates.get("ml_predicted_days") if updates.get("ml_predicted_days") is not None else updates.get("predictedDays"))
        if raw_days is not None:
            try:
                db_order.predicted_days = int(raw_days)
            except (ValueError, TypeError):
                db_order.predicted_days = None
        else:
            db_order.predicted_days = None
    elif ("items" in updates or "priorityLevel" in updates) and db_order.predicted_at is None:
        est = predictor.estimate_order_release(db, live_order_payload_from_db_order(db_order, updates))
        if est.get("ml_predicted_date"):
            db_order.predicted_at = est["ml_predicted_date"]
        if est.get("ml_predicted_days") is not None:
            try:
                db_order.predicted_days = int(est["ml_predicted_days"])
            except (ValueError, TypeError):
                pass

    # 5.1 Handle Direct Actual Release Date (released_at) modification
    if "actualReleaseDate" in updates or "released_at" in updates:
        raw_rel = updates.get("actualReleaseDate") if "actualReleaseDate" in updates else updates.get("released_at")
        if raw_rel:
            db_order.released_at = parse_local_date(raw_rel)
            # Sync to status log
            rel_log = (
                db.query(StatusLog)
                .join(Status, StatusLog.status_id == Status.status_id)
                .filter(
                    StatusLog.order_id == db_order.order_id,
                    func.lower(Status.status_name) == "for-release",
                )
                .order_by(StatusLog.changed_at.desc())
                .first()
            )
            if rel_log:
                rel_log.changed_at = db_order.released_at
            # Sync to items if not individual
            if db_order.items:
                for it in db_order.items:
                    it.released_at = db_order.released_at
        elif updates.get("actualReleaseDate") is None and "actualReleaseDate" in updates:
            db_order.released_at = None

    # 5.2 Handle Direct Claimed Date (claimed_at) modification
    if "claimedAt" in updates or "claimed_at" in updates or "actualCompletionDate" in updates:
        raw_cl = updates.get("claimedAt") if "claimedAt" in updates else (updates.get("claimed_at") if "claimed_at" in updates else updates.get("actualCompletionDate"))
        if raw_cl:
            db_order.claimed_at = parse_local_date(raw_cl)
            if db_order.items:
                for it in db_order.items:
                    it.claimed_at = db_order.claimed_at
        elif ("claimedAt" in updates and updates.get("claimedAt") is None) or ("actualCompletionDate" in updates and updates.get("actualCompletionDate") is None) or ("claimed_at" in updates and updates.get("claimed_at") is None):
            db_order.claimed_at = None
            if db_order.items:
                for it in db_order.items:
                    it.claimed_at = None

    # 5.5 Handle Cancellation & Refund Information
    if "cancellationStage" in updates or "cancellation_stage" in updates:
        db_order.cancellation_stage = updates.get("cancellationStage") or updates.get("cancellation_stage")

    if "cancellationReason" in updates or "cancellation_reason" in updates:
        db_order.cancellation_reason = updates.get("cancellationReason") or updates.get("cancellation_reason")

    if "refundStatus" in updates or "refund_status" in updates:
        db_order.refund_status = updates.get("refundStatus") or updates.get("refund_status")

    if "refundAmount" in updates or "refund_amount" in updates:
        raw_rf = updates.get("refundAmount") if updates.get("refundAmount") is not None else updates.get("refund_amount")
        try:
            db_order.refund_amount = Decimal(str(raw_rf)) if raw_rf is not None else Decimal('0.0')
        except Exception:
            db_order.refund_amount = Decimal('0.0')

    if "refundReason" in updates or "refund_reason" in updates:
        db_order.refund_reason = updates.get("refundReason") or updates.get("refund_reason")

    if "preCancellationState" in updates or "pre_cancellation_state" in updates:
        db_order.pre_cancellation_state = updates.get("preCancellationState") or updates.get("pre_cancellation_state")

    if "cancelledAt" in updates or "cancelled_at" in updates:
        raw_ca = updates.get("cancelledAt") or updates.get("cancelled_at")
        if raw_ca:
            db_order.cancelled_at = parse_local_date(str(raw_ca))
        else:
            db_order.cancelled_at = None
    elif "status" in updates and str(updates.get("status", "")).lower().strip() in ("cancelled", "canceled"):
        if not db_order.cancelled_at:
            db_order.cancelled_at = datetime.now()
    elif "status" in updates and str(updates.get("status", "")).lower().strip() not in ("cancelled", "canceled"):
        db_order.pre_cancellation_state = None

    # 6. Cascading Updates: Items, Conditions, and Services
    items_updates = updates.get("items", [])
    if not items_updates and ("brand" in updates or "shoeMaterial" in updates or "shoeModel" in updates or "condition" in updates):
        # Fallback for single-item updates from flat structures
        items_updates = [{
            "brand": clean_shoe_field(updates.get("brand", db_order.items[0].brand if db_order.items else "")),
            "shoeModel": clean_shoe_field(updates.get("shoeModel", db_order.items[0].shoe_model if db_order.items else "")),
            "shoeMaterial": clean_shoe_field(updates.get("shoeMaterial", db_order.items[0].material if db_order.items else "")),
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

            if "brand" in item_data: db_item.brand = clean_shoe_field(item_data["brand"])
            if "shoeModel" in item_data: db_item.shoe_model = clean_shoe_field(item_data["shoeModel"])
            if "shoeMaterial" in item_data: db_item.material = clean_shoe_field(item_data["shoeMaterial"])
            if "color" in item_data:
                db_item.color = _keep_item_text(db_item.color, item_data.get("color"))
            if "shoeSize" in item_data or "size" in item_data:
                db_item.shoe_size = _keep_item_text(
                    db_item.shoe_size,
                    item_data.get("shoeSize") or item_data.get("size"),
                )
            if "quantity" in item_data: db_item.quantity = item_data["quantity"]
            if "status" in item_data: db_item.status = item_data["status"]
            if "released_at" in item_data or "actualReleaseDate" in item_data:
                raw_rd = item_data.get("released_at") or item_data.get("actualReleaseDate")
                db_item.released_at = parse_local_date(str(raw_rd)) if raw_rd else None
            if "claimed_at" in item_data or "actualCompletionDate" in item_data:
                raw_cd = item_data.get("claimed_at") or item_data.get("actualCompletionDate")
                db_item.claimed_at = parse_local_date(str(raw_cd)) if raw_cd else None
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
                # 1. Fetch existing mappings to preserve historical prices
                existing_mappings = {}
                for m in db.query(ItemServiceMapping).filter(ItemServiceMapping.item_id == db_item.item_id).all():
                    existing_mappings[m.service_id] = m.actual_price
                
                # 2. Clear old mappings
                db.query(ItemServiceMapping).filter(ItemServiceMapping.item_id == db_item.item_id).delete()
                
                services_applied = []
                if "baseService" in item_data and isinstance(item_data["baseService"], list): services_applied.extend(item_data["baseService"])
                if "addOns" in item_data and isinstance(item_data["addOns"], list):
                    for ad in item_data["addOns"]:
                        if not ad: continue
                        services_applied.append(ad.get("name") if isinstance(ad, dict) else ad)
                
                for s_name in set(services_applied):
                    if not s_name: continue
                    service_obj = db.query(Service).filter(Service.service_name == s_name).first()
                    if service_obj:
                        # 3. Use historical price if it existed, otherwise use current catalog price
                        price = existing_mappings.get(service_obj.service_id, service_obj.base_price)
                        db.add(ItemServiceMapping(item_id=db_item.item_id, service_id=service_obj.service_id, actual_price=price))

    try:
        db.commit()
        db.refresh(db_order)
        print(f"[TRANS] Success: Order {db_order.order_number} state synchronized.")
        
        new_snapshot = build_order_snapshot(db_order)
        old_st = str(old_order_snapshot.get("status") or "").strip().lower()
        new_st = str(new_snapshot.get("status") or "").strip().lower()
        if old_st != new_st:
            stage_order = ["new-order", "on-going", "for-release", "claimed"]
            old_idx = stage_order.index(old_st) if old_st in stage_order else -1
            new_idx = stage_order.index(new_st) if new_st in stage_order else -1
            is_undo = (new_idx >= 0 and old_idx >= 0 and new_idx < old_idx) or bool(updates.get("isUndo") or updates.get("undo") or "undo" in str(updates.get("reason") or "").lower())
            old_disp = old_st.replace("-", " ").title()
            new_disp = new_st.replace("-", " ").title()
            if is_undo:
                new_snapshot["details"] = f"Status reverted from {old_disp} to {new_disp} (Undo)"
            else:
                new_snapshot["details"] = f"Status changed from {old_disp} to {new_disp}"

        log_audit(
            db=db, action="UPDATE", table_name="orders",
            record_id=db_order.order_id, user=current_user,
            old_values=old_order_snapshot,
            new_values=new_snapshot,
            module="Job Orders",
        )
        return db_order
    except Exception as e:
        db.rollback()
        print(f"[TRANS ERROR] Failed to sync order update: {e}")

@app.post("/api/orders/{order_id}/materials")
def add_order_material(
    order_id: int,
    payload: OrderMaterialPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lightweight, authoritative, idempotent per-pair / per-order material usage.
    Deducts stock from inventory, creates InventoryLog with execution_ref,
    creates MaterialConsumption with unique idempotency_key for database-level concurrency protection,
    creates AuditLog with before/after snapshots, and updates item/order inventory_used.
    """
    db_order = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.items),
        joinedload(Order.status)
    ).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Job Order not found")

    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    # Authoritative idempotency reference key
    exec_ref = payload.idempotency_key or f"ORD-{order_id}_ITEM-{payload.item_id or 'all'}_INV-{payload.inventory_id}_{int(time.time() * 1000)}"

    # 1. Check existing MaterialConsumption record
    existing_consumption = db.query(MaterialConsumption).filter(
        MaterialConsumption.idempotency_key == exec_ref
    ).first()
    if existing_consumption:
        return {
            "status": "already_applied",
            "message": "Material consumption already applied.",
            "order_id": order_id
        }

    # Also check InventoryLog for backward compatibility
    existing_log = db.query(InventoryLog).filter(
        InventoryLog.execution_ref == exec_ref
    ).first()
    if existing_log:
        return {
            "status": "already_applied",
            "message": "Material consumption already applied.",
            "order_id": order_id
        }

    # 2. Lock and validate inventory item
    inv_item = lock_inventory_row(db, payload.inventory_id)
    if not inv_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    old_stock = float(inv_item.stock_quantity or 0)
    if old_stock < payload.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock on hand for '{inv_item.item_name}' ({old_stock} {inv_item.unit or ''} available)."
        )

    # 3. Deduct stock
    new_stock = max(0.0, old_stock - payload.quantity)
    inv_item.stock_quantity = new_stock
    recalculate_inventory_status(inv_item)

    # 4. Build material entry for order / item metadata
    mat_id = str(uuid.uuid4())
    now_dt = datetime.now()
    mat_entry = {
        "id": mat_id,
        "itemId": inv_item.item_id,
        "name": inv_item.item_name,
        "quantity": payload.quantity,
        "unit": inv_item.unit or payload.unit or "units",
        "notes": payload.notes or "",
        "staffMember": current_user.username,
        "date": now_dt.strftime("%m/%d/%Y"),
        "time": now_dt.strftime("%I:%M:%S %p"),
        "executionRef": exec_ref
    }

    # Associate with item / pair
    target_pair_label = "General"
    if payload.item_id and db_order.items:
        db_item = next((i for i in db_order.items if i.item_id == payload.item_id), None)
        if db_item:
            pair_idx = next((idx + 1 for idx, i in enumerate(db_order.items) if i.item_id == payload.item_id), 1)
            target_pair_label = f"Pair #{pair_idx}"
            curr_item_used = list(db_item.inventory_used or [])
            curr_item_used.append(mat_entry)
            db_item.inventory_used = curr_item_used
    elif db_order.items and len(db_order.items) == 1:
        db_item = db_order.items[0]
        target_pair_label = "Single Pair"
        curr_item_used = list(db_item.inventory_used or [])
        curr_item_used.append(mat_entry)
        db_item.inventory_used = curr_item_used

    curr_order_used = list(db_order.inventory_used or [])
    curr_order_used.append(mat_entry)
    db_order.inventory_used = curr_order_used

    # 5. Insert MaterialConsumption for database-level unique constraint
    db.add(MaterialConsumption(
        idempotency_key=exec_ref,
        order_id=db_order.order_id,
        item_id=payload.item_id,
        inventory_id=inv_item.item_id,
        quantity=payload.quantity
    ))

    # 6. Write InventoryLog
    db.add(InventoryLog(
        item_id=inv_item.item_id,
        change_amount=-payload.quantity,
        action_type="order_material",
        order_id=db_order.order_id,
        service_name=f"{target_pair_label}: {payload.notes}" if payload.notes else target_pair_label,
        execution_ref=exec_ref,
        user_id=current_user.user_id
    ))

    # 7. Write AuditLog
    log_audit(
        db=db,
        action="DEDUCT",
        table_name="inventory",
        record_id=inv_item.item_id,
        user=current_user,
        old_values={"item_name": inv_item.item_name, "stock_quantity": old_stock, "unit": inv_item.unit},
        new_values={
            "item_name": inv_item.item_name,
            "stock_quantity": new_stock,
            "unit": inv_item.unit,
            "amount": payload.quantity,
            "order_id": db_order.order_id,
            "order_number": db_order.order_number,
            "item_id": payload.item_id,
            "pair": target_pair_label,
            "notes": payload.notes,
            "details": f"Logged {payload.quantity} {inv_item.unit or ''} of '{inv_item.item_name}' for Order #{db_order.order_number} ({target_pair_label})"
        },
        module="Inventory"
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Concurrent request caught by unique constraint on idempotency_key
        return {
            "status": "already_applied",
            "message": "Material consumption already applied by concurrent request.",
            "order_id": order_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record material consumption: {e}")

    return {
        "status": "success",
        "material": mat_entry,
        "new_stock": new_stock
    }

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Permanent or cancellation removal of order with full cascade.

    SECURITY (OWASP A01 / P0-6): The Job Orders UI only ever exposes "Cancel Order"
    for orders still in 'new-order' or 'on-going' status (see JobOrders.tsx) — this
    is a legitimate Staff-accessible business action (pre-completion cancellation,
    with the associated refund/forfeiture logic handled client-side). Any order
    that has progressed further ('for-release', 'claimed', or any other status) is
    a completed/near-completed transaction and must not be permanently deletable
    except by an Owner/Admin, even via a direct API call that bypasses the UI.
    """
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    user_role = current_user.role.role_name
    current_status = db_order.status.status_name if db_order.status else None
    cancellable_statuses = ("new-order", "on-going")
    if user_role not in ("owner", "admin") and current_status not in cancellable_statuses:
        print(f"[SECURITY] Unauthorized delete attempt by {current_user.username} (Role: {user_role}) on order {order_id} (status: {current_status}).")
        raise HTTPException(
            status_code=403,
            detail="Only an Owner can delete a job order that has reached For Release/Claimed status.",
        )

    deleted_snapshot = build_order_snapshot(db_order)
    # Staff cancel of early-lifecycle orders vs Owner hard-delete of progressed orders
    is_cancel = current_status in cancellable_statuses
    audit_action = "CANCEL" if is_cancel else "DELETE"
    order_label = deleted_snapshot.get("orderNumber") or deleted_snapshot.get("order_number") or str(order_id)

    # Detach any InventoryLog rows referencing this order (preserve inventory audit
    # history rather than deleting it — see business rule: preserve audit logs).
    try:
        int_oid = int(order_id) if str(order_id).isdigit() else getattr(db_order, "order_id", None)
        if int_oid is not None:
            db.query(InventoryLog).filter(InventoryLog.order_id == int_oid).update({"order_id": None}, synchronize_session=False)
    except Exception as cascade_err:
        print(f"[CASCADE WARNING] InventoryLog detach warning during delete: {cascade_err}")

    # NOTE (bugfix, discovered while verifying P0-6): `Order.items` is configured with
    # cascade="all, delete-orphan", and `Item.services` / `Item.conditions` are
    # secondary-table (many-to-many) relationships. SQLAlchemy's ORM unit-of-work
    # ALREADY automatically deletes the corresponding `item_service_mapping` /
    # `item_condition_mapping` bridge rows when `db.delete(db_order)` cascades down
    # to each Item below. Manually bulk-deleting those same bridge rows first (via
    # `.delete(synchronize_session=False)`) desynchronized the ORM's identity map,
    # causing SQLAlchemy's own subsequent cascade delete to find 0 matching rows and
    # raise a StaleDataError ("expected to delete 1 row(s); Only 0 were matched"),
    # turning every cancel/delete of an order with services or conditions attached
    # into an HTTP 500. Removed the redundant manual deletes; the ORM cascade below
    # already handles them correctly.
    db.delete(db_order)
    db.commit()
    log_audit(
        db=db, action=audit_action, table_name="orders",
        record_id=order_id, user=current_user,
        old_values=deleted_snapshot,
        new_values={
            "order_number": order_label,
            "orderNumber": order_label,
            "previous_status": deleted_snapshot.get("status"),
            "cancelled": is_cancel,
        },
        module="Job Orders",
    )
    return {
        "status": "success",
        "message": (
            f"Order {order_label} cancelled"
            if is_cancel
            else f"Order {order_label} removed"
        ),
    }


# ==========================================
# 4. LOOKUPS & UTILITIES (Read-Only Endpoints)
# ==========================================

@app.get("/api/services", response_model=List[ServiceSchema])
def get_catalog(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns the available service catalog with real-time pricing, ordered by user preference."""
    return db.query(Service).filter(Service.is_active == True).order_by(Service.sort_order.asc()).all()

@app.post("/api/services", response_model=ServiceSchema)
def create_service(service_data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin"]))):
    """Adds a new service to the catalog with category resolution (Owner and Admin)."""
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
        sort_order=sort_order,
        connected_addons=service_data.get('connected_addons') or service_data.get('connectedAddons') or []
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    log_audit(
        db=db, action="CREATE", table_name="services",
        record_id=db_service.service_id, user=current_user,
        new_values={
            "service_name": db_service.service_name,
            "base_price": float(db_service.base_price or 0),
            "duration_days": int(db_service.duration_days or 0),
            "category": cat_name,
            "description": db_service.description,
            "service_code": db_service.service_code,
            "is_active": bool(db_service.is_active),
            "connected_addons": db_service.connected_addons,
        },
        module="Services",
    )
    return db_service

@app.put("/api/services/reorder")
def reorder_services_bulk(reorder_data: List[dict], db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin"]))):
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
        log_audit(
            db=db, action="UPDATE", table_name="services",
            record_id=None, user=current_user,
            old_values={"reorder_count": len(reorder_data)},
            new_values={
                "reorder_count": len(reorder_data),
                "details": f"Service catalog display order updated for {len(reorder_data)} service(s).",
            },
            module="Services",
        )
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Bulk reorder failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save new order")

def _service_audit_snapshot(db_service) -> dict:
    cat = None
    try:
        cat = db_service.category.category_name if getattr(db_service, "category", None) else None
    except Exception:
        cat = None
    return {
        "service_name": db_service.service_name,
        "base_price": float(db_service.base_price or 0),
        "duration_days": int(db_service.duration_days or 0),
        "category": cat,
        "description": db_service.description,
        "service_code": db_service.service_code,
        "is_active": bool(db_service.is_active),
        "connected_addons": getattr(db_service, "connected_addons", None),
    }

@app.put("/api/services/{service_id}", response_model=ServiceSchema)
def update_service(service_id: int, service_update: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin"]))):
    """Updates an existing service with category string-to-ID resolution (Owner and Admin)."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Capture before-state (full business fields for readable Activity History)
    old_svc_snapshot = _service_audit_snapshot(db_service)

    # Handle category update via string resolution if provided
    if "category" in service_update:
        cat_name = service_update.pop("category")
        db_cat = db.query(ServiceCategory).filter(ServiceCategory.category_name == cat_name).first()
        if db_cat:
            db_service.category_id = db_cat.category_id
            
    if "connectedAddons" in service_update:
        service_update["connected_addons"] = service_update.pop("connectedAddons")
    
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
        new_values=_service_audit_snapshot(db_service),
        module="Services",
    )
    return db_service

@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin"]))):
    """Removes a service from the catalog (Owner and Admin)."""
    db_service = db.query(Service).filter(Service.service_id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    svc_name = db_service.service_name
    deleted_snapshot = _service_audit_snapshot(db_service)
    
    # Check if this service is referenced in any order item mappings
    referenced = db.query(ItemServiceMapping).filter(ItemServiceMapping.service_id == service_id).first()
    
    if referenced:
        # Soft delete to maintain 3NF Integrity with past orders
        db_service.is_active = False
        db.commit()
        log_audit(
            db=db, action="DEACTIVATE", table_name="services",
            record_id=service_id, user=current_user,
            old_values={"service_name": svc_name, "was_active": True, "soft_delete": True},
            new_values={
                "is_active": False,
                "soft_delete": True,
                "reason": "linked_to_past_orders",
                "details": f"Service '{svc_name}' deactivated because it is linked to past orders.",
            },
            module="Services",
        )
        return {"status": "success", "message": "Service deactivated (Soft Delete) because it is linked to past orders"}
    else:
        # Permanent hard delete (clean up duplicates or unused services), with safe soft-delete fallback
        try:
            db.delete(db_service)
            db.commit()
            log_audit(
                db=db, action="DELETE", table_name="services",
                record_id=service_id, user=current_user,
                old_values=deleted_snapshot,
                new_values={
                    "service_name": svc_name,
                    "details": f"Service '{svc_name}' permanently deleted.",
                },
                module="Services",
            )
            return {"status": "success", "message": "Service deleted permanently"}
        except Exception:
            db.rollback()
            db_service = db.query(Service).filter(Service.service_id == service_id).first()
            if db_service:
                db_service.is_active = False
                db.commit()
            log_audit(
                db=db, action="DEACTIVATE", table_name="services",
                record_id=service_id, user=current_user,
                old_values=deleted_snapshot,
                new_values={
                    "is_active": False,
                    "soft_delete": True,
                    "details": f"Service '{svc_name}' deactivated (Soft Delete) due to existing references.",
                },
                module="Services",
            )
            return {"status": "success", "message": "Service deactivated (Soft Delete)"}


@app.get("/api/lookups/statuses", response_model=List[StatusSchema])
def get_statuses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all order lifecycle statuses for UI drop-downs."""
    return db.query(Status).all()


@app.get("/api/expenses", response_model=List[ExpenseSchema])
def get_expenses(db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "front staff", "admin"]))):
    """Retrieves all standard logged business and whole-product restock expenses."""
    standard_expenses = db.query(Expense).all()
    return list(standard_expenses)

@app.post("/api/expenses", response_model=ExpenseSchema)
def create_expense(expense_data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "front staff", "admin"]))):
    """Logs a new business expense."""
    # Logic: If date is missing, use now. Use first admin user as fallback for user_id.
    user_id = expense_data.get('user_id', current_user.user_id)
    
    # Map frontend 'date' if provided
    exp_date = expense_data.get('date')
    if exp_date:
        exp_date = parse_local_date(exp_date)
    else:
        exp_date = datetime.now()
        
    # Standardize description format: "Category || Notes || Frequency || Group"
    cat = expense_data.get('category', 'Misc Expense')
    notes = expense_data.get('notes', '')
    freq = expense_data.get('frequency', '')
    grp = expense_data.get('group', '')
    if grp:
        description = f"{cat} || {notes} || {freq} || {grp}"
    elif freq:
        description = f"{cat} || {notes} || {freq}"
    else:
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
def update_expense(expense_id: int, expense_data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("owner"))):
    """Updates an existing expense (Owner only - OWASP A01)."""
    if expense_id >= 1000000:
        log_id = expense_id - 1000000
        log = db.query(InventoryLog).filter(InventoryLog.log_id == log_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Expense (Restock Log) not found")
        item = lock_inventory_row(db, log.item_id) if log.item_id else None
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
                item.stock_quantity = float(item.stock_quantity or 0) + (new_change - old_change)
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

    old_exp_snapshot = {
        "amount": float(db_exp.amount or 0),
        "description": db_exp.description,
        "expense_date": db_exp.expense_date.isoformat() if getattr(db_exp, "expense_date", None) else None,
    }
    
    if 'amount' in expense_data:
        db_exp.amount = expense_data['amount']
        
    cat = expense_data.get('category')
    notes = expense_data.get('notes')
    freq = expense_data.get('frequency')
    grp = expense_data.get('group')
    parts = (db_exp.description or '').split(' || ')
    if cat is None:
        cat = parts[0] if len(parts) > 0 else 'Misc Expense'
    if notes is None:
        notes = parts[1] if len(parts) > 1 else ''
    if freq is None and len(parts) > 2:
        freq = parts[2]
    if grp is None and len(parts) > 3:
        grp = parts[3]

    if grp:
        db_exp.description = f"{cat} || {notes} || {freq or 'One-Time'} || {grp}"
    elif freq:
        db_exp.description = f"{cat} || {notes} || {freq}"
    else:
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
        new_values={
            "amount": float(db_exp.amount or 0),
            "description": db_exp.description,
            "expense_date": db_exp.expense_date.isoformat() if getattr(db_exp, "expense_date", None) else None,
            "category": cat,
            "notes": notes,
        },
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
        item = lock_inventory_row(db, log.item_id) if log.item_id else None
        if item:
            # Reverse the restock quantity from stock_quantity without going below zero
            item.stock_quantity = max(0.0, float(item.stock_quantity or 0) - float(log.change_amount or 0))
            recalculate_inventory_status(item)
        db.delete(log)
        db.commit()
        log_audit(
            db=db, action="DELETE", table_name="expenses",
            record_id=expense_id, user=current_user,
            old_values={
                "type": "inventory_restock",
                "item_name": item.item_name if item else "unknown",
                "amount": float(log.change_amount or 0),
            },
            new_values={
                "details": (
                    f"Restock expense for '{item.item_name if item else 'unknown'}' permanently deleted "
                    f"(stock reversed)."
                ),
            },
            module="Expenses",
        )
        return {"status": "success", "message": "Restock log deleted."}

    db_exp = db.query(Expense).filter(Expense.expense_id == expense_id).first()
    if not db_exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    exp_snapshot = {
        "amount": float(db_exp.amount or 0),
        "description": db_exp.description,
        "expense_date": db_exp.expense_date.isoformat() if getattr(db_exp, "expense_date", None) else None,
    }
    db.delete(db_exp)
    db.commit()
    log_audit(
        db=db, action="DELETE", table_name="expenses",
        record_id=expense_id, user=current_user,
        old_values=exp_snapshot,
        new_values={
            "description": exp_snapshot.get("description"),
            "details": (
                f"Expense '{exp_snapshot.get('description') or expense_id}' "
                f"({_human_audit_value('amount', exp_snapshot.get('amount'))}) permanently deleted."
            ),
        },
        module="Expenses",
    )
    return {"status": "success", "message": "Expense deleted."}

@app.get("/api/activities")
def get_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"])),  # Matches Activity History UI (Owner + Developer)
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
        "historical_orders": "Historical Records",
        "historical_items":  "Historical Records",
        "historical_images": "Historical Records",
        "router_v2":         "System",
    }

    def resolve_details(log) -> str:
        """Build a human-readable detail string without raw JSON."""
        if log.action_type in ("404_NOT_FOUND",) and log.old_values:
            broken_url = log.old_values.get("broken_url", "unknown")
            client = log.new_values.get("client", "unknown") if log.new_values else "unknown"
            return f"Page Not Found: {broken_url} (from {client})"
        if log.action_type == "SERVER_ERROR" and (log.new_values or log.old_values):
            nv = log.new_values if isinstance(log.new_values, dict) else {}
            ov = log.old_values if isinstance(log.old_values, dict) else {}
            error = humanize_server_error(str(ov.get("error") or nv.get("summary") or "Unknown error"))
            where = nv.get("url") or ""
            method = nv.get("method") or ""
            loc = f" during {method} {where}" if where else ""
            return f"Server error{loc}: {error}"
        if log.action_type in ("LOGIN", "LOGIN_SUCCESS"):
            actor = log.username or "unknown user"
            return f"{actor} logged into the system"
        if log.action_type in ("LOGIN_FAILED",):
            actor = log.username or "unknown user"
            return f"Failed login attempt for '{actor}'"
        if log.action_type == "LOGOUT":
            actor = log.username or "unknown user"
            return f"{actor} signed out of the system"
        if log.action_type == "SESSION_TIMEOUT":
            actor = log.username or "unknown user"
            return f"{actor} was signed out automatically due to inactivity"
        if log.action_type == "PASSWORD_RESET":
            actor = log.username or "unknown user"
            return f"{actor} reset their password"
        if log.action_type == "ML_TRAIN":
            return "Machine Learning model retrained on latest historical data"

        nv = log.new_values if isinstance(log.new_values, dict) else {}
        ov = log.old_values if isinstance(log.old_values, dict) else {}
        if isinstance(nv.get("details"), str) and nv["details"].strip():
            return nv["details"].strip()

        target = (
            nv.get("username") or ov.get("username")
            or nv.get("item_name") or ov.get("item_name")
            or nv.get("service_name") or ov.get("service_name")
            or nv.get("customer_name") or ov.get("customer_name")
            or nv.get("customerName") or ov.get("customerName")
            or nv.get("order_number") or ov.get("order_number")
            or nv.get("orderNumber") or ov.get("orderNumber")
            or nv.get("description") or ov.get("description")
        )
        target_suffix = f": {target}" if target else (f" (ID: {log.record_id})" if log.record_id else "")

        # Generic meaningful detail
        readable_table = READABLE_TABLE_MAP.get(log.table_name or "", log.table_name or "Record")
        if log.action_type == "CREATE":
            return f"New {readable_table} record created{target_suffix}"
        if log.action_type == "CANCEL":
            prev = ov.get("status") or nv.get("previous_status")
            prev_txt = f" (was {str(prev).replace('-', ' ').title()})" if prev else ""
            return f"Job order{target_suffix} cancelled{prev_txt}"
        if log.action_type == "UPDATE":
            bits = build_audit_change_bits(ov, nv, limit=6)
            who = f" {target}" if target else (f" #{log.record_id}" if log.record_id else "")
            if bits:
                return f"{readable_table} record{who} updated — {'; '.join(bits)}"
            return f"{readable_table} record{who} updated (no field value changes recorded)"
        if log.action_type == "DELETE":
            soft = bool(nv.get("is_active") is False or nv.get("soft_delete") or ov.get("soft_delete"))
            verb = "removed from catalog (soft delete)" if soft else "permanently deleted"
            return f"{readable_table} record{target_suffix} {verb}"
        if log.action_type == "DEACTIVATE":
            return f"{readable_table} record{target_suffix} deactivated"
        return f"{log.action_type} on {readable_table}{target_suffix}"

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
        table_upper = (log.table_name or "").upper()
        if action_upper in ("SERVER_ERROR", "DELETE", "DEACTIVATE", "CANCEL", "LOGIN_FAILED"):
            log_type = "critical"
        elif action_upper in ("404_NOT_FOUND", "SYSTEM") or table_upper in ("USERS", "SYSTEM"):
            log_type = "system"
        elif action_upper in ("LOGIN", "LOGIN_SUCCESS", "LOGOUT", "PASSWORD_RESET", "SESSION_TIMEOUT"):
            log_type = "auth"
        elif table_upper in ("SERVICES",):
            log_type = "service"
        elif table_upper in ("INVENTORY", "INVENTORY_LOGS"):
            log_type = "inventory"
        elif table_upper in ("EXPENSES",):
            log_type = "expense"
        elif table_upper in ("ORDERS", "ITEMS", "PAYMENTS", "DELIVERIES", "STATUS_LOG", "CUSTOMERS"):
            log_type = "order"
        elif table_upper in ("HISTORICAL_ORDERS", "HISTORICAL_ITEMS", "HISTORICAL_IMAGES"):
            log_type = "historical"
        else:
            log_type = "system"

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
            "oldValues":  (
                {
                    **(log.old_values if isinstance(log.old_values, dict) else {}),
                    "error": humanize_server_error(
                        str((log.old_values or {}).get("error") or "")
                    ),
                }
                if action_upper == "SERVER_ERROR" and isinstance(log.old_values, dict)
                else log.old_values
            ),
            "newValues":  (
                {
                    **(log.new_values if isinstance(log.new_values, dict) else {}),
                    **(
                        {
                            "summary": humanize_server_error(
                                str(
                                    (log.new_values or {}).get("summary")
                                    or (log.old_values or {}).get("error")
                                    or ""
                                )
                            )
                        }
                        if action_upper == "SERVER_ERROR"
                        else {}
                    ),
                }
                if action_upper == "SERVER_ERROR" and isinstance(log.new_values, dict)
                else log.new_values
            ),
            "details":    resolve_details(log),
            "type":       log_type,
            "ipAddress":  log.ip_address,
        })

    # Server-side deduplication guarantee: ensure no duplicate rows appear in the UI
    deduped_results = []
    seen_log_keys = set()
    for item in results:
        dedup_key = (
            item.get("user") or "",
            item.get("actionRaw") or item.get("action") or "",
            item.get("module") or "",
            item.get("table") or "",
            str(item.get("recordId") or ""),
            item.get("timestamp") or "",
        )
        if dedup_key not in seen_log_keys:
            seen_log_keys.add(dedup_key)
            deduped_results.append(item)

    return {
        "total":  total_count,
        "offset": offset,
        "limit":  limit,
        "items":  deduped_results,
    }

@app.post("/api/activities")
def log_custom_activity(activity: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Frontend event logger for UI-specific actions (PRINT, status changes, etc.).
    Maps all action types — no hardcoded 'UPDATE'/'CREATE' fallback.

    SECURITY (OWASP A01 / P1-1): Requires a valid authenticated session. The actor
    identity is ALWAYS taken from the verified JWT (`current_user`), never from a
    client-supplied `user`/`username`/`userId` field, to prevent forging log entries
    under another account's name.
    """
    u = current_user

    # Map action type — pass through as-is (no more hardcoded fallback)
    action_type = (activity.get("action") or activity.get("type") or "CREATE").upper().replace(" ", "_")

    # Resolve module from payload or from table name
    table_name = activity.get("table") or activity.get("module") or "system"
    module = activity.get("module") or TABLE_TO_MODULE.get(table_name, table_name.replace('_', ' ').title())

    rec_id = activity.get("recordId") or activity.get("record_id") or None

    # Merge details into new_values dictionary without dropping other fields
    new_vals = dict(activity.get("newValues") or activity.get("new_values") or {})
    if activity.get("details"):
        new_vals["details"] = activity.get("details")

    old_vals = activity.get("oldValues") or activity.get("old_values")

    # Resolve historical/intake datetime if provided or associated with an order
    raw_ts = activity.get("timestamp") or activity.get("created_at")
    ord_num = (
        new_vals.get("order_number")
        or new_vals.get("orderNumber")
        or (activity.get("details") if ("ORD-" in str(activity.get("details") or "") or "JO-" in str(activity.get("details") or "")) else None)
    )
    ord_date = new_vals.get("order_date") or new_vals.get("orderDate") or activity.get("orderDate")
    ord_time = new_vals.get("order_time") or new_vals.get("orderTime") or activity.get("orderTime")

    order_obj = None
    if table_name == "orders" and rec_id and str(rec_id).isdigit():
        try:
            order_obj = db.query(Order).filter(Order.order_id == int(rec_id)).first()
        except Exception:
            pass

    req_created_at = None
    if ord_date or ord_num or raw_ts:
        req_created_at = resolve_activity_datetime(
            raw_timestamp=raw_ts,
            order_number=ord_num or (order_obj.order_number if order_obj else None),
            order_date=ord_date,
            order_time=ord_time,
            details=activity.get("details"),
        )
    elif order_obj and order_obj.created_at:
        req_created_at = order_obj.created_at

    # De-duplicate identical audit logs recorded in the debounce window (handling both record_id and non-record events)
    try:
        from datetime import timedelta
        dedup_secs = 60 if action_type in ("PRINT", "REPORT_GENERATED", "EXPORT_PDF", "EXPORT_CSV", "LOGIN", "LOGOUT") else 10
        target_actions = [action_type]
        if table_name == "orders" and action_type in ("CREATE", "NEW_ORDER"):
            target_actions = ["CREATE", "NEW_ORDER"]
        recent_q = db.query(AuditLog).filter(
            AuditLog.table_name == table_name,
            AuditLog.action_type.in_(target_actions),
            AuditLog.user_id == u.user_id,
            AuditLog.created_at >= datetime.now() - timedelta(seconds=dedup_secs),
        )
        if rec_id is not None:
            recent_q = recent_q.filter(AuditLog.record_id == rec_id)
        else:
            recent_q = recent_q.filter(AuditLog.record_id.is_(None))
        recent_dup = recent_q.order_by(AuditLog.audit_log_id.desc()).first()
        if recent_dup:
            if req_created_at and recent_dup.created_at != req_created_at:
                recent_dup.created_at = req_created_at
                db.commit()
            return {"status": "already_logged", "id": recent_dup.audit_log_id}
    except Exception:
        pass

    entry = log_audit(
        db=db,
        action=action_type,
        table_name=table_name,
        record_id=rec_id,
        user=u,
        old_values=old_vals,
        new_values=new_vals if new_vals else None,
        module=module,
        created_at=req_created_at,
    )
    return {"status": "logged", "id": entry.audit_log_id if entry else None}



# (Relocated UI Hosting section at EOF)
# ==========================================
# 12. INVENTORY ENDPOINTS
# ==========================================

def generate_unique_inventory_number(db: Session) -> str:
    """
    Auto-generates a sequential, guaranteed-unique inventory number in fixed format INV-XXXX (e.g. INV-0001).
    Scans all records (both active and inactive) across the database.
    """
    all_invs = db.query(Inventory.inventory_number).filter(
        Inventory.inventory_number.isnot(None)
    ).all()
    
    max_num = 0
    existing_numbers = set()
    for (inv_num,) in all_invs:
        if not inv_num:
            continue
        cleaned = str(inv_num).strip().upper()
        existing_numbers.add(cleaned)
        m = re.match(r"^INV-(\d+)$", cleaned)
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
                
    next_num = max_num + 1
    while True:
        candidate = f"INV-{next_num:04d}"
        if candidate not in existing_numbers:
            return candidate
        next_num += 1

@app.get("/api/inventory/next-number")
def get_next_inventory_number(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns the next available unique inventory number in fixed format INV-XXXX."""
    next_num = generate_unique_inventory_number(db)
    return {"next_inventory_number": next_num}

@app.get("/api/inventory", response_model=List[InventorySchema])
def get_inventory(include_inactive: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all supply items. Inactive/soft-deleted items are excluded by default."""
    repo = InventoryRepository(db)
    return repo.get_all(include_inactive=include_inactive)

def _inventory_audit_snapshot(item: Inventory) -> dict:
    """JSON-safe inventory fields for human-readable Activity History diffs."""
    def _num(v):
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return v

    return {
        "item_name": item.item_name,
        "inventory_number": getattr(item, "inventory_number", None),
        "category": item.category,
        "stock_quantity": _num(item.stock_quantity),
        "unit": item.unit,
        "unit_price": _num(item.unit_price),
        "status": item.status,
        "is_active": bool(getattr(item, "is_active", True)),
        "low_stock_threshold": _num(getattr(item, "low_stock_threshold", None)),
        "package_size": _num(getattr(item, "package_size", None)),
        "package_unit": getattr(item, "package_unit", None),
        "is_retail": bool(getattr(item, "is_retail", False)),
        "retail_price": _num(getattr(item, "retail_price", None)),
        "auto_deduct": bool(getattr(item, "auto_deduct", False)),
    }

@app.post("/api/inventory", response_model=InventorySchema)
def create_inventory_item(item: InventorySchema, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin", "staff", "front staff"]))):
    """Add new material to catalog or reactivate inactive existing item."""
    if item.stock_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock quantity cannot be negative.")
    
    # Safe package size defaulting (discrete items such as Shoe Laces default to 1.0)
    pkg_size = float(item.package_size) if (item.package_size and item.package_size > 0) else 1.0

    clean_name = (item.item_name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Item name is required.")

    # Check if item with this name already exists (active or inactive)
    existing_by_name = db.query(Inventory).filter(
        func.lower(Inventory.item_name) == func.lower(clean_name)
    ).first()

    # Automatic inventory number validation, formatting, and uniqueness verification
    raw_inv = (item.inventory_number or "").strip().upper()
    if not raw_inv or not re.match(r"^INV-\d{4,}$", raw_inv):
        inventory_number = generate_unique_inventory_number(db)
    else:
        existing_num = db.query(Inventory).filter(
            func.upper(Inventory.inventory_number) == raw_inv
        ).first()
        if existing_num and (not existing_by_name or existing_num.item_id != existing_by_name.item_id):
            # Collision detected: automatically assign guaranteed unique sequential INV-XXXX
            inventory_number = generate_unique_inventory_number(db)
        else:
            inventory_number = raw_inv

    if existing_by_name:
        if existing_by_name.is_active:
            raise HTTPException(status_code=400, detail=f"An active inventory item named '{clean_name}' already exists.")
        
        # REACTIVATE soft-deleted item with the new parameters
        old_snapshot = _inventory_audit_snapshot(existing_by_name)
        existing_by_name.is_active = True
        existing_by_name.deleted_at = None
        existing_by_name.deleted_by = None
        if not existing_by_name.sync_uuid:
            existing_by_name.sync_uuid = item.sync_uuid or str(uuid.uuid4())
        existing_by_name.inventory_number = inventory_number
        existing_by_name.category = item.category
        existing_by_name.stock_quantity = item.stock_quantity
        existing_by_name.unit = item.unit
        existing_by_name.unit_price = item.unit_price
        existing_by_name.auto_deduct = item.auto_deduct
        existing_by_name.auto_deduct_trigger = item.auto_deduct_trigger
        existing_by_name.trigger_service = item.trigger_service
        existing_by_name.consumption_qty = item.consumption_qty
        existing_by_name.consumption_unit = item.consumption_unit
        existing_by_name.package_size = pkg_size
        existing_by_name.package_unit = item.package_unit
        existing_by_name.low_stock_threshold = item.low_stock_threshold
        existing_by_name.is_retail = bool(item.is_retail)
        existing_by_name.retail_price = item.retail_price if item.retail_price is not None else 0
        recalculate_inventory_status(existing_by_name)

        try:
            db.commit()
            db.refresh(existing_by_name)
        except Exception as commit_err:
            db.rollback()
            raise HTTPException(status_code=400, detail="Item with this name or inventory number already exists.")

        if existing_by_name.stock_quantity > 0:
            try:
                db.add(InventoryLog(
                    item_id=existing_by_name.item_id,
                    change_amount=existing_by_name.stock_quantity,
                    action_type='restock',
                    user_id=current_user.user_id
                ))
                db.commit()
            except Exception:
                db.rollback()

        log_audit(
            db=db, action="CREATE", table_name="inventory",
            record_id=existing_by_name.item_id, user=current_user,
            old_values=old_snapshot,
            new_values={
                **_inventory_audit_snapshot(existing_by_name),
                "details": f"Inventory item '{existing_by_name.item_name}' restored and reactivated."
            },
            module="Inventory",
        )
        return existing_by_name

    # Brand new item
    new_item = Inventory(
        sync_uuid=item.sync_uuid or str(uuid.uuid4()),
        item_name=clean_name,
        inventory_number=inventory_number,
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
        package_size=pkg_size,
        package_unit=item.package_unit,
        low_stock_threshold=item.low_stock_threshold,
        is_retail=bool(item.is_retail),
        retail_price=item.retail_price if item.retail_price is not None else 0
    )
    recalculate_inventory_status(new_item)
    repo = InventoryRepository(db)
    try:
        repo.add(new_item)
    except Exception as add_err:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Inventory item '{clean_name}' or number '{inventory_number}' already exists.")

    if new_item.stock_quantity > 0:
        try:
            db.add(InventoryLog(
                item_id=new_item.item_id,
                change_amount=new_item.stock_quantity,
                action_type='restock',
                user_id=current_user.user_id
            ))
            repo.commit()
        except Exception:
            db.rollback()

    log_audit(
        db=db, action="CREATE", table_name="inventory",
        record_id=new_item.item_id, user=current_user,
        new_values={
            **_inventory_audit_snapshot(new_item),
            "details": f"Added inventory item: {new_item.item_name} ({new_item.stock_quantity} {new_item.unit or ''})"
        },
        module="Inventory",
    )
    return new_item


@app.put("/api/inventory/{item_id}", response_model=InventorySchema)
def update_inventory_item(item_id: int, updates: InventoryUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin", "staff", "front staff"]))):
    """Modify stock or metadata (Owner only - OWASP A01)."""
    item = lock_inventory_row(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Store old snapshot for audit diff (before mutation)
    old_inv_snapshot = _inventory_audit_snapshot(item)
    old_stock = old_inv_snapshot["stock_quantity"]

    update_data = updates.model_dump(exclude_unset=True)

    # P1-3 FIX: reject a duplicate inventory_number clearly (400) instead of letting a
    # unique-constraint violation fall through to the generic sanitized 500 handler.
    if "inventory_number" in update_data:
        new_number = (update_data["inventory_number"] or "").strip() or None
        update_data["inventory_number"] = new_number
        if new_number:
            dup = db.query(Inventory).filter(
                Inventory.inventory_number == new_number,
                Inventory.item_id != item_id,
            ).first()
            if dup:
                raise HTTPException(status_code=400, detail=f"Inventory Number '{new_number}' is already in use by another item.")

    for key, value in update_data.items():
        setattr(item, key, value)

    # Keep retail flags consistent for response serialization.
    if getattr(item, "is_retail", None) is None:
        item.is_retail = False
    if getattr(item, "retail_price", None) is None:
        item.retail_price = 0
    if not item.is_retail:
        item.retail_price = 0
        
    if item.stock_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock quantity cannot be negative.")
        
    recalculate_inventory_status(item)
    
    # S.O.L.I.D & 3NF: Log stock difference if it changed
    if float(item.stock_quantity or 0) != float(old_stock or 0):
        diff = float(item.stock_quantity or 0) - float(old_stock or 0)
        db.add(InventoryLog(
            item_id=item.item_id,
            change_amount=diff,
            action_type='restock' if diff > 0 else 'deduction',
            user_id=current_user.user_id
        ))
    
    db.commit()
    db.refresh(item)
    new_inv_snapshot = _inventory_audit_snapshot(item)
    changed_labels = [
        k for k in new_inv_snapshot.keys()
        if str(old_inv_snapshot.get(k)) != str(new_inv_snapshot.get(k))
    ]
    detail_bits = []
    for k in changed_labels[:8]:
        detail_bits.append(f"{k.replace('_', ' ')}: {old_inv_snapshot.get(k)} → {new_inv_snapshot.get(k)}")
    log_audit(
        db=db, action="UPDATE", table_name="inventory",
        record_id=item_id, user=current_user,
        old_values=old_inv_snapshot,
        new_values={
            **new_inv_snapshot,
            "details": (
                f"Inventory item '{new_inv_snapshot.get('item_name')}' updated — {'; '.join(detail_bits)}"
                if detail_bits
                else f"Inventory item '{new_inv_snapshot.get('item_name')}' saved with no field value changes."
            ),
        },
        module="Inventory",
    )
    return item

@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["owner", "admin", "staff", "front staff"]))):
    """Soft-delete inventory item from catalog (preserves transaction history)."""
    repo = InventoryRepository(db)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Soft delete to preserve transaction logs and relational integrity (3NF)
    old_snapshot = {
        "item_name": item.item_name,
        "category": item.category,
        "stock_quantity": float(item.stock_quantity or 0),
        "unit": item.unit,
        "status": item.status,
        "was_active": True,
        "soft_delete": True,
    }
    now_dt = datetime.now()
    item.is_active = False
    item.deleted_at = now_dt
    item.deleted_by = current_user.username
    repo.commit()
    # Mirror soft-delete bidirectionally so neither SQLite nor PostgreSQL revives the row upon sync
    try:
        if is_sqlite:
            # We are on local SQLite; push soft-delete to remote PostgreSQL if available
            remote_url = os.getenv("DATABASE_URL")
            if remote_url and os.getenv("ALLOW_REMOTE_DB", "true").lower() == "true":
                from sqlalchemy import create_engine as _ce, text as _text
                pg_clean = remote_url.replace("postgres://", "postgresql+psycopg://").replace("postgresql+psycopg2://", "postgresql+psycopg://")
                if "sslnegotiation" in pg_clean:
                    import urllib.parse
                    _p = urllib.parse.urlparse(pg_clean)
                    _q = urllib.parse.parse_qs(_p.query)
                    _q.pop("sslnegotiation", None)
                    pg_clean = urllib.parse.urlunparse(_p._replace(query=urllib.parse.urlencode(_q, doseq=True)))
                rem_eng = _ce(pg_clean, connect_args={"connect_timeout": 2})
                with rem_eng.begin() as r_conn:
                    r_conn.execute(
                        _text("""
                            UPDATE inventory 
                            SET is_active = FALSE, deleted_at = NOW(), deleted_by = :del_by
                            WHERE (sync_uuid IS NOT NULL AND sync_uuid = :sync_uuid)
                               OR lower(item_name) = :name 
                               OR (inventory_number IS NOT NULL AND inventory_number = :inv_num)
                        """),
                        {
                            "del_by": current_user.username,
                            "sync_uuid": item.sync_uuid,
                            "name": old_snapshot["item_name"].lower(),
                            "inv_num": item.inventory_number
                        }
                    )
        else:
            # We are on PostgreSQL; push soft-delete to local SQLite if it exists
            if os.path.exists(LOCAL_SQLITE_PATH):
                import sqlite3
                with sqlite3.connect(LOCAL_SQLITE_PATH) as sqlite_conn:
                    sqlite_conn.execute(
                        """
                            UPDATE inventory 
                            SET is_active = 0, deleted_at = ?, deleted_by = ?
                            WHERE (sync_uuid IS NOT NULL AND sync_uuid = ?)
                               OR lower(item_name) = ? 
                               OR (inventory_number IS NOT NULL AND inventory_number = ?)
                        """,
                        (now_dt.isoformat(), current_user.username, item.sync_uuid, old_snapshot["item_name"].lower(), item.inventory_number),
                    )
                    sqlite_conn.commit()
    except Exception as mirror_err:
        print(f"[SYNC WARNING] Could not mirror inventory soft-delete: {mirror_err}")
    log_audit(
        db=db, action="DELETE", table_name="inventory",
        record_id=item_id, user=current_user,
        old_values=old_snapshot,
        new_values={
            "item_name": old_snapshot["item_name"],
            "inventory_number": old_snapshot.get("inventory_number"),
            "is_active": False,
            "soft_delete": True,
            "details": f"Inventory item '{old_snapshot['item_name']}' removed from catalog (soft delete).",
        },
        module="Inventory",
    )
    return {"status": "success", "message": "Item deactivated"}

@app.post("/api/inventory/adjust")
def adjust_stock(
    item_id: int = Body(...), 
    amount: float = Body(...), 
    action: str = Body(...), # 'deduction', 'restock', 'set_balance', 'auto_deduct'
    unit_mode: Optional[str] = Body("base"), # 'base' or 'package'
    packages: Optional[float] = Body(None),
    order_id: Optional[int] = Body(None),
    service_name: Optional[str] = Body(None),
    service_id: Optional[int] = Body(None),
    execution_ref: Optional[str] = Body(None),
    create_expense: Optional[bool] = Body(False),
    expense_amount: Optional[float] = Body(None),
    expense_category: Optional[str] = Body("Inventory Restock"),
    expense_notes: Optional[str] = Body(None),
    reason: Optional[str] = Body(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["owner", "admin", "staff", "front staff"]))
):
    """
    Record stock movement and update balance with strict atomicity and idempotency.
    Base stock is the sole authoritative stored quantity in DB.
    Transaction flow: Validate -> Lock row -> Convert units -> Verify stock -> Update -> Log -> Audit -> Commit.
    If any step fails, entire transaction is rolled back immediately.
    """
    try:
        item = lock_inventory_row(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        # 0. Convert packages to base unit if requested
        pkg_size = float(getattr(item, 'package_size', 1.0) or 1.0)
        pkg_unit = str(getattr(item, 'package_unit', 'pkg') or 'pkg')
        
        effective_amount = float(amount)
        if unit_mode == "package" and packages is not None and float(packages) > 0:
            if action != 'set_balance' or float(amount or 0.0) == 0.0:
                effective_amount = float(packages) * pkg_size
        
        if effective_amount < 0:
            raise HTTPException(status_code=400, detail="Adjustment amount cannot be negative.")
        old_stock = float(item.stock_quantity or 0)

        # 1. AUTO-DEDUCT IDEMPOTENT HANDLER
        if action == 'auto_deduct':
            svc_name_clean = (service_name or (f"Service #{service_id}" if service_id else "")).strip()
            svc_key = svc_name_clean.lower().replace(" ", "_")
            exec_ref = execution_ref or (f"ORD-{order_id}_ITEM-{item_id}_SVC-{svc_key}_auto_deduct" if order_id and svc_key else None)
            
            # Logical Idempotency Key check: order_id + item_id + service_name + action_type
            if order_id and svc_name_clean:
                existing_query = db.query(InventoryLog).filter(
                    InventoryLog.item_id == item_id,
                    InventoryLog.order_id == order_id
                )
                if exec_ref:
                    existing_log = existing_query.filter(
                        (InventoryLog.execution_ref == exec_ref) |
                        (
                            (func.lower(InventoryLog.service_name) == svc_name_clean.lower()) &
                            (InventoryLog.action_type.in_(["auto_deduct", "deduction"]))
                        )
                    ).first()
                else:
                    existing_log = existing_query.filter(
                        func.lower(InventoryLog.service_name) == svc_name_clean.lower(),
                        InventoryLog.action_type.in_(["auto_deduct", "deduction"])
                    ).first()

                if existing_log:
                    return {
                        "status": "skipped",
                        "message": f"Already deducted for service '{svc_name_clean}' in order {order_id}",
                        "new_stock": item.stock_quantity,
                        "idempotent": True
                    }

            if (old_stock - effective_amount) < 0:
                raise HTTPException(status_code=400, detail="Insufficient stock for automatic deduction.")
            item.stock_quantity = max(0.0, old_stock - effective_amount)
            recalculate_inventory_status(item)

            log = InventoryLog(
                item_id=item_id,
                change_amount=-effective_amount,
                action_type="auto_deduct",
                order_id=order_id,
                service_name=svc_name_clean or None,
                execution_ref=exec_ref,
                user_id=current_user.user_id
            )
            db.add(log)
            db.commit()
            db.refresh(item)
            log_audit(
                db=db,
                action="DEDUCT",
                table_name="inventory",
                record_id=item_id, user=current_user,
                old_values={"item_name": item.item_name, "stock_quantity": old_stock, "unit": item.unit},
                new_values={
                    "item_name": item.item_name,
                    "stock_quantity": float(item.stock_quantity or 0),
                    "unit": item.unit,
                    "action": "auto_deduct",
                    "amount": float(effective_amount),
                    "service_name": svc_name_clean,
                    "order_id": order_id,
                    "details": f"Auto-deducted {effective_amount} {item.unit or ''} on '{item.item_name}' for service '{svc_name_clean}' (Order #{order_id or 'N/A'})"
                },
                module="Inventory"
            )
            return {"status": "success", "new_stock": item.stock_quantity}

        # 2. SET BALANCE (Reconciliation) HANDLER
        elif action == 'set_balance':
            diff = effective_amount - old_stock
            item.stock_quantity = max(0.0, float(effective_amount))
            recalculate_inventory_status(item)

            log = InventoryLog(
                item_id=item_id,
                change_amount=diff,
                action_type='set_balance',
                order_id=order_id,
                user_id=current_user.user_id
            )
            db.add(log)
            db.commit()
            db.refresh(item)
            log_audit(
                db=db,
                action="SET_BALANCE",
                table_name="inventory",
                record_id=item_id, user=current_user,
                old_values={"item_name": item.item_name, "stock_quantity": old_stock, "unit": item.unit},
                new_values={
                    "item_name": item.item_name,
                    "stock_quantity": float(item.stock_quantity or 0),
                    "unit": item.unit,
                    "action": "set_balance",
                    "physical_count": float(effective_amount),
                    "difference": float(diff),
                    "reason": reason,
                    "details": f"Physical count reconciliation on '{item.item_name}': {old_stock} → {float(effective_amount)} {item.unit or ''} (Diff: {diff:+.2f} {item.unit or ''})" + (f" - {reason}" if reason else "")
                },
                module="Inventory"
            )
            return {"status": "success", "new_stock": item.stock_quantity, "adjustment": diff}

        # 3. USE STOCK (Deduction) HANDLER
        elif action == 'deduction':
            if (old_stock - effective_amount) < 0:
                raise HTTPException(status_code=400, detail="Insufficient stock: quantity cannot be negative.")
            item.stock_quantity = max(0.0, old_stock - effective_amount)
            recalculate_inventory_status(item)

            log = InventoryLog(
                item_id=item_id,
                change_amount=-effective_amount,
                action_type='deduction',
                order_id=order_id,
                service_name=service_name,
                user_id=current_user.user_id
            )
            db.add(log)
            db.commit()
            db.refresh(item)
            pkg_note = f" ({packages} {pkg_unit}s)" if (unit_mode == "package" and packages) else ""
            log_audit(
                db=db,
                action="DEDUCT",
                table_name="inventory",
                record_id=item_id, user=current_user,
                old_values={"item_name": item.item_name, "stock_quantity": old_stock, "unit": item.unit},
                new_values={
                    "item_name": item.item_name,
                    "stock_quantity": float(item.stock_quantity or 0),
                    "unit": item.unit,
                    "action": "deduction",
                    "amount": float(effective_amount),
                    "order_id": order_id,
                    "reason": reason,
                    "details": f"Deducted {effective_amount} {item.unit or ''}{pkg_note} on '{item.item_name}': stock {old_stock} → {float(item.stock_quantity or 0)}" + (f" - {reason}" if reason else "")
                },
                module="Inventory"
            )
            return {"status": "success", "new_stock": item.stock_quantity}

        # 4. ADD STOCK (Restock) HANDLER
        else:
            item.stock_quantity = old_stock + effective_amount
            recalculate_inventory_status(item)

            log = InventoryLog(
                item_id=item_id,
                change_amount=effective_amount,
                action_type='restock',
                order_id=order_id,
                user_id=current_user.user_id
            )
            db.add(log)

            created_expense_id = None
            if create_expense and expense_amount and expense_amount > 0:
                try:
                    item_unit = item.unit or 'units'
                    default_notes = f"Stock addition for {item.item_name} (+{effective_amount} {item_unit})"
                    exp_desc = f"{expense_category or 'Inventory'} || {expense_notes or default_notes}"
                    new_expense = Expense(
                        amount=expense_amount,
                        description=exp_desc,
                        expense_date=datetime.now(),
                        user_id=current_user.user_id
                    )
                    db.add(new_expense)
                    db.flush()
                    created_expense_id = new_expense.expense_id
                    log_audit(
                        db=db,
                        action="RESTOCK",
                        table_name="expenses",
                        record_id=new_expense.expense_id,
                        user=current_user,
                        new_values={
                            "amount": float(expense_amount),
                            "expense_amount": float(expense_amount),
                            "description": exp_desc,
                            "item_name": item.item_name,
                            "action": "restock",
                            "stock_added": float(effective_amount),
                            "unit": item.unit,
                            "details": f"Automated expense recorded from Stock Addition: ₱{expense_amount:,.2f} for '{item.item_name}' (+{effective_amount} {item.unit or ''})"
                        },
                        module="Inventory"
                    )
                except Exception as exp_err:
                    print(f"[STOCK ADDITION EXPENSE WARNING] Failed to record expense: {exp_err}")

            db.commit()
            db.refresh(item)
            pkg_note = f" ({packages} {pkg_unit}s)" if (unit_mode == "package" and packages) else ""
            log_audit(
                db=db,
                action="RESTOCK",
                table_name="inventory",
                record_id=item_id, user=current_user,
                old_values={"item_name": item.item_name, "stock_quantity": old_stock, "unit": item.unit},
                new_values={
                    "item_name": item.item_name,
                    "stock_quantity": float(item.stock_quantity or 0),
                    "unit": item.unit,
                    "action": "restock",
                    "amount": float(effective_amount),
                    "stock_added": float(effective_amount),
                    "reason": reason,
                    "expense_id": created_expense_id,
                    "expense_amount": float(expense_amount) if (create_expense and expense_amount) else None,
                    "details": f"Added {effective_amount} {item.unit or ''}{pkg_note} on '{item.item_name}': stock {old_stock} → {float(item.stock_quantity or 0)}" + (f" - {reason}" if reason else "") + (f" [Expense #{created_expense_id} created]" if created_expense_id else "")
                },
                module="Inventory"
            )
            return {"status": "success", "new_stock": item.stock_quantity, "expense_id": created_expense_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Stock adjustment failed: {str(exc)}")

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

# ===========================================================
# HISTORICAL RECORDS MODULE — API ROUTES
# Completely isolated from live /api/orders routes.
# Tables: historical_orders, historical_items, historical_item_services, historical_predictions
# ===========================================================

from fastapi.responses import StreamingResponse
import io


# ------------------------------------------------------------------
# GET /api/historical/orders  — List all historical orders
# ------------------------------------------------------------------
@app.get("/api/historical/orders")
async def list_historical_orders(
    search: Optional[str] = None,
    branch: Optional[str] = None,
    service: Optional[str] = None,
    priority: Optional[str] = None,
    sync_status: Optional[str] = None,
    ocr_status: Optional[str] = None,
    finalized_only: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    # Repair older OCR/import rows once, so the list never exposes blank,
    # date-mismatched, or duplicate historical IDs.
    from order_numbering import repair_historical_order_ids
    if repair_historical_order_ids(db):
        db.commit()
    query = db.query(HistoricalOrder)

    if finalized_only or (ocr_status and ocr_status.lower() in ("validated", "finalized")):
        query = query.filter(HistoricalOrder.ocr_status.in_(["Validated", "Corrected", "VALIDATED", "CORRECTED"]))
    elif ocr_status:
        query = query.filter(HistoricalOrder.ocr_status == ocr_status)

    if search:
        sq = f"%{search}%"
        query = query.join(Customer, HistoricalOrder.customer_id == Customer.customer_id, isouter=True)
        query = query.filter(
            or_(
                HistoricalOrder.order_id.ilike(sq),
                Customer.customer_name.ilike(sq),
            )
        )
    if branch:
        query = query.filter(HistoricalOrder.branch.ilike(f"%{branch}%"))
    if priority:
        query = query.filter(HistoricalOrder.priority == priority)
    if sync_status:
        query = query.filter(HistoricalOrder.sync_status == sync_status)
    if start_date:
        try:
            query = query.filter(HistoricalOrder.date_received >= datetime.fromisoformat(start_date))
        except Exception:
            pass
    if end_date:
        try:
            query = query.filter(HistoricalOrder.date_received <= datetime.fromisoformat(end_date))
        except Exception:
            pass

    total = query.count()
    orders = (
        query
        .options(
            joinedload(HistoricalOrder.customer),
            joinedload(HistoricalOrder.image),
            joinedload(HistoricalOrder.items).joinedload(HistoricalItem.services)
        )
        .order_by(HistoricalOrder.date_received.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    from api.historical_processing import (
        load_service_price_map,
        persist_normalized_timeline_if_stale,
        serialize_historical_order,
    )
    catalog = load_service_price_map(db)
    from historical.ocr_status import validated_filter_values
    validated_statuses = set(validated_filter_values()) | {"Validated", "Corrected", "VALIDATED", "CORRECTED"}
    dirty = False
    for o in orders:
        if (o.ocr_status or "") in validated_statuses and persist_normalized_timeline_if_stale(o):
            dirty = True
    if dirty:
        db.commit()
    results = [serialize_historical_order(o, catalog) for o in orders]

    return {"total": total, "page": page, "limit": limit, "data": results}


# ------------------------------------------------------------------
# POST /api/historical/orders  — Create historical order
# ------------------------------------------------------------------
@app.post("/api/historical/orders", status_code=201)
async def create_historical_order(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    # Customer — find or create
    from order_numbering import generate_canonical_order_id, validate_customer_name, normalize_customer_name
    is_valid, err_msg, customer_name = validate_customer_name(payload.get("customer_name") or "")
    if not is_valid:
        raise HTTPException(status_code=422, detail=err_msg)
    contact_number = (payload.get("contact_number") or "").strip()

    customer = db.query(Customer).filter(
        func.lower(Customer.customer_name) == customer_name.lower(),
        Customer.contact_number == contact_number,
    ).first()
    if not customer:
        customer = Customer(customer_name=customer_name, contact_number=contact_number)
        db.add(customer)
        db.flush()
    elif customer.customer_name != customer_name:
        customer.customer_name = customer_name

    # Date parsing
    def _parse(val):
        if not val:
            return None
        try:
            return datetime.fromisoformat(str(val).replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None

    date_received = _parse(payload.get("date_received"))
    original_estimated_release_date = _parse(payload.get("original_estimated_release_date"))
    claimed_date = _parse(payload.get("claimed_date"))

    if not date_received:
        raise HTTPException(status_code=422, detail="date_received is required.")
    # The date is authoritative; never trust a copied/typed/paper ID here.
    order_id = generate_canonical_order_id(db, date_received)
    if original_estimated_release_date and original_estimated_release_date < date_received:
        raise HTTPException(status_code=422, detail="Expected release date cannot be earlier than date received.")
    if claimed_date and claimed_date < date_received:
        raise HTTPException(status_code=422, detail="Claimed date cannot be earlier than date received.")

    # Auto-calculate completion days
    completion_days = None
    if claimed_date:
        completion_days = (claimed_date - date_received).days

    grand_total  = float(payload.get("grand_total", 0))
    raw_orig = payload.get("original_grand_total")
    try:
        original_grand_total = float(raw_orig) if raw_orig not in (None, "") else None
    except (TypeError, ValueError):
        original_grand_total = None
    downpayment  = float(payload.get("downpayment", 0))
    balance      = round(grand_total - downpayment, 2)
    total_pairs  = int(payload.get("total_pairs", 1))

    order = HistoricalOrder(
        order_id=order_id,
        customer_id=customer.customer_id,
        branch=payload.get("branch"),
        date_received=date_received,
        original_estimated_release_date=original_estimated_release_date,
        claimed_date=claimed_date,
        completion_days=completion_days,
        total_pairs=total_pairs,
        grand_total=grand_total,
        original_grand_total=original_grand_total,
        downpayment=downpayment,
        balance=balance,
        priority=payload.get("priority", "regular"),
        payment_method=payload.get("payment_method"),
        sync_status="pending",
    )
    db.add(order)
    db.flush()

    # Items
    items_payload = payload.get("items", [])
    for item_data in items_payload:
        services = item_data.get("services") or []
        raw_price = item_data.get("item_price")
        if isinstance(raw_price, str) and raw_price.strip().lower() == "free":
            item_price = 0.0
        else:
            try:
                item_price = float(raw_price) if raw_price not in (None, "") else None
            except (TypeError, ValueError):
                item_price = None
        if item_price is None:
            item_price = round(sum(float(s.get("price") or 0) for s in services), 2)
        item = HistoricalItem(
            historical_order_id=order.historical_order_id,
            brand=item_data.get("brand"),
            model=item_data.get("model"),
            color=item_data.get("color"),
            size=item_data.get("size"),
            material=item_data.get("material"),
            priority=item_data.get("priority"),
            remarks=item_data.get("remarks"),
            item_price=item_price,
        )
        db.add(item)
        db.flush()

        for svc_data in services:
            svc = HistoricalItemService(
                historical_item_id=item.historical_item_id,
                service_name=svc_data.get("service_name", ""),
                service_type=svc_data.get("service_type", "base"),
                price=float(svc_data.get("price", 0) or 0),
            )
            db.add(svc)

    db.flush()
    db.expire(order, ["items"])
    from api.historical_processing import apply_explicit_completion_days, apply_normalized_timeline
    apply_normalized_timeline(order)
    if payload.get("completion_days") is not None:
        apply_explicit_completion_days(
            order,
            payload.get("completion_days"),
            claimed_date=claimed_date,
            expected_release=original_estimated_release_date,
        )
    db.commit()
    log_audit(
        db=db,
        action="CREATE",
        table_name="historical_orders",
        record_id=order.historical_order_id,
        user=current_user,
        new_values={
            "order_id": order.order_id,
            "customer_name": customer_name,
            "date_received": date_received.isoformat() if date_received else None,
            "grand_total": float(grand_total),
            "priority": order.priority,
            "branch": order.branch,
            "details": (
                f"Historical order {order.order_id} created for '{customer_name}' "
                f"(₱{float(grand_total):,.2f})."
            ),
        },
        module="Historical Records",
    )
    return {
        "status": "created",
        "historical_order_id": order.historical_order_id,
        "order_id": order.order_id,
    }


# ------------------------------------------------------------------
# PUT /api/historical/orders/{id} — Update historical order
# ------------------------------------------------------------------
@app.put("/api/historical/orders/{historical_order_id}")
async def update_historical_order(
    historical_order_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == historical_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Historical order not found.")

    old_hist_snapshot = {
        "order_id": order.order_id,
        "customer_name": order.customer.customer_name if order.customer else None,
        "date_received": order.date_received.isoformat() if order.date_received else None,
        "grand_total": float(order.grand_total) if order.grand_total is not None else None,
        "priority": order.priority,
        "branch": order.branch,
    }

    def _parse(val):
        if not val:
            return None
        try:
            return datetime.fromisoformat(str(val).replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None

    def _money(val, default=None):
        if val in (None, ""):
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    # Customer — find-or-create so edits actually persist (do not mutate shared CRM rows blindly)
    from order_numbering import resolve_historical_order_id, normalize_customer_name
    if "customer_name" in payload or "contact_number" in payload:
        customer_name = (payload.get("customer_name") if "customer_name" in payload else None)
        if customer_name is None and order.customer is not None:
            customer_name = order.customer.customer_name
        from order_numbering import validate_customer_name
        is_valid, err_msg, customer_name = validate_customer_name(customer_name)
        if not is_valid:
            raise HTTPException(status_code=422, detail=err_msg)
        contact_number = payload.get("contact_number") if "contact_number" in payload else None

        customer = db.query(Customer).filter(
            func.lower(Customer.customer_name) == customer_name.lower(),
            Customer.contact_number == contact_number,
        ).first()
        if not customer:
            customer = Customer(customer_name=customer_name, contact_number=contact_number)
            db.add(customer)
            db.flush()
        order.customer_id = customer.customer_id

    if "date_received" in payload:
        order.date_received = _parse(payload["date_received"]) or order.date_received
    # Recalculate from the date on every edit. This also fixes old wrong IDs.
    order.order_id = resolve_historical_order_id(
        db, date_value=order.date_received, current_order_id=order.order_id,
        exclude_historical_order_id=historical_order_id,
    )
    if "original_estimated_release_date" in payload or "expected_release_date" in payload:
        raw_expected = payload.get("original_estimated_release_date") if "original_estimated_release_date" in payload else payload.get("expected_release_date")
        order.original_estimated_release_date = _parse(raw_expected) if raw_expected else None
    if "claimed_date" in payload:
        raw_claimed = payload.get("claimed_date")
        order.claimed_date = _parse(raw_claimed) if raw_claimed else None
    if order.claimed_date and order.date_received:
        order.completion_days = (order.claimed_date - order.date_received).days
    elif not order.claimed_date:
        order.completion_days = None
    if "branch" in payload:
        order.branch = payload["branch"]
    if "priority" in payload:
        order.priority = payload["priority"]
    if "payment_method" in payload:
        order.payment_method = payload["payment_method"]
    if "grand_total" in payload:
        order.grand_total = float(payload["grand_total"])
    if "original_grand_total" in payload:
        raw_orig = payload.get("original_grand_total")
        try:
            order.original_grand_total = float(raw_orig) if raw_orig not in (None, "") else None
        except (TypeError, ValueError):
            order.original_grand_total = None
    if "downpayment" in payload:
        order.downpayment = float(payload["downpayment"])
    order.balance = round(float(order.grand_total or 0) - float(order.downpayment or 0), 2)
    if "total_pairs" in payload:
        order.total_pairs = int(payload["total_pairs"])

    # Replace items if provided
    if "items" in payload:
        for old_item in list(order.items):
            db.delete(old_item)
        db.flush()
        for item_data in payload["items"]:
            services = item_data.get("services") or []
            raw_price = item_data.get("item_price")
            if isinstance(raw_price, str) and raw_price.strip().lower() == "free":
                item_price = 0.0
            else:
                item_price = _money(raw_price, None)
            if item_price is None:
                item_price = round(sum(_money(s.get("price"), 0.0) or 0.0 for s in services), 2)
            item = HistoricalItem(
                historical_order_id=order.historical_order_id,
                brand=item_data.get("brand"),
                model=item_data.get("model"),
                color=item_data.get("color"),
                size=item_data.get("size"),
                material=item_data.get("material"),
                priority=item_data.get("priority"),
                remarks=item_data.get("remarks"),
                item_price=item_price,
            )
            db.add(item)
            db.flush()
            for svc_data in services:
                db.add(HistoricalItemService(
                    historical_item_id=item.historical_item_id,
                    service_name=svc_data.get("service_name", ""),
                    service_type=svc_data.get("service_type", "base"),
                    price=float(svc_data.get("price", 0) or 0),
                ))

    db.flush()
    db.expire(order, ["items", "customer"])
    from api.historical_processing import apply_explicit_completion_days, apply_normalized_timeline
    apply_normalized_timeline(order)
    if payload.get("completion_days") is not None and str(payload.get("completion_days")).strip() != "":
        raw_clm = payload.get("claimed_date")
        claimed_arg = _parse(raw_clm) if raw_clm else (None if "claimed_date" in payload else order.claimed_date)
        raw_exp = payload.get("original_estimated_release_date") if "original_estimated_release_date" in payload else payload.get("expected_release_date")
        expected_arg = _parse(raw_exp) if raw_exp else (None if ("original_estimated_release_date" in payload or "expected_release_date" in payload) else order.original_estimated_release_date)
        apply_explicit_completion_days(
            order,
            payload.get("completion_days"),
            claimed_date=claimed_arg,
            expected_release=expected_arg,
        )
    elif "completion_days" in payload and (payload.get("completion_days") is None or str(payload.get("completion_days")).strip() == ""):
        order.completion_days = None

    # Enforce strict user deletion if explicitly provided as null/empty
    if "claimed_date" in payload and (payload.get("claimed_date") is None or str(payload.get("claimed_date")).strip() == ""):
        order.claimed_date = None
        order.completion_days = None
    if "original_estimated_release_date" in payload or "expected_release_date" in payload:
        raw_exp = payload.get("original_estimated_release_date") if "original_estimated_release_date" in payload else payload.get("expected_release_date")
        if raw_exp is None or str(raw_exp).strip() == "":
            order.original_estimated_release_date = None
    db.commit()
    db.refresh(order)
    new_hist_snapshot = {
        "order_id": order.order_id,
        "customer_name": order.customer.customer_name if order.customer else None,
        "date_received": order.date_received.isoformat() if order.date_received else None,
        "grand_total": float(order.grand_total) if order.grand_total is not None else None,
        "priority": order.priority,
        "branch": order.branch,
    }
    log_audit(
        db=db,
        action="UPDATE",
        table_name="historical_orders",
        record_id=historical_order_id,
        user=current_user,
        old_values=old_hist_snapshot,
        new_values=new_hist_snapshot,
        module="Historical Records",
    )
    from api.historical_processing import load_service_price_map, serialize_historical_order
    catalog = load_service_price_map(db)
    serialized = serialize_historical_order(order, catalog)
    return {
        "status": "updated",
        "historical_order_id": order.historical_order_id,
        "order_id": order.order_id,
        "customer_name": order.customer.customer_name if order.customer else None,
        "order": serialized,
    }


# ------------------------------------------------------------------
# DELETE /api/historical/orders/{id} — Delete historical order
# ------------------------------------------------------------------
@app.delete("/api/historical/orders/{historical_order_id}")
async def delete_historical_order(
    historical_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == historical_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Historical order not found.")
    old_snapshot = {
        "order_id": order.order_id,
        "customer_name": order.customer.customer_name if order.customer else None,
        "date_received": order.date_received.isoformat() if order.date_received else None,
        "ocr_status": order.ocr_status,
        "grand_total": float(order.grand_total) if order.grand_total is not None else None,
    }
    db.delete(order)
    db.commit()
    log_audit(
        db=db,
        action="DELETE",
        table_name="historical_orders",
        record_id=historical_order_id,
        user=current_user,
        old_values=old_snapshot,
        new_values={"details": f"Historical order {old_snapshot.get('order_id') or historical_order_id} permanently deleted."},
        module="Historical Records",
    )
    return {"status": "deleted", "historical_order_id": historical_order_id}


# ------------------------------------------------------------------
# GET /api/historical/stats — Live record counts for ML Training + Records tabs
# ------------------------------------------------------------------
@app.get("/api/historical/stats")
async def get_historical_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from historical.ocr_status import pending_filter_values, validated_filter_values

    pending = pending_filter_values()
    validated_vals = validated_filter_values()

    total = db.query(func.count(HistoricalOrder.historical_order_id)).scalar() or 0
    validated = db.query(func.count(HistoricalOrder.historical_order_id)).filter(
        HistoricalOrder.ocr_status.in_(validated_vals)
    ).scalar() or 0
    pending_review = db.query(func.count(HistoricalOrder.historical_order_id)).filter(
        HistoricalOrder.ocr_status.in_(pending)
    ).scalar() or 0
    pending_ocr = db.query(func.count(HistoricalImage.historical_image_id)).filter(
        HistoricalImage.ocr_status.in_(pending)
    ).scalar() or 0
    ml_eligible = db.query(func.count(HistoricalOrder.historical_order_id)).filter(
        HistoricalOrder.ocr_status.in_(validated_vals),
        HistoricalOrder.date_received.isnot(None),
        HistoricalOrder.completion_days.isnot(None),
        HistoricalOrder.completion_days > 0,
    ).scalar() or 0
    missing_fields = db.query(func.count(HistoricalOrder.historical_order_id)).filter(
        HistoricalOrder.ocr_status.in_(validated_vals),
        or_(
            HistoricalOrder.completion_days.is_(None),
            HistoricalOrder.completion_days <= 0,
            HistoricalOrder.date_received.is_(None),
        ),
    ).scalar() or 0
    return {
        "total": total,
        "validated": validated,
        "ml_eligible": ml_eligible,
        "missing_fields": missing_fields,
        "pending_review": pending_review,
        "pending_ocr": pending_ocr,
        "ready_for_training": ml_eligible,
        "export_record_count": ml_eligible,
    }


# ------------------------------------------------------------------
# GET /api/temp/debug_image
# ------------------------------------------------------------------
@app.get("/api/temp/debug_image")
async def debug_image(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Local-only schema helper. Disabled in Production."""
    if _IS_PRODUCTION:
        raise HTTPException(status_code=403, detail="Debug endpoints disabled in production")
    try:
        db.execute(text("ALTER TABLE historical_orders ADD COLUMN payment_method VARCHAR(50);"))
        db.commit()
        return {"status": "success", "message": "payment_method added"}
    except Exception as e:
        logger.error(f"[SCHEMA ERROR] Migration failed: {e}", exc_info=True)
        return {"status": "error", "message": "Database schema update failed"}

# ------------------------------------------------------------------
# GET /api/historical/image/{image_filename} — Dynamically fetch image from any subfolder
# ------------------------------------------------------------------
@app.get("/api/historical/image/{image_filename:path}")
async def get_historical_image(
    image_filename: str,
    current_user: User = Depends(require_role("admin")),
):
    hist_dir = os.path.join(os.path.dirname(__file__), "historical_data")
    
    clean_filename = os.path.basename(image_filename).strip().lower()
    
    def _serve(path: str):
        media = "application/pdf" if path.lower().endswith(".pdf") else None
        return FileResponse(path, media_type=media, headers={"Content-Disposition": "inline"})

    # 1. Check pilot_batch first (fastest)
    pilot_dir = os.path.join(hist_dir, "pilot_batch")
    if os.path.exists(pilot_dir):
        for f in os.listdir(pilot_dir):
            if f.lower() == clean_filename:
                return _serve(os.path.join(pilot_dir, f))
        
    # 2. Search recursively in source directory (for missing cloud sync files)
    source_dir = os.path.join(hist_dir, "source")
    if os.path.exists(source_dir):
        for root, dirs, files in os.walk(source_dir):
            for f in files:
                if f.lower() == clean_filename:
                    return _serve(os.path.join(root, f))
                
    raise HTTPException(status_code=404, detail="Image not found in any local folder")


# ------------------------------------------------------------------
# GET /api/historical/archives — Monthly PDF batch archives
# ------------------------------------------------------------------
@app.get("/api/historical/archives")
async def list_historical_archives(
    current_user: User = Depends(require_role("admin")),
):
    """Scan source folders for monthly PDF batch reports."""
    hist_dir = os.path.join(os.path.dirname(__file__), "historical_data")
    source_root = os.path.join(hist_dir, "source", "Digital Job Order Forms")
    archives = []
    if not os.path.isdir(source_root):
        return {"archives": [], "total": 0}

    month_order = [
        "August", "September", "October", "November", "December", "January",
        "February", "March", "April", "May", "June", "July",
    ]
    found_months = {}
    for month_name in sorted(os.listdir(source_root)):
        month_path = os.path.join(source_root, month_name)
        if not os.path.isdir(month_path):
            continue
        pdfs = [f for f in os.listdir(month_path) if f.lower().endswith(".pdf")]
        if not pdfs:
            continue
        pdfs.sort()
        primary = pdfs[0]
        rel_url = (
            f"/historical_data/source/Digital Job Order Forms/{month_name}/{primary}"
        )
        year_hint = "2025" if month_name not in ("January", "February") else "2026"
        if month_name == "January":
            year_hint = "2026"
        elif month_name in ("August", "September", "October", "November", "December"):
            year_hint = "2025"
        found_months[month_name] = {
            "month": month_name,
            "year": year_hint,
            "filename": primary,
            "url": rel_url,
            "pdf_count": len(pdfs),
        }

    for month_name in month_order:
        if month_name in found_months:
            archives.append(found_months[month_name])
    for month_name, entry in found_months.items():
        if month_name not in month_order:
            archives.append(entry)

    return {"archives": archives, "total": len(archives)}


# ------------------------------------------------------------------
# GET /api/historical/processing/queue — Validation queue (OCR pending + missing ML fields)
# ------------------------------------------------------------------
@app.get("/api/historical/processing/queue")
async def get_historical_validation_queue(
    db: Session = Depends(get_db),
    limit: int = 20,
    current_user: User = Depends(require_role("admin")),
):
    from historical.ocr_status import pending_filter_values, validated_filter_values
    from sqlalchemy.orm import defer, joinedload, noload, selectinload

    from api.historical_processing import (
        _build_queue_item,
        _count_review_queue_total,
        assign_display_order_ids,
        load_service_price_map,
        sort_review_queue,
    )

    results = []
    total_pending = _count_review_queue_total(db)
    service_prices = load_service_price_map(db)
    # Source A: pending OCR images, oldest paper date first (archive starts mid-August).
    pending_orders = (
        db.query(HistoricalOrder)
        .join(HistoricalImage, HistoricalImage.historical_order_id == HistoricalOrder.historical_order_id)
        .options(
            defer(HistoricalOrder.audit_trail),
            noload(HistoricalOrder.predictions),
            joinedload(HistoricalOrder.customer),
            joinedload(HistoricalOrder.image),
            selectinload(HistoricalOrder.items).selectinload(HistoricalItem.services),
        )
        .filter(HistoricalImage.ocr_status.in_(pending_filter_values()))
        .order_by(
            HistoricalOrder.date_received.asc(),
            HistoricalImage.historical_image_id.asc(),
        )
        .limit(limit)
        .all()
    )
    for order in pending_orders:
        img = order.image
        if not img:
            continue
        item = _build_queue_item(img, order, "ocr_pending", service_prices=service_prices)
        if item:
            results.append(item)
    # Source B: already-validated records still missing ML fields (not the pending OCR set).
    seen = {r["order"]["historical_order_id"] for r in results if r.get("order")}
    remaining_slots = max(0, limit - len(results))
    incomplete = (
        db.query(HistoricalOrder)
        .options(
            defer(HistoricalOrder.audit_trail),
            noload(HistoricalOrder.predictions),
            joinedload(HistoricalOrder.customer),
            joinedload(HistoricalOrder.image),
            selectinload(HistoricalOrder.items).selectinload(HistoricalItem.services),
        )
        .filter(
            HistoricalOrder.ocr_status.in_(validated_filter_values()),
            or_(
                HistoricalOrder.completion_days.is_(None),
                HistoricalOrder.claimed_date.is_(None),
            ),
        )
        .order_by(HistoricalOrder.date_received.asc())
        .limit(remaining_slots)
        .all()
    ) if remaining_slots else []
    for order in incomplete:
        if order.historical_order_id in seen:
            continue
        item = _build_queue_item(order.image, order, "incomplete_fields", service_prices=service_prices)
        if item:
            results.append(item)
    assign_display_order_ids(db, results)
    sort_review_queue(results)
    return {
        "items": results,
        "total": total_pending,
        "returned": len(results),
    }

def _build_hist_queue_item(img, order, source: str, db=None, reserved=None):
    from api.historical_processing import _build_queue_item
    return _build_queue_item(img, order, source, db=db, reserved=reserved or [])


# ------------------------------------------------------------------
# POST /api/historical/processing/validate/{historical_image_id} — Approve/reject OCR record
# ------------------------------------------------------------------
@app.post("/api/historical/processing/validate/{historical_image_id}")
async def validate_historical_image(
    historical_image_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    img = db.query(HistoricalImage).filter(
        HistoricalImage.historical_image_id == historical_image_id
    ).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    from api.historical_processing import apply_queue_review_action
    result = apply_queue_review_action(
        payload.get("action"),
        img,
        img.order,
        payload.get("corrections") or {},
        db,
    )
    db.commit()
    return {"status": "success", "new_status": img.ocr_status, "action": result}


# ------------------------------------------------------------------
# POST /api/historical/processing/reocr/{historical_image_id} — Re-run OCR for one scan
# ------------------------------------------------------------------
@app.post("/api/historical/processing/reocr/{historical_image_id}")
async def reocr_historical_image_route(
    historical_image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from pathlib import Path
    from historical.ocr_engine import (
        OcrCancelled,
        clear_ocr_cancel,
        extract_from_file,
        extraction_is_usable,
    )
    from historical_ocr_import import apply_extraction_to_order
    from api.historical_processing import _build_queue_item

    img = db.query(HistoricalImage).filter(
        HistoricalImage.historical_image_id == historical_image_id
    ).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    order = img.order
    if order is None:
        raise HTTPException(status_code=404, detail="Linked historical order not found")

    path = Path(img.image_path) if img.image_path else None
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Source image file is missing on disk")

    cancel_key = f"reocr-{historical_image_id}"
    clear_ocr_cancel(cancel_key)
    try:
        page_results = extract_from_file(
            path,
            interactive=True,
            cancel_key=cancel_key,
            local_engine="auto",
        )
    except OcrCancelled:
        clear_ocr_cancel(cancel_key)
        raise HTTPException(status_code=409, detail="OCR cancelled")
    except Exception as exc:
        clear_ocr_cancel(cancel_key)
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    finally:
        clear_ocr_cancel(cancel_key)

    if not page_results:
        raise HTTPException(status_code=500, detail="OCR returned no pages")

    _, extracted, confidence, engine = page_results[0]
    apply_extraction_to_order(db, order, extracted, engine, confidence)
    img.ocr_confidence = confidence
    img.ocr_version = engine
    img.processed_at = datetime.now()
    db.commit()
    db.refresh(order)
    db.refresh(img)

    rebuilt = _build_queue_item(img, order, source="ocr_pending", db=db)
    return {
        "status": "success",
        "usable": extraction_is_usable(extracted),
        "engine": engine,
        "confidence": confidence,
        "item": rebuilt,
    }


@app.post("/api/historical/processing/reocr/{historical_image_id}/cancel")
async def cancel_reocr_historical_image_route(
    historical_image_id: int,
    current_user: User = Depends(require_role("admin")),
):
    from historical.ocr_engine import request_ocr_cancel
    request_ocr_cancel(f"reocr-{historical_image_id}")
    return {"status": "cancelling", "historical_image_id": historical_image_id}

# ------------------------------------------------------------------
# POST /api/historical/processing/validate-order/{id} — Correct a record with missing fields
# ------------------------------------------------------------------
@app.post("/api/historical/processing/validate-order/{historical_order_id}")
async def validate_hist_order_fields(
    historical_order_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from datetime import date as date_type
    order = db.query(HistoricalOrder).filter(HistoricalOrder.historical_order_id == historical_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    corrections = payload.get("corrections", {})
    if "items" in corrections:
        items_data = corrections.pop("items")
        if order.items:
            for idx, item_payload in enumerate(items_data):
                if idx < len(order.items):
                    item = order.items[idx]
                    if "brand" in item_payload: item.brand = item_payload["brand"]
                    if "model" in item_payload: item.model = item_payload["model"]
                    if "color" in item_payload: item.color = item_payload["color"]
                    if "size" in item_payload: item.size = item_payload["size"]
                    
                    if "base_services" in item_payload or "addon_services" in item_payload:
                        db.query(HistoricalItemService).filter(HistoricalItemService.historical_item_id == item.historical_item_id).delete()
                        
                        def _add_svcs(svc_val, s_type):
                            if not svc_val: return
                            s_list = [s.strip() for s in svc_val.split(',')] if isinstance(svc_val, str) else svc_val
                            for s_name in s_list:
                                if not s_name.strip(): continue
                                clean_name = s_name.split(' (')[0] if ' (' in s_name else s_name
                                db.add(HistoricalItemService(
                                    historical_item_id=item.historical_item_id,
                                    service_name=clean_name.strip(),
                                    service_type=s_type,
                                    price=0.0
                                ))
                        
                        _add_svcs(item_payload.get("base_services"), 'base')
                        _add_svcs(item_payload.get("addon_services"), 'addon')

    for field, value in corrections.items():
        target = "original_estimated_release_date" if field == "expected_release_date" else field
        if hasattr(order, target):
            if target in ("original_estimated_release_date", "claimed_date"):
                if value in ("", None):
                    setattr(order, target, None)
                else:
                    setattr(order, target, _parse(value))
            elif target == "date_received":
                if value not in ("", None):
                    setattr(order, target, _parse(value) or getattr(order, target))
            else:
                setattr(order, target, value)
    # Recalculate completion_days if dates present
    if order.date_received and order.claimed_date:
        try:
            dr = order.date_received if isinstance(order.date_received, date_type) else datetime.fromisoformat(str(order.date_received)).date()
            cd = order.claimed_date if isinstance(order.claimed_date, date_type) else datetime.fromisoformat(str(order.claimed_date)).date()
            order.completion_days = (cd - dr).days
        except Exception:
            pass
    elif not order.claimed_date:
        order.completion_days = None
    action = str(payload.get("action") or "").strip().lower()
    from historical.ocr_status import REJECTED, VALIDATED
    from api.historical_processing import apply_canonical_id_on_validate, apply_normalized_timeline
    if action == "approve":
        apply_canonical_id_on_validate(order, db, submitted_id=corrections.get("order_id"))
        order.ocr_status = VALIDATED
        order.sync_status = "synced"
        if getattr(order, "image", None):
            order.image.ocr_status = VALIDATED
            order.image.processed_at = datetime.now()
    elif action == "reject":
        order.ocr_status = REJECTED
        if getattr(order, "image", None):
            order.image.ocr_status = REJECTED
            order.image.processed_at = datetime.now()
    else:
        apply_normalized_timeline(order)
    db.commit()
    return {"status": "success", "historical_order_id": historical_order_id, "action": action or "save"}


# ------------------------------------------------------------------
# POST /api/historical/bulk-import — Bulk JSON import from AI extraction
# ------------------------------------------------------------------
@app.post("/api/historical/bulk-import")
async def bulk_import_historical(
    payload: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from datetime import date as date_type
    BUSINESS_START = date_type(2025, 8, 15)
    BUSINESS_END = date_type(2026, 1, 31)
    inserted, skipped, errors = 0, 0, []

    def _parse_date(val):
        if not val: return None
        if isinstance(val, date_type): return val
        try: return datetime.fromisoformat(str(val).strip()).date()
        except: return None

    for idx, record in enumerate(payload):
        try:
            order_date = _parse_date(record.get("date_received") or record.get("order_date"))
            expected_release = _parse_date(record.get("original_estimated_release_date"))
            claimed = _parse_date(record.get("claimed_date"))
            completed = _parse_date(record.get("completed_date") or record.get("actual_completion_date"))

            if order_date and (order_date < BUSINESS_START or order_date > BUSINESS_END):
                errors.append({"index": idx, "order_id": record.get("order_id"), "error": f"Date {order_date} outside valid range."})
                skipped += 1; continue

            claimed_date_source = "actual"

            completion_days = None
            if claimed and order_date:
                completion_days = (claimed - order_date).days
            if completion_days is not None and completion_days < 0:
                errors.append({"index": idx, "order_id": record.get("order_id"), "error": "Negative completion days."})
                completion_days = None

            order_id = str(record.get("order_id") or "")
            if order_id and db.query(HistoricalOrder).filter(HistoricalOrder.order_id == order_id).first():
                errors.append({"index": idx, "order_id": order_id, "error": "Duplicate order_id."})
                skipped += 1; continue

            new_order = HistoricalOrder(
                order_id=order_id or f"IMPORT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{idx}",
                branch=record.get("branch", "Villamor"),
                date_received=order_date,
                original_estimated_release_date=expected_release,
                claimed_date=claimed,
                completion_days=completion_days,
                grand_total=float(record.get("grand_total") or record.get("total") or 0),
                downpayment=float(record.get("downpayment") or record.get("amount_paid") or 0),
                total_pairs=int(record.get("total_pairs") or record.get("number_of_pairs") or 1),
                priority=str(record.get("priority") or "regular").lower(),
                payment_method=record.get("payment_method"),
                sync_status="pending",
                status="completed",
                audit_trail=[{"timestamp": str(datetime.now()), "action": "bulk_import", "claimed_date_source": claimed_date_source}],
            )
            db.add(new_order); db.flush()

            cust = record.get("customer") or {}
            if isinstance(cust, str): cust = {"name": cust}
            cust_name = cust.get("name") or record.get("customer_name", "")
            if cust_name:
                db.add(HistoricalCustomer(
                    historical_order_id=new_order.historical_order_id,
                    name=cust_name,
                    contact_number=cust.get("contact") or cust.get("contact_number") or record.get("contact_number", ""),
                ))

            for shoe in (record.get("shoes") or record.get("items") or record.get("pairs") or []):
                if isinstance(shoe, str): continue
                item = HistoricalItem(
                    historical_order_id=new_order.historical_order_id,
                    brand=shoe.get("brand", ""), model=shoe.get("model", ""),
                    color=shoe.get("color", ""), size=str(shoe.get("size", "")),
                    material=shoe.get("material") or shoe.get("shoe_type", ""),
                    priority=str(shoe.get("priority") or record.get("priority") or "regular").lower(),
                    remarks=shoe.get("remarks", ""),
                )
                db.add(item); db.flush()
                for svc in (shoe.get("services") or []):
                    db.add(HistoricalItemService(
                        historical_item_id=item.historical_item_id,
                        service_name=svc if isinstance(svc, str) else svc.get("service_name", ""),
                        service_type="base" if isinstance(svc, str) else svc.get("service_type", "base"),
                        price=0 if isinstance(svc, str) else float(svc.get("price", 0)),
                    ))
            inserted += 1
        except Exception as e:
            logger.error(f"[HISTORICAL INSERT ERROR] Order {record.get('order_id')}: {e}", exc_info=True)
            errors.append({"index": idx, "order_id": record.get("order_id"), "error": "Record validation or insertion failed"})
            skipped += 1

    db.commit()
    return {"status": "success", "inserted": inserted, "skipped": skipped, "errors": errors}


# ------------------------------------------------------------------
# GET /api/historical/analytics — Analytics aggregates
# ------------------------------------------------------------------
@app.get("/api/historical/analytics")
async def get_historical_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branch: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):

    from historical.ocr_status import validated_filter_values

    # Analytics must use finalized records only. Pending OCR is not business truth.
    query = db.query(HistoricalOrder).filter(
        HistoricalOrder.ocr_status.in_(validated_filter_values())
    )
    if start_date:
        try:
            query = query.filter(HistoricalOrder.date_received >= datetime.fromisoformat(start_date))
        except Exception:
            pass
    if end_date:
        try:
            query = query.filter(HistoricalOrder.date_received <= datetime.fromisoformat(end_date))
        except Exception:
            pass
    if branch:
        query = query.filter(HistoricalOrder.branch.ilike(f"%{branch}%"))
    if priority:
        query = query.filter(HistoricalOrder.priority == priority)

    orders = query.all()

    total_records    = len(orders)
    total_revenue    = sum(float(o.grand_total or 0) for o in orders)
    total_pairs      = sum(int(o.total_pairs or 0) for o in orders)
    customer_ids     = list({o.customer_id for o in orders})
    total_customers  = len(customer_ids)

    completed = [o for o in orders if o.completion_days is not None and o.completion_days > 0]
    avg_completion = round(sum(o.completion_days for o in completed) / len(completed), 1) if completed else 0

    from historical.local_ocr_parser import expand_service_names_for_analytics

    # Service frequency — codes (BC, FR) roll up to the full service name
    service_freq: Dict[str, int] = {}
    brand_freq: Dict[str, int] = {}
    for o in orders:
        for item in o.items:
            brand = item.brand or "Unknown"
            brand_freq[brand] = brand_freq.get(brand, 0) + 1
            for svc in item.services:
                for svc_name in expand_service_names_for_analytics(svc.service_name or "Other"):
                    service_freq[svc_name] = service_freq.get(svc_name, 0) + 1

    most_requested_service = max(service_freq, key=service_freq.get) if service_freq else "N/A"
    most_serviced_brand    = max(brand_freq, key=brand_freq.get) if brand_freq else "N/A"

    # Monthly transaction chart data
    monthly: Dict[str, int] = {}
    for o in orders:
        key = o.date_received.strftime("%Y-%m") if o.date_received else "Unknown"
        monthly[key] = monthly.get(key, 0) + 1
    monthly_chart = sorted(
        [{"period": k, "count": v} for k, v in monthly.items()],
        key=lambda x: x["period"]
    )

    # Revenue trend
    revenue_trend: Dict[str, float] = {}
    for o in orders:
        key = o.date_received.strftime("%Y-%m") if o.date_received else "Unknown"
        revenue_trend[key] = round(revenue_trend.get(key, 0) + float(o.grand_total or 0), 2)
    revenue_chart = sorted(
        [{"period": k, "revenue": v} for k, v in revenue_trend.items()],
        key=lambda x: x["period"]
    )

    # Top services
    top_services = sorted(
        [{"service": k, "count": v} for k, v in service_freq.items()],
        key=lambda x: x["count"], reverse=True
    )[:10]

    # Top brands
    top_brands = sorted(
        [{"brand": k, "count": v} for k, v in brand_freq.items()],
        key=lambda x: x["count"], reverse=True
    )[:10]

    # Highest revenue orders
    high_revenue = sorted(
        orders, key=lambda o: float(o.grand_total or 0), reverse=True
    )[:10]
    highest_revenue_orders = [
        {
            "order_id": o.order_id,
            "customer_name": o.customer.customer_name if o.customer else "",
            "grand_total": float(o.grand_total or 0),
            "date_received": o.date_received.strftime("%Y-%m-%d") if o.date_received else "",
        }
        for o in high_revenue
    ]

    # Completion time distribution
    completion_chart = [
        {"order_id": o.order_id, "completion_days": o.completion_days}
        for o in completed
    ][:50]

    return {
        "overview": {
            "total_records": total_records,
            "total_revenue": round(total_revenue, 2),
            "avg_completion_time": avg_completion,
            "total_pairs": total_pairs,
            "total_customers": total_customers,
            "most_requested_service": most_requested_service,
            "most_serviced_brand": most_serviced_brand,
        },
        "monthly_chart": monthly_chart,
        "revenue_chart": revenue_chart,
        "service_distribution": top_services,
        "brand_distribution": top_brands,
        "highest_revenue_orders": highest_revenue_orders,
        "completion_chart": completion_chart,
    }


# ------------------------------------------------------------------
# GET /api/historical/export-csv — Stream CSV download
# ------------------------------------------------------------------
@app.get("/api/historical/export-csv")
async def export_historical_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    csv_bytes = historical_ml_engine.export_dataset(db)
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historical_dataset.csv"},
    )


# ------------------------------------------------------------------
# POST /api/historical/train — Train Random Forest
# ------------------------------------------------------------------
@app.post("/api/historical/train")
async def train_historical_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = historical_ml_engine.train_model(db)
    if result.get("status") == "success":
        # Reload live predictor singleton so /api/predict uses the freshly trained artifact.
        predictor.metadata = predictor._load_metadata()
        predictor.model = predictor._load_model()
    return result


# ------------------------------------------------------------------
# POST /api/historical/predict — Predict release date
# ------------------------------------------------------------------
@app.post("/api/historical/predict")
async def predict_historical_release(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):

    date_received_str = payload.get("date_received")
    date_received = None
    if date_received_str:
        try:
            date_received = datetime.fromisoformat(str(date_received_str).replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass

    priority_map = {"regular": 0, "rush": 1, "premium": 2}
    priority_raw = (payload.get("priority") or "regular").lower()

    features = {
        "total_pairs":            int(payload.get("total_pairs", 1)),
        "basic_cleaning_qty":     int(payload.get("basic_cleaning_qty", 0)),
        "full_reglue_qty":        int(payload.get("full_reglue_qty", 0)),
        "minor_reglue_qty":       int(payload.get("minor_reglue_qty", 0)),
        "full_restoration_qty":   int(payload.get("full_restoration_qty", 0)),
        "minor_restoration_qty":  int(payload.get("minor_restoration_qty", 0)),
        "color_renewal_qty":      int(payload.get("color_renewal_qty", 0)),
        "unyellowing_qty":        int(payload.get("unyellowing_qty", 0)),
        "priority_encoded":       priority_map.get(priority_raw, 0),
        "grand_total":            float(payload.get("grand_total", 0)),
        "day_of_week_received":   (date_received.weekday() if date_received else datetime.now().weekday()),
        "month_received":         (date_received.month if date_received else datetime.now().month),
    }

    result = historical_ml_engine.predict(features, date_received)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Persist prediction to DB (optionally linked to historical_order_id)
    hist_order_id = payload.get("historical_order_id")
    predicted_release_date = None
    try:
        predicted_release_date = datetime.fromisoformat(result["predicted_release_date"])
    except Exception:
        predicted_release_date = datetime.now() + timedelta(days=result["predicted_completion_days"])

    prediction = HistoricalPrediction(
        historical_order_id=hist_order_id,
        predicted_completion_days=result["predicted_completion_days"],
        predicted_release_date=predicted_release_date,
        algorithm=result.get("algorithm", "Random Forest Regressor"),
        model_version=result.get("model_version", "1.0"),
        input_snapshot=features,
    )
    db.add(prediction)
    db.commit()

    result["prediction_id"] = prediction.prediction_id
    return result


# ------------------------------------------------------------------
# GET /api/historical/predictions — List all predictions
# ------------------------------------------------------------------
@app.get("/api/historical/predictions")
async def list_historical_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    preds = (
        db.query(HistoricalPrediction)
        .order_by(HistoricalPrediction.prediction_date.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "prediction_id": p.prediction_id,
            "historical_order_id": p.historical_order_id,
            "order_id": p.order.order_id if p.order else None,
            "predicted_completion_days": p.predicted_completion_days,
            "actual_completion_days": p.actual_completion_days,
            "prediction_error": p.prediction_error,
            "predicted_release_date": p.predicted_release_date.strftime("%Y-%m-%d") if p.predicted_release_date else None,
            "algorithm": p.algorithm,
            "model_version": p.model_version,
            "prediction_date": p.prediction_date.isoformat() if p.prediction_date else None,
            "input_snapshot": p.input_snapshot,
        }
        for p in preds
    ]


# ------------------------------------------------------------------
# GET /api/historical/model-info — ML model status
# ------------------------------------------------------------------
@app.get("/api/historical/model-info")
async def get_historical_model_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    record_count = len(historical_ml_engine._query_ml_eligible_orders(db))
    info = historical_ml_engine.get_model_info()
    info["records_available"] = record_count
    return info


# ==========================================
# REPORTS GENERATION & EXPORT ENDPOINTS (OWASP A01 & Authoritative Accounting)
# ==========================================
from report_service import calculate_report_data, generate_report_csv, generate_report_xlsx, generate_report_pdf
from backup_service import create_full_system_backup, verify_backup_archive, BACKUP_DIR

@app.get("/api/reports/data")
def get_report_data_api(
    report_type: str = "sales",
    period_type: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Authoritative backend report calculation (Sales, Expenses, ROI)."""
    t0 = time.perf_counter()
    data = calculate_report_data(db, report_type, period_type, start_date, end_date)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[REPORT API] /api/reports/data served {report_type} ({period_type}) in {elapsed_ms:.2f}ms ({elapsed_ms/1000.0:.3f}s)")

    # Objective 3 Logging: Real-Time Report Generation Performance
    clean_type = report_type.title()
    log_audit(
        db=db,
        action="REPORT_GENERATION_COMPLETED",
        table_name="reports",
        user=current_user,
        new_values={
            "report_type": report_type,
            "period_type": period_type,
            "period_label": data.get("period_label", ""),
            "duration_ms": round(elapsed_ms, 2),
            "format": "JSON",
            "status": "SUCCESS"
        },
        module=f"{clean_type} Report"
    )

    return data

@app.get("/api/reports/export-csv")
def export_report_csv_api(
    report_type: str = "sales",
    period_type: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Generates and streams RFC 4180 structured CSV report with active spreadsheet formulas."""
    t0 = time.perf_counter()
    data = calculate_report_data(db, report_type, period_type, start_date, end_date)
    csv_content = generate_report_csv(data, report_type)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[REPORT API] /api/reports/export-csv completed {report_type} ({period_type}) in {elapsed_ms:.2f}ms ({elapsed_ms/1000.0:.3f}s)")
    
    clean_type = report_type.title().replace(" ", "_")
    period_slug = data["period_label"].replace(" ", "_").replace("–", "-").replace(",", "").replace("(", "").replace(")", "")
    filename = f"Shoelotskey_Villamor-Pasay_{clean_type}_Report_{period_slug}.csv"
    
    log_audit(
        db=db, action="EXPORT_CSV", table_name="reports",
        user=current_user,
        new_values={"report_type": report_type, "period": data["period_label"], "filename": filename, "duration_ms": round(elapsed_ms, 2)},
        module="Reports"
    )
    
    from fastapi.responses import Response
    return Response(
        content=f"\ufeff{csv_content}",
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/reports/export-xlsx")
def export_report_xlsx_api(
    report_type: str = "sales",
    period_type: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Generates and streams native Excel (.xlsx) report with active formulas and corporate styling."""
    t0 = time.perf_counter()
    data = calculate_report_data(db, report_type, period_type, start_date, end_date)
    xlsx_bytes = generate_report_xlsx(data, report_type)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[REPORT API] /api/reports/export-xlsx completed {report_type} ({period_type}) in {elapsed_ms:.2f}ms ({elapsed_ms/1000.0:.3f}s)")
    
    clean_type = report_type.title().replace(" ", "_")
    period_slug = data["period_label"].replace(" ", "_").replace("–", "-").replace(",", "").replace("(", "").replace(")", "")
    filename = f"Shoelotskey_Villamor-Pasay_{clean_type}_Report_{period_slug}.xlsx"
    
    log_audit(
        db=db, action="EXPORT_XLSX", table_name="reports",
        user=current_user,
        new_values={"report_type": report_type, "period": data["period_label"], "filename": filename, "duration_ms": round(elapsed_ms, 2)},
        module="Reports"
    )
    
    from fastapi.responses import Response
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/reports/export-pdf")
def export_report_pdf_api(
    report_type: str = "sales",
    period_type: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Generates and streams authoritative paginated PDF report."""
    t0 = time.perf_counter()
    data = calculate_report_data(db, report_type, period_type, start_date, end_date)
    pdf_bytes = generate_report_pdf(data, report_type)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[REPORT API] /api/reports/export-pdf completed {report_type} ({period_type}) in {elapsed_ms:.2f}ms ({elapsed_ms/1000.0:.3f}s)")
    
    clean_type = report_type.title().replace(" ", "_")
    period_slug = data["period_label"].replace(" ", "_").replace("–", "-").replace(",", "").replace("(", "").replace(")", "")
    filename = f"Shoelotskey_Villamor-Pasay_{clean_type}_Report_{period_slug}.pdf"
    
    log_audit(
        db=db, action="EXPORT_PDF", table_name="reports",
        user=current_user,
        new_values={"report_type": report_type, "period": data["period_label"], "filename": filename, "duration_ms": round(elapsed_ms, 2)},
        module="Reports"
    )
    
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ==========================================
# SECURE SYSTEM BACKUP & RECOVERY (OWNER ONLY)
# ==========================================
@app.post("/api/admin/backup/create")
def create_system_backup_api(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """
    Creates a full read-only system recovery backup.
    Requires Owner/Admin password re-authentication.
    Strictly primary Owner ('owner') and Admin ('admin') only.
    Never logs or stores password.
    """
    if current_user.username.lower() not in ["owner", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only the primary Owner account ('owner') and Admin ('admin') are authorized to create system backups."
        )

    password = str(payload.get("password") or "")
    if not password:
        raise HTTPException(status_code=400, detail="Password confirmation is required to create a system backup.")
        
    pw_match = False
    try:
        pw_match = bcrypt.verify(password, current_user.password_hash)
    except Exception:
        pass
        
    if not pw_match:
        log_audit(
            db=db, action="BACKUP_FAILED", table_name="system",
            user=current_user,
            new_values={"reason": "Password re-authentication failed"},
            module="System Backup"
        )
        raise HTTPException(status_code=401, detail="Invalid password. Backup authorization rejected.")
        
    result = create_full_system_backup(db, current_user.username)
    
    log_audit(
        db=db, action="BACKUP", table_name="system",
        user=current_user,
        new_values={
            "filename": result["filename"],
            "file_size": result["file_size"],
            "total_records": result["total_records"],
            "sha256": result["checksum_sha256"],
            "status": "verified"
        },
        module="System Backup"
    )
    return result

@app.post("/api/admin/backup/download/{filename}")
@app.get("/api/admin/backup/download/{filename}")
def download_system_backup_api(
    filename: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    password: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Securely downloads a verified backup archive with password re-authentication (Owner & Admin only)."""
    if current_user.username.lower() not in ["owner", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only the primary Owner account ('owner') and Admin ('admin') are authorized to download system backups."
        )

    clean_name = os.path.basename(filename.strip())
    if clean_name != filename.strip() or not clean_name.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Invalid backup file identifier.")
        
    file_path = os.path.join(BACKUP_DIR, clean_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested backup archive not found.")

    # Re-authentication verification
    pwd = str((payload.get("password") if payload else None) or password or "").strip()
    if not pwd:
        raise HTTPException(status_code=400, detail="Password re-authentication is required to download a system backup archive.")

    pw_match = False
    try:
        pw_match = bcrypt.verify(pwd, current_user.password_hash)
    except Exception:
        pass

    if not pw_match:
        log_audit(
            db=db, action="BACKUP_DOWNLOAD_FAILED", table_name="system",
            user=current_user,
            new_values={"filename": clean_name, "reason": "Password re-authentication failed"},
            module="System Backup"
        )
        raise HTTPException(status_code=401, detail="Invalid password. Download authorization rejected.")
        
    log_audit(
        db=db, action="BACKUP_DOWNLOAD", table_name="system",
        user=current_user,
        new_values={"filename": clean_name},
        module="System Backup"
    )
    return FileResponse(
        path=file_path,
        media_type="application/gzip",
        filename=clean_name
    )

@app.get("/api/admin/backup/list")
def list_system_backups_api(
    current_user: User = Depends(require_role(["owner", "admin"]))
):
    """Lists available verified system backup archives on server (Owner & Admin only)."""
    if current_user.username.lower() not in ["owner", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only the primary Owner account ('owner') and Admin ('admin') can view system backups."
        )

    backups = []
    if os.path.exists(BACKUP_DIR):
        for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
            if fname.endswith(".tar.gz"):
                fpath = os.path.join(BACKUP_DIR, fname)
                try:
                    stat = os.stat(fpath)
                    backups.append({
                        "filename": fname,
                        "size_bytes": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %I:%M %p")
                    })
                except Exception:
                    pass
    return backups


# ==========================================
# CASH REGISTER & FINANCIAL MONITORING MODULE
# ==========================================

def format_cash_session(session: Optional[CashSession]) -> Optional[dict]:
    if not session:
        return None
    return {
        "id": session.id,
        "business_date": str(session.business_date),
        "opening_cash": float(session.opening_cash) if session.opening_cash is not None else 0.0,
        "expected_cash": float(session.expected_cash) if session.expected_cash is not None else None,
        "actual_cash": float(session.actual_cash) if session.actual_cash is not None else None,
        "over_short": float(session.over_short) if session.over_short is not None else None,
        "status": session.status,
        "opened_by": session.opened_by,
        "opened_by_name": session.opener.username if session.opener else "Staff",
        "opened_at": session.opened_at.isoformat() if session.opened_at else None,
        "closed_by": session.closed_by,
        "closed_by_name": session.closer.username if session.closer else None,
        "closed_at": session.closed_at.isoformat() if session.closed_at else None,
        "variance_reason": session.variance_reason,
    }

def _get_daily_cash_financials(db: Session, b_date: date) -> dict:
    """
    Authoritative server-side calculation of daily cash register balances.
    Digital sales (GCash, Maya) are recorded for sales tracking but DO NOT increase physical cash.
    Cash payments DO increase physical cash.
    Business expenses & owner withdrawals paid in cash reduce physical cash.
    """
    start_of_day = datetime.combine(b_date, datetime.min.time())
    end_of_day = datetime.combine(b_date, datetime.max.time())

    # Latest session for this business date
    session = db.query(CashSession).filter(
        CashSession.business_date == b_date
    ).order_by(CashSession.id.desc()).first()

    beginning_cash = Decimal(str(session.opening_cash)) if session else Decimal("0.00")

    # Order payments received on this business date
    payments = db.query(Payment).options(
        joinedload(Payment.method),
        joinedload(Payment.order)
    ).filter(
        Payment.created_at >= start_of_day,
        Payment.created_at <= end_of_day
    ).order_by(Payment.created_at.asc()).all()

    cash_sales = Decimal("0.00")
    gcash_sales = Decimal("0.00")
    maya_sales = Decimal("0.00")
    other_sales = Decimal("0.00")

    for p in payments:
        amt = Decimal(str(p.amount_received or 0))
        m_name = (p.method.method_name.lower().strip() if p.method and p.method.method_name else "cash")
        if m_name == "cash":
            cash_sales += amt
        elif m_name == "gcash":
            gcash_sales += amt
        elif m_name == "maya":
            maya_sales += amt
        else:
            other_sales += amt

    digital_sales = gcash_sales + maya_sales
    total_daily_payments = cash_sales + digital_sales + other_sales

    # Expenses logged on this business date
    expenses = db.query(Expense).filter(
        Expense.expense_date >= start_of_day,
        Expense.expense_date <= end_of_day
    ).order_by(Expense.expense_date.asc()).all()

    business_expenses = Decimal("0.00")
    owner_withdrawals = Decimal("0.00")

    for e in expenses:
        amt = Decimal(str(e.amount or 0))
        desc_lower = (e.description or "").lower()
        is_wd = (
            "owner withdrawal" in desc_lower
            or "owner / personal" in desc_lower
            or "owner personal" in desc_lower
            or "withdrawal" in desc_lower
        )
        if is_wd:
            owner_withdrawals += amt
        else:
            business_expenses += amt

    total_cash_out = business_expenses + owner_withdrawals
    expected_cash = beginning_cash + cash_sales - total_cash_out

    return {
        "session": session,
        "business_date": b_date,
        "beginning_cash": beginning_cash,
        "cash_sales": cash_sales,
        "gcash_sales": gcash_sales,
        "maya_sales": maya_sales,
        "digital_sales": digital_sales,
        "other_sales": other_sales,
        "total_daily_payments": total_daily_payments,
        "business_expenses": business_expenses,
        "owner_withdrawals": owner_withdrawals,
        "total_cash_out": total_cash_out,
        "expected_cash": expected_cash,
        "payments": payments,
        "expenses": expenses,
    }


@app.get("/api/cash-register/current")
def get_current_cash_session(
    business_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """Returns the current or specified date's active cash register session (Front Staff, Owner, Admin)."""
    if business_date:
        try:
            b_date = datetime.strptime(business_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid business_date format. Use YYYY-MM-DD.")
    else:
        b_date = date.today()

    session = db.query(CashSession).options(
        joinedload(CashSession.opener),
        joinedload(CashSession.closer)
    ).filter(
        CashSession.business_date == b_date
    ).order_by(CashSession.id.desc()).first()

    return {"status": "success", "session": format_cash_session(session)}


@app.get("/api/cash-register/summary")
def get_cash_register_summary(
    business_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """Returns server-authoritative financial calculation for Cash Register cards."""
    if business_date:
        try:
            b_date = datetime.strptime(business_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid business_date format. Use YYYY-MM-DD.")
    else:
        b_date = date.today()

    fin = _get_daily_cash_financials(db, b_date)
    return {
        "status": "success",
        "business_date": str(b_date),
        "session": format_cash_session(fin["session"]),
        "beginning_cash": float(fin["beginning_cash"]),
        "cash_sales": float(fin["cash_sales"]),
        "gcash_sales": float(fin["gcash_sales"]),
        "maya_sales": float(fin["maya_sales"]),
        "digital_sales": float(fin["digital_sales"]),
        "other_sales": float(fin["other_sales"]),
        "total_daily_payments": float(fin["total_daily_payments"]),
        "business_expenses": float(fin["business_expenses"]),
        "owner_withdrawals": float(fin["owner_withdrawals"]),
        "total_cash_out": float(fin["total_cash_out"]),
        "expected_cash": float(fin["expected_cash"]),
    }


@app.get("/api/cash-register/transactions")
def get_cash_register_transactions(
    business_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """Returns a unified, chronological log of all cash drawer movements for the business date."""
    if business_date:
        try:
            b_date = datetime.strptime(business_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid business_date format. Use YYYY-MM-DD.")
    else:
        b_date = date.today()

    fin = _get_daily_cash_financials(db, b_date)
    items = []

    # 1. Opening Fund
    session = fin["session"]
    if session:
        items.append({
            "id": f"open-{session.id}",
            "time": session.opened_at.strftime("%I:%M %p") if session.opened_at else "",
            "raw_time": session.opened_at.isoformat() if session.opened_at else "",
            "timestamp": session.opened_at or datetime.min,
            "transaction": "Beginning Cash Fund",
            "details": f"Register opened by {session.opener.username if session.opener else 'Staff'}",
            "order_id": "-",
            "cash_in": float(session.opening_cash),
            "cash_out": 0.0,
            "method": "CASH",
        })

    # 2. Payments
    for p in fin["payments"]:
        m_name = (p.method.method_name.upper() if p.method and p.method.method_name else "CASH")
        is_cash = (m_name == "CASH")
        order_num = p.order.order_number if p.order else f"ORD-{p.order_id}"
        items.append({
            "id": f"pay-{p.payment_id}",
            "time": p.created_at.strftime("%I:%M %p") if p.created_at else "",
            "raw_time": p.created_at.isoformat() if p.created_at else "",
            "timestamp": p.created_at or datetime.min,
            "transaction": f"Order Payment ({m_name})",
            "details": f"Payment for Order #{order_num}",
            "order_id": order_num,
            "cash_in": float(p.amount_received) if is_cash else 0.0,
            "cash_out": 0.0,
            "amount": float(p.amount_received),
            "method": m_name,
        })

    # 3. Expenses & Withdrawals
    for e in fin["expenses"]:
        desc = e.description or "Business Expense"
        is_wd = "owner withdrawal" in desc.lower() or "withdrawal" in desc.lower()
        t_name = "Owner Withdrawal" if is_wd else "Business Expense"
        items.append({
            "id": f"exp-{e.expense_id}",
            "time": e.expense_date.strftime("%I:%M %p") if e.expense_date else "",
            "raw_time": e.expense_date.isoformat() if e.expense_date else "",
            "timestamp": e.expense_date or datetime.min,
            "transaction": t_name,
            "details": desc,
            "order_id": "-",
            "cash_in": 0.0,
            "cash_out": float(e.amount),
            "amount": float(e.amount),
            "method": "CASH",
        })

    # Sort chronologically
    items.sort(key=lambda x: x["timestamp"])

    # Remove temporary timestamp object from payload
    for it in items:
        it.pop("timestamp", None)

    return {"status": "success", "transactions": items}


@app.post("/api/cash-register/open")
def open_cash_register(
    req: OpenCashRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """Opens the cash register with an initial beginning cash fund."""
    if req.opening_cash < 0:
        raise HTTPException(status_code=400, detail="Beginning cash fund cannot be negative.")

    if req.business_date:
        try:
            b_date = datetime.strptime(req.business_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid business_date format. Use YYYY-MM-DD.")
    else:
        b_date = date.today()

    existing_open = db.query(CashSession).filter(
        CashSession.business_date == b_date,
        CashSession.status == "OPEN"
    ).first()

    if existing_open:
        raise HTTPException(status_code=400, detail="A cash register session is already OPEN for this business date.")

    new_session = CashSession(
        business_date=b_date,
        opening_cash=Decimal(str(round(req.opening_cash, 2))),
        status="OPEN",
        opened_by=current_user.user_id,
        opened_at=datetime.utcnow()
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    log_audit(
        db=db,
        action="OPEN",
        table_name="cash_sessions",
        record_id=new_session.id,
        user=current_user,
        new_values={
            "session_id": new_session.id,
            "business_date": str(new_session.business_date),
            "opening_cash": float(new_session.opening_cash),
            "status": "OPEN",
        },
        module="Cash Register",
    )

    return {"status": "success", "message": "Cash register opened successfully.", "session": format_cash_session(new_session)}


@app.post("/api/cash-register/close")
def close_cash_register(
    req: CloseCashRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """Closes the active cash register session, checking expected vs actual cash counted."""
    if req.session_id:
        session = db.query(CashSession).filter(CashSession.id == req.session_id).first()
    else:
        session = db.query(CashSession).filter(
            CashSession.status == "OPEN"
        ).order_by(CashSession.id.desc()).first()

    if not session or session.status != "OPEN":
        raise HTTPException(status_code=400, detail="No active OPEN cash register session found to close.")

    fin = _get_daily_cash_financials(db, session.business_date)
    expected_cash = fin["expected_cash"]
    actual_cash = Decimal(str(round(req.actual_cash, 2)))
    over_short = actual_cash - expected_cash

    if abs(over_short) > Decimal("0.001"):
        if not req.variance_reason or not req.variance_reason.strip():
            sign_label = "OVER" if over_short > 0 else "SHORT"
            raise HTTPException(
                status_code=400,
                detail=f"Variance detected (₱{abs(float(over_short)):.2f} {sign_label}). A variance reason is required."
            )

    session.expected_cash = expected_cash
    session.actual_cash = actual_cash
    session.over_short = over_short
    session.variance_reason = req.variance_reason.strip() if req.variance_reason else None
    session.status = "CLOSED"
    session.closed_by = current_user.user_id
    session.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)

    log_audit(
        db=db,
        action="CLOSE",
        table_name="cash_sessions",
        record_id=session.id,
        user=current_user,
        new_values={
            "session_id": session.id,
            "business_date": str(session.business_date),
            "expected_cash": float(expected_cash),
            "actual_cash": float(actual_cash),
            "over_short": float(over_short),
            "variance_reason": session.variance_reason,
            "status": "CLOSED",
        },
        module="Cash Register",
    )

    return {"status": "success", "message": "Cash register closed successfully.", "session": format_cash_session(session)}


@app.get("/api/dashboard/front-staff-summary")
def get_front_staff_summary(
    business_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "front staff", "admin"]))
):
    """
    Returns the exact 6 KPI metrics for the Front Staff Dashboard:
    1. Total Sales (Gross value of active orders created today)
    2. Cash Sales (CASH customer payments received today)
    3. Digital Sales (GCash + Maya customer payments received today)
    4. Balance Due (Unpaid order balances)
    5. Daily Expenses (Business operating expenses for today, excluding owner withdrawals)
    6. Cash on Hand (Dynamic expected cash if OPEN, or actual cash counted if CLOSED)
    """
    if business_date:
        try:
            b_date = datetime.strptime(business_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid business_date format. Use YYYY-MM-DD.")
    else:
        b_date = date.today()

    start_of_day = datetime.combine(b_date, datetime.min.time())
    end_of_day = datetime.combine(b_date, datetime.max.time())

    fin = _get_daily_cash_financials(db, b_date)

    # 1. Total Sales (Orders created today that are not cancelled)
    orders_today = db.query(Order).filter(
        Order.created_at >= start_of_day,
        Order.created_at <= end_of_day,
        Order.cancellation_stage.is_(None)
    ).all()
    total_sales = sum([Decimal(str(o.grand_total or 0)) for o in orders_today], Decimal("0.00"))

    # 2. Cash Sales
    cash_sales = fin["cash_sales"]

    # 3. Digital Sales (GCash + Maya)
    digital_sales = fin["digital_sales"]

    # 4. Balance Due (All active orders with outstanding balance)
    active_orders = db.query(Order).options(joinedload(Order.payments)).filter(
        Order.status_id.in_([1, 2, 3]),  # new-order, on-going, for-release
        Order.cancellation_stage.is_(None)
    ).all()
    balance_due = Decimal("0.00")
    for o in active_orders:
        if o.payments:
            latest_payment = o.payments[-1]
            balance_due += Decimal(str(latest_payment.balance or 0))
        else:
            balance_due += Decimal(str(o.grand_total or 0))

    # 5. Daily Expenses (Business operations only, excluding owner withdrawals)
    daily_expenses = fin["business_expenses"]

    # 6. Cash on Hand
    session = fin["session"]
    if session and session.status == "OPEN":
        cash_on_hand = fin["expected_cash"]
        session_status = "OPEN"
    elif session and session.status == "CLOSED":
        cash_on_hand = Decimal(str(session.actual_cash or session.expected_cash or 0))
        session_status = "CLOSED"
    else:
        cash_on_hand = Decimal("0.00")
        session_status = "NONE"

    return {
        "total_sales": float(total_sales),
        "cash_sales": float(cash_sales),
        "digital_sales": float(digital_sales),
        "balance_due": float(balance_due),
        "daily_expenses": float(daily_expenses),
        "cash_on_hand": float(cash_on_hand),
        "session_status": session_status,
        "business_date": str(b_date),
    }


# 3. SPA Support (Catch-all)
# Ensures pages like /orders or /settings work even after a browser refresh.
# MUST BE AT THE BOTTOM to avoid intercepting other GET routes
@app.get("/{full_path:path}")
async def catch_all(full_path: str, request: Request):
    # Only serve the UI if it's NOT an API call
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="API route not found")

    vite_auth = local_vite_auth_redirect(
        request.headers.get("host", ""),
        full_path,
        request.url.query,
    )
    if vite_auth:
        return RedirectResponse(url=vite_auth, status_code=307)

    dist_dir = os.path.realpath(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist")))
    index_path = os.path.join(dist_dir, "index.html")
    
    # If the path looks like a static file that exists inside dist, serve it safely
    safe_rel_path = os.path.normpath(full_path).lstrip("/\\")
    file_candidate = os.path.realpath(os.path.abspath(os.path.join(dist_dir, safe_rel_path)))
    if file_candidate.startswith(dist_dir + os.sep) and os.path.isfile(file_candidate):
        return FileResponse(file_candidate)
        
    # Default to index.html for React Router
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "error", "message": "UI not found."}


# EOF: Backend Entry Point
