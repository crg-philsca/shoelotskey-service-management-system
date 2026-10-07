import jwt
import os
import math
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from models import User, Role, UserSession, Permission, UserPermission
from database import get_db

# --- OWASP A02: UNUSED SECRETS HARDENING ---
# Ensure JWT_SECRET is loaded from environment. Require it in production.
SECRET_KEY = os.getenv("JWT_SECRET")
ENV = (
    "Production"
    if (
        bool(os.getenv("PORT"))
        or bool(os.getenv("DYNO"))
        or str(os.getenv("ENV", "")).strip().lower() in ("production", "prod")
    )
    else "Localhost"
)

if not SECRET_KEY:
    raise RuntimeError("CRITICAL: JWT_SECRET environment variable is required!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # 8-hour shift default

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# --- MULTI-SESSION ARCHITECTURE ---
# All accounts support multiple independent concurrent sessions.
# Authoritative session state is persisted in the PostgreSQL/SQLite `user_sessions` table.
_ACTIVE_USER_SESSIONS: Dict[str, set] = {}
_ACTIVE_EVAL_SESSIONS = _ACTIVE_USER_SESSIONS
_REVOKED_SESSIONS: set = set()

def is_eval_account(username: Optional[str]) -> bool:
    """Returns True if the username belongs to an evaluation account (all accounts support multi-session)."""
    return True

def register_user_session(db: Optional[Session], user: User, session_id: str, request: Optional[Any] = None):
    """Registers session ID for user in database and memory cache."""
    if not user or not session_id:
        return
    norm = str(user.username).strip().lower()
    sid = str(session_id).strip()
    _REVOKED_SESSIONS.discard(sid)
    if norm not in _ACTIVE_USER_SESSIONS:
        _ACTIVE_USER_SESSIONS[norm] = set()
    _ACTIVE_USER_SESSIONS[norm].add(sid)

    if db is not None:
        try:
            ip = None
            ua = None
            if request is not None:
                try:
                    ip = request.client.host if request.client else None
                    ua = request.headers.get("user-agent", None)
                    if ua and len(ua) > 255:
                        ua = ua[:252] + "..."
                except Exception:
                    pass
            sess = UserSession(
                session_id=sid,
                user_id=user.user_id,
                username=user.username,
                created_at=datetime.utcnow(),
                last_active=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
                is_revoked=False,
                ip_address=ip,
                user_agent=ua,
            )
            db.add(sess)
            db.commit()
        except Exception as e:
            print(f"[AUTH PERSISTENCE WARNING] register_user_session error: {e}")
            try:
                db.rollback()
            except Exception:
                pass

def revoke_user_session(db: Optional[Session], username: str, session_id: Optional[str] = None):
    """Revokes session(s). If session_id is given, revokes that specific session only."""
    if not username:
        return
    norm = str(username).strip().lower()
    if session_id:
        sid = str(session_id).strip()
        _REVOKED_SESSIONS.add(sid)
        if norm in _ACTIVE_USER_SESSIONS:
            _ACTIVE_USER_SESSIONS[norm].discard(sid)
        if db is not None:
            try:
                db.query(UserSession).filter(UserSession.session_id == sid).update({"is_revoked": True})
                db.commit()
            except Exception as e:
                print(f"[AUTH PERSISTENCE WARNING] revoke_user_session error: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass
    else:
        # Revoke all sessions for user (e.g., administrative lock)
        all_sids = _ACTIVE_USER_SESSIONS.pop(norm, set())
        for s in all_sids:
            _REVOKED_SESSIONS.add(s)
        if db is not None:
            try:
                db.query(UserSession).filter(func.lower(UserSession.username) == norm).update({"is_revoked": True})
                db.commit()
            except Exception as e:
                print(f"[AUTH PERSISTENCE WARNING] revoke all sessions error: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass

def is_user_session_active(username: str, session_id: Optional[str] = None) -> bool:
    """All accounts permit multiple concurrent sessions; returns False so no login rejection occurs."""
    return False

def validate_user_session(db: Optional[Session], u: User, target: str, token_sid: Optional[str]):
    """Enforces multi-session policy and token revocation checks using database and cache."""
    if not token_sid:
        return
    sid = str(token_sid).strip()
    if sid in _REVOKED_SESSIONS:
        _USER_CACHE.pop(target, None)
        raise HTTPException(status_code=401, detail="Session has ended. Please log in again.")

    if db is not None:
        try:
            sess = db.query(UserSession).filter(UserSession.session_id == sid).first()
            if sess:
                if sess.is_revoked:
                    _REVOKED_SESSIONS.add(sid)
                    _USER_CACHE.pop(target, None)
                    raise HTTPException(status_code=401, detail="Session has ended. Please log in again.")
                if sess.expires_at and sess.expires_at < datetime.utcnow():
                    _REVOKED_SESSIONS.add(sid)
                    _USER_CACHE.pop(target, None)
                    raise HTTPException(status_code=401, detail="Session has expired. Please log in again.")
            else:
                new_sess = UserSession(
                    session_id=sid,
                    user_id=u.user_id,
                    username=u.username,
                    created_at=datetime.utcnow(),
                    last_active=datetime.utcnow(),
                    expires_at=datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
                    is_revoked=False,
                )
                db.add(new_sess)
                db.commit()
        except HTTPException:
            raise
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if target not in _ACTIVE_USER_SESSIONS:
        _ACTIVE_USER_SESSIONS[target] = set()
    _ACTIVE_USER_SESSIONS[target].add(sid)
    setattr(u, '_current_token_sid', sid)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, session_id: Optional[str] = None):
    """Generates a secure JWT for session management (OWASP A07)."""
    to_encode = data.copy()
    if session_id:
        to_encode["sid"] = str(session_id)
    elif "sid" not in to_encode:
        import uuid
        to_encode["sid"] = str(uuid.uuid4())
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import time

_USER_CACHE: Dict[str, Any] = {}

def invalidate_user_cache(username: Optional[str] = None):
    """Safeguard: Invalidate user auth cache when status, role, or permissions change."""
    if username:
        _USER_CACHE.pop(str(username).strip().lower(), None)
    else:
        _USER_CACHE.clear()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)) -> User:
    """
    OWASP A01: BROKEN ACCESS CONTROL PREVENTION
    Middleware to verify token and extract user identity.
    Always performs cryptographic JWT signature validation.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid session - Missing user ID")
        token_sid: Optional[str] = payload.get("sid")
    except jwt.ExpiredSignatureError:
        try:
            payload_unverified = jwt.decode(token, options={"verify_signature": False})
            username = payload_unverified.get("sub")
            if username:
                target = str(username).strip().lower()
                user = db.query(User).filter(or_(func.lower(User.username) == target, func.lower(User.email) == target)).first()
                if user:
                    from main import log_audit
                    from models import AuditLog
                    
                    # Prevent duplicate timeout logs within 60 seconds
                    time_threshold = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=60)
                    recent_timeout = db.query(AuditLog).filter(
                        AuditLog.username == user.username,
                        AuditLog.action_type == "SESSION_TIMEOUT",
                        AuditLog.created_at >= time_threshold
                    ).first()
                    
                    if not recent_timeout:
                        log_audit(
                            db=db,
                            action="SESSION_TIMEOUT",
                            table_name="auth",
                            record_id=user.user_id,
                            user=user,
                            module="Authentication",
                            new_values={"status": "session_expired", "username": user.username},
                        )
        except Exception:
            pass
        raise HTTPException(status_code=401, detail="Session expired - Please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    target = str(username).strip().lower()
    cached = _USER_CACHE.get(target)
    # 120-second TTL to eliminate database roundtrip latency during interactive sessions without delaying security changes
    if cached and (time.time() - cached["time"] < 120.0):
        u = cached["user"]
        try:
            u = db.merge(u, load=False)
        except Exception:
            pass
        if not u.is_active:
            _USER_CACHE.pop(target, None)
            raise HTTPException(status_code=403, detail="Account is deactivated")
        if u.locked_until and u.locked_until > datetime.utcnow():
            _USER_CACHE.pop(target, None)
            if u.locked_until.year >= 2099:
                raise HTTPException(status_code=403, detail="Account access has been restricted by an administrator.")
            remaining = max(1, int(math.ceil((u.locked_until - datetime.utcnow()).total_seconds() / 60.0)))
            raise HTTPException(status_code=403, detail=f"Account is temporarily locked. Try again in {remaining} minute{'s' if remaining != 1 else ''}.")
        
        # Enforce account-specific session policy on cached user
        if token_sid:
            validate_user_session(db, u, target, token_sid)
        return u

    try:
        user = db.query(User).options(joinedload(User.role)).filter(
            or_(
                func.lower(User.username) == target,
                func.lower(User.email) == target
            )
        ).first()
        if not user and str(username).isdigit():
            user = db.query(User).options(joinedload(User.role)).filter(User.user_id == int(username)).first()
        if user:
            _USER_CACHE[target] = {"user": user, "time": time.time()}
    except Exception as query_err:
        import db.database as db_mod
        # P0-5 (CRIT-5): Production PostgreSQL outages must fail safely — never
        # silently authenticate against a local SQLite file (which can be seeded
        # with default/weak owner-level credentials) while serving the live
        # production API.
        if db_mod.IS_PRODUCTION_ENV:
            print(f"[AUTH] PostgreSQL query failed in Production ({query_err}). Rejecting request (P0-5 — no SQLite failover in Production).")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable. Please try again shortly.")
        print(f"[AUTH OFFLINE RESILIENCE] get_current_user DB query failed ({query_err}). Auto-switching to offline SQLite...")
        try:
            db.close()
        except:
            pass
        fallback_session_maker = db_mod.switch_to_offline_sqlite()
        db = fallback_session_maker()
        user = db.query(User).filter(
            or_(
                func.lower(User.username) == target,
                func.lower(User.email) == target
            )
        ).first()
        if not user and str(username).isdigit():
            user = db.query(User).filter(User.user_id == int(username)).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found in system")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    if user.locked_until and user.locked_until > datetime.utcnow():
        _USER_CACHE.pop(target, None)
        if user.locked_until.year >= 2099:
            raise HTTPException(status_code=403, detail="Account access has been restricted by an administrator.")
        remaining = max(1, int(math.ceil((user.locked_until - datetime.utcnow()).total_seconds() / 60.0)))
        raise HTTPException(status_code=403, detail=f"Account is temporarily locked. Try again in {remaining} minute{'s' if remaining != 1 else ''}.")

    # Enforce account-specific session policy on fresh user load
    if token_sid:
        validate_user_session(db, user, target, token_sid)
        
    return user

def require_role(role_name):
    """
    OWASP A01: ENFORCE LEAST PRIVILEGE
    Decorator-style dependency for RBAC.
    Supports a single role string or a list/tuple of strings.
    """
    def role_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        roles = [role_name] if isinstance(role_name, str) else list(role_name)
        user_role = current_user.role.role_name

        if user_role == 'admin':
            return current_user

        if 'admin' in roles and len(roles) == 1:
            if user_role != 'admin':
                print(f"[SECURITY] Unauthorized access attempt by {current_user.username} (Role: {user_role}) to admin-only resource.")
                try:
                    from models import AuditLog
                    token_sid = getattr(current_user, '_current_token_sid', None)
                    db.add(AuditLog(
                        user_id=current_user.user_id,
                        username=current_user.username,
                        role_at_time=user_role,
                        action_type="AUTH_UNAUTHORIZED_ACCESS",
                        table_name="auth",
                        new_values={
                            "status": "unauthorized",
                            "attempted_role": user_role,
                            "required_roles": roles,
                            "session_id": str(token_sid)[:8] + "..." if token_sid else ""
                        },
                        created_at=datetime.utcnow()
                    ))
                    db.commit()
                except Exception:
                    try: db.rollback()
                    except Exception: pass
                raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
            return current_user

        if user_role == 'owner' and 'admin' not in roles:
            return current_user

        if user_role not in roles:
            print(f"[SECURITY] Unauthorized access attempt by {current_user.username} (Role: {user_role}) to {roles}-only resource.")
            try:
                from models import AuditLog
                token_sid = getattr(current_user, '_current_token_sid', None)
                db.add(AuditLog(
                    user_id=current_user.user_id,
                    username=current_user.username,
                    role_at_time=user_role,
                    action_type="AUTH_UNAUTHORIZED_ACCESS",
                    table_name="auth",
                    new_values={
                        "status": "unauthorized",
                        "attempted_role": user_role,
                        "required_roles": roles,
                        "session_id": str(token_sid)[:8] + "..." if token_sid else ""
                    },
                    created_at=datetime.utcnow()
                ))
                db.commit()
            except Exception:
                try: db.rollback()
                except Exception: pass
            raise HTTPException(status_code=403, detail="Unauthorized - Elevated permissions required")
            
        return current_user
    return role_checker

def sanitize_error(message: str) -> str:
    """OWASP A10: do not expose raw SQL / stack traces to clients or audit UIs."""
    return humanize_server_error(message)


def humanize_server_error(message: str) -> str:
    """
    Convert raw exception / SQLAlchemy text into a short Owner-readable sentence.
    Safe for Activity History Inspect and API error responses.
    """
    text = str(message or "").strip()
    if not text:
        return "An unexpected server error occurred. Please try again."

    lower = text.lower()

    if "not null constraint failed" in lower and "grand_total" in lower:
        return (
            "Historical order could not be saved because Grand Total was empty. "
            "Enter a grand total (or clear the discount and restore the total), then save again."
        )
    if "not null constraint failed" in lower:
        field = "a required field"
        if ":" in text:
            # e.g. NOT NULL constraint failed: historical_orders.grand_total
            try:
                field = text.split(":", 1)[1].strip().split()[0].split(".")[-1].replace("_", " ")
            except Exception:
                pass
        return f"Save blocked: {field} is required and was empty."

    if "unique constraint" in lower or "duplicate key" in lower:
        return "Save blocked: that value already exists (duplicate record)."

    if "foreign key" in lower:
        return "Save blocked: a related record is missing or invalid."

    if any(
        token in lower
        for token in (
            "sqlalchemy",
            "integrityerror",
            "operationalerror",
            "psycopg",
            "sqlite3",
            "[sql:",
            "background on this error",
        )
    ):
        return "A database operation failed. Please verify the form values and try again."

    if "traceback" in lower or "file \"" in lower:
        return "An unexpected server error occurred. Please try again."

    # Cap any residual message — never ship multi-KB SQL parameter dumps to the UI.
    cleaned = " ".join(text.split())
    if len(cleaned) > 180:
        cleaned = cleaned[:177].rstrip() + "…"
    return cleaned


LOCAL_VITE_ORIGIN = "http://localhost:5173"
LOCAL_AUTH_SPA_PATHS = {"login", "forgot-password", "reset-password"}


def _is_loopback_hostname(hostname: Optional[str]) -> bool:
    return (hostname or "").split("/")[0].split(":")[0].lower() in {"localhost", "127.0.0.1"}


def _loopback_vite_origin(url: str) -> Optional[str]:
    """Accept local Vite origins (5173, 5174, …). Never treat :8000 as the UI."""
    from urllib.parse import urlparse

    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or not _is_loopback_hostname(parsed.hostname):
        return None
    if parsed.port == 8000 or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def frontend_base_for_reset_link(host: str, origin: str = "", referer: str = "") -> str:
    """
    Password-reset emails must open the live UI, not the API process.

    Local Vite (5173+) posts to the API on :8000. Using the API Host header
    would send users to the stale FastAPI `dist/` build. Prefer the browser
    Origin (or Referer) when it is loopback Vite. Production keeps the public Host.
    """
    host = (host or "").strip()
    host_name = host.split(":")[0]

    if _is_loopback_hostname(host_name):
        for candidate in (origin, referer):
            vite_origin = _loopback_vite_origin(candidate)
            if vite_origin:
                return vite_origin
        env = (os.getenv("FRONTEND_URL") or LOCAL_VITE_ORIGIN).rstrip("/")
        return env

    clean_host = host.lower().split(":")[0]
    is_secure_host = (
        clean_host == "shoelotskey-villamor-pasay.app"
        or clean_host.endswith(".shoelotskey-villamor-pasay.app")
        or clean_host.endswith(".herokuapp.com")
        or clean_host.endswith(".app")
    )
    protocol = "https" if is_secure_host else "http"
    if host:
        return f"{protocol}://{host}"
    return (os.getenv("PUBLIC_APP_URL") or "https://shoelotskey-villamor-pasay.app").rstrip("/")


def local_vite_auth_redirect(host: str, path: str, query: str = "") -> Optional[str]:
    """Send local :8000 auth pages to Vite so reset links do not open stale dist UI."""
    host = (host or "").strip()
    host_name, _, port = host.partition(":")
    if not _is_loopback_hostname(host_name) or port != "8000":
        return None
    page = (path or "").split("/", 1)[0].split("?", 1)[0]
    if page not in LOCAL_AUTH_SPA_PATHS:
        return None
    origin = (os.getenv("FRONTEND_URL") or LOCAL_VITE_ORIGIN).rstrip("/")
    if host_name.lower() == "127.0.0.1":
        origin = origin.replace("://localhost", "://127.0.0.1")
    dest = f"{origin}/{page}"
    if query:
        dest = f"{dest}?{query}"
    return dest


# ==========================================
# GRANULAR PERMISSION ENGINE (PoLP & SoD)
# ==========================================

CANONICAL_PERMISSIONS = [
    {
        "code": "job_orders.view",
        "name": "View Job Orders",
        "description": "Allows Staff to view the Job Orders page and permitted Job Order details.",
        "category": "job_orders",
        "default_enabled": True
    },
    {
        "code": "job_orders.create",
        "name": "Create Job Orders",
        "description": "Allows Staff to create new Job Orders.",
        "category": "job_orders",
        "default_enabled": True
    },
    {
        "code": "job_orders.update",
        "name": "Update Job Orders",
        "description": "Allows Staff to edit permitted Job Order information and perform permitted status updates.",
        "category": "job_orders",
        "default_enabled": True
    },
    {
        "code": "job_orders.cancel",
        "name": "Cancel Job Orders",
        "description": "Allows Staff to initiate cancellation of an existing Job Order according to the system's cancellation rules.",
        "category": "job_orders",
        "default_enabled": True
    },
    {
        "code": "job_orders.authorize_cancel",
        "name": "Authorize Order Cancellations",
        "description": "Allows trusted Staff or supervisor to self-authorize order cancellations without secondary approval.",
        "category": "job_orders",
        "default_enabled": False
    },
    {
        "code": "job_orders.release",
        "name": "Process Claim / Release",
        "description": "Allows Staff to process claim verification and mark eligible Job Orders as claimed/released.",
        "category": "job_orders",
        "default_enabled": True
    },
    {
        "code": "payments.process",
        "name": "Process Payments",
        "description": "Allows Staff to record/process customer payments using the existing payment workflow.",
        "category": "payments",
        "default_enabled": True
    },
    {
        "code": "discounts.apply",
        "name": "Allow Applying Discounts",
        "description": "Allows Staff to view and select predefined discounts on job orders.",
        "category": "discounts",
        "default_enabled": True
    },
    {
        "code": "discounts.authorize",
        "name": "Authorize Standard Discounts",
        "description": "Allows this Staff member to authorize predefined system discounts when authorization is required.",
        "category": "discounts",
        "default_enabled": False
    },
    {
        "code": "discounts.use_auth_code",
        "name": "Use Authorization Code",
        "description": "Allows this Staff member to use the store authorization code for discounts and cancellations.",
        "category": "discounts",
        "default_enabled": False
    },
    {
        "code": "inventory.view",
        "name": "View Inventory",
        "description": "Allows Staff to view inventory records and stock information.",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.create_item",
        "name": "Add Item",
        "description": "Allows creating new inventory catalog items.",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.add_stock",
        "name": "Add Stock",
        "description": "Recording incoming purchase restocks.",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.use_stock",
        "name": "Use Stock",
        "description": "Allows deducting supplies used on job orders.",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.adjust_balance",
        "name": "Adjust Balances",
        "description": "Adjusting physical inventory counts and balances.",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.add",
        "name": "Add Stock / Restock",
        "description": "Allows Staff to add new stock, purchase restocking, and create new catalog items (Legacy).",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.edit",
        "name": "Use Stock & Adjust Balances",
        "description": "Allows Staff to record stock usage (deductions), reconcile physical count balances, and edit item details (Legacy).",
        "category": "inventory",
        "default_enabled": True
    },
    {
        "code": "inventory.deactivate",
        "name": "Deactivate Inventory",
        "description": "Allows Staff to deactivate/remove an eligible inventory item according to the safest existing inventory workflow.",
        "category": "inventory",
        "default_enabled": False
    },
]

DEFAULT_STAFF_PERMISSIONS = {
    p["code"]: p["default_enabled"] for p in CANONICAL_PERMISSIONS
}

def ensure_permissions_seeded(db: Session) -> List[Permission]:
    """Ensures all canonical permissions exist in the permissions table."""
    try:
        all_perms = db.query(Permission).all()
        existing_codes = {p.code for p in all_perms}
        added = False
        for p_def in CANONICAL_PERMISSIONS:
            if p_def["code"] not in existing_codes:
                p_row = Permission(
                    code=p_def["code"],
                    name=p_def["name"],
                    description=p_def["description"],
                    category=p_def["category"]
                )
                db.add(p_row)
                added = True
        if added:
            db.commit()
            all_perms = db.query(Permission).all()
        return all_perms
    except Exception:
        db.rollback()
        return db.query(Permission).all()

def get_effective_user_permissions(db: Session, user: User) -> Dict[str, Any]:
    """
    Returns effective permissions dictionary and enabled codes list.
    Owner/Admin accounts receive all permissions unconditionally.
    """
    role_name = (user.role.role_name if user.role else "").lower()
    all_codes = [p["code"] for p in CANONICAL_PERMISSIONS]

    if role_name in ("owner", "admin"):
        return {
            "permissions": all_codes,
            "is_owner_or_admin": True,
            "raw": {p["code"]: True for p in CANONICAL_PERMISSIONS},
            "summary": "Full Access" if role_name == "owner" else "Protected"
        }

    # Fetch stored user permissions
    stored_rows = (
        db.query(Permission.code, UserPermission.enabled)
        .join(UserPermission, UserPermission.permission_id == Permission.permission_id)
        .filter(UserPermission.user_id == user.user_id)
        .all()
    )

    perm_map: Dict[str, bool] = {}
    if stored_rows:
        for code, enabled in stored_rows:
            perm_map[code] = bool(enabled)
    else:
        # Default staff assignment if no records exist yet
        perm_map = {k: v for k, v in DEFAULT_STAFF_PERMISSIONS.items()}

    # Enforce dependencies:
    # If job_orders.view is False -> update, cancel, authorize_cancel, release cannot be effectively enabled
    if not perm_map.get("job_orders.view", False):
        perm_map["job_orders.update"] = False
        perm_map["job_orders.cancel"] = False
        perm_map["job_orders.authorize_cancel"] = False
        perm_map["job_orders.release"] = False

    # If inventory.view is False -> add, edit, deactivate cannot be effectively enabled
    if not perm_map.get("inventory.view", False):
        perm_map["inventory.add"] = False
        perm_map["inventory.edit"] = False
        perm_map["inventory.deactivate"] = False

    enabled_codes = [code for code, enabled in perm_map.items() if enabled]
    return {
        "permissions": enabled_codes,
        "is_owner_or_admin": False,
        "raw": perm_map,
        "summary": f"{len(enabled_codes)} / {len(CANONICAL_PERMISSIONS)} Enabled"
    }

def has_user_permission(user: User, permission_code: str, db: Optional[Session] = None) -> bool:
    """
    Live authoritative permission checker.
    Owner: Always True.
    Admin: Always True.
    Staff: Evaluated against database state and dependency rules.
    """
    if not user or not user.is_active:
        return False

    role_name = (user.role.role_name if user.role else "").lower()
    if role_name in ("owner", "admin"):
        return True

    if role_name not in ("staff", "front staff"):
        return False

    # If no db session passed, fallback to default for this code
    if db is None:
        return DEFAULT_STAFF_PERMISSIONS.get(permission_code, False)

    # Dependency check 1: Job orders dependent on job_orders.view
    if permission_code in ("job_orders.update", "job_orders.cancel", "job_orders.authorize_cancel", "job_orders.release"):
        if not has_user_permission(user, "job_orders.view", db):
            return False

    # Dependency check 2: Inventory dependent on inventory.view
    if permission_code in ("inventory.add", "inventory.edit", "inventory.deactivate", "inventory.create_item", "inventory.add_stock", "inventory.use_stock", "inventory.adjust_balance"):
        if not has_user_permission(user, "inventory.view", db):
            return False

    # Direct query against DB for live authoritative status
    row = (
        db.query(UserPermission.enabled)
        .join(Permission, UserPermission.permission_id == Permission.permission_id)
        .filter(UserPermission.user_id == user.user_id, Permission.code == permission_code)
        .first()
    )

    if row is not None:
        return bool(row[0])

    # Backward compatibility mappings
    if permission_code in ("inventory.create_item", "inventory.add_stock"):
        legacy_row = db.query(UserPermission.enabled).join(Permission).filter(UserPermission.user_id == user.user_id, Permission.code == "inventory.add").first()
        if legacy_row is not None:
            return bool(legacy_row[0])
    if permission_code in ("inventory.use_stock", "inventory.adjust_balance"):
        legacy_row = db.query(UserPermission.enabled).join(Permission).filter(UserPermission.user_id == user.user_id, Permission.code == "inventory.edit").first()
        if legacy_row is not None:
            return bool(legacy_row[0])
    
    # If not explicitly configured, fall back to canonical default
    return DEFAULT_STAFF_PERMISSIONS.get(permission_code, False)

def require_permission(permission_code: str):
    """
    OWASP A01: Authoritative Dependency for FastAPI Endpoints.
    Guarantees immediate live enforcement without waiting for token expiration.
    """
    def permission_dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        role_name = (current_user.role.role_name if current_user.role else "").lower()
        if role_name in ("owner", "admin"):
            return current_user

        if not has_user_permission(current_user, permission_code, db):
            print(f"[SECURITY] Permission denied: User '{current_user.username}' lacks permission '{permission_code}'.")
            try:
                from models import AuditLog
                token_sid = getattr(current_user, '_current_token_sid', None)
                db.add(AuditLog(
                    user_id=current_user.user_id,
                    username=current_user.username,
                    role_at_time=role_name,
                    action_type="AUTH_PERMISSION_DENIED",
                    table_name="auth",
                    new_values={
                        "status": "denied",
                        "attempted_permission": permission_code,
                        "session_id": str(token_sid)[:8] + "..." if token_sid else ""
                    },
                    created_at=datetime.utcnow()
                ))
                db.commit()
            except Exception:
                try: db.rollback()
                except Exception: pass

            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: You do not have permission to perform this action ({permission_code}). Contact the Owner if you believe access is required."
            )
        return current_user

    return permission_dependency

