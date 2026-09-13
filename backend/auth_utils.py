import jwt
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from models import User, Role
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

# --- OWASP A04: CRYPTOGRAPHIC FAILURES PREVENTION ---
# (Usingbcrypt in main.py, keeping simple for this utility)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generates a secure JWT for session management (OWASP A07)."""
    to_encode = data.copy()
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
                    from datetime import datetime, timedelta, timezone
                    
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
    # 30-second TTL to avoid database latency during interactive sessions without delaying security changes
    if cached and (time.time() - cached["time"] < 30.0):
        u = cached["user"]
        if not u.is_active:
            _USER_CACHE.pop(target, None)
            raise HTTPException(status_code=403, detail="Account is deactivated")
        return u

    try:
        user = db.query(User).filter(
            or_(
                func.lower(User.username) == target,
                func.lower(User.email) == target
            )
        ).first()
        if not user and str(username).isdigit():
            user = db.query(User).filter(User.user_id == int(username)).first()
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
        
    return user

def require_role(role_name):
    """
    OWASP A01: ENFORCE LEAST PRIVILEGE
    Decorator-style dependency for RBAC.
    Supports a single role string or a list/tuple of strings.
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        roles = [role_name] if isinstance(role_name, str) else list(role_name)
        user_role = current_user.role.role_name

        if user_role == 'admin':
            return current_user

        if 'admin' in roles and len(roles) == 1:
            if user_role != 'admin':
                print(f"[SECURITY] Unauthorized access attempt by {current_user.username} (Role: {user_role}) to admin-only resource.")
                raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
            return current_user

        if user_role == 'owner' and 'admin' not in roles:
            return current_user

        if user_role not in roles:
            print(f"[SECURITY] Unauthorized access attempt by {current_user.username} (Role: {user_role}) to {roles}-only resource.")
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
