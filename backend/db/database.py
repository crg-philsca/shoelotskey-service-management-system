"""
DATABASE CONFIGURATION
======================
Handles the SQLAlchemy Engine initialization and Session factory.
Pooling is optimized for multi-user access (10 base connections + 20 overflow).
"""

import os
from sqlalchemy import create_engine, text, inspect as sql_inspect, or_, func # type: ignore # pyre-ignore
from sqlalchemy.orm import sessionmaker # type: ignore # pyre-ignore
from dotenv import load_dotenv # type: ignore # pyre-ignore
from pathlib import Path
from fastapi import HTTPException # type: ignore # pyre-ignore
import bcrypt as _native_bcrypt # type: ignore # pyre-ignore
import urllib.parse

def _hash_pw(password: str) -> str:
    return _native_bcrypt.hashpw(password.encode('utf-8'), _native_bcrypt.gensalt()).decode('utf-8')

# Load variables from .env located in the parent backend/ folder
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=False)

# --- P0-2 / P0-5: ENVIRONMENT SEPARATION -----------------------------------
# Mirrors the exact "is this Heroku?" check already used in auth_utils.py/main.py:
# Heroku always injects PORT for the web dyno; local dev (uvicorn --port 8000 via
# run.bat/npm run server) never sets a PORT env var.
IS_PRODUCTION_ENV = bool(os.getenv("PORT")) or os.getenv("ENV", "").strip().lower() == "production"
_LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1", ""}

# 1. DATABASE CONNECTION URL
PG_URL = os.getenv("DATABASE_URL")

if PG_URL:
    if PG_URL.startswith("postgres://"):
        PG_URL = PG_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif PG_URL.startswith("postgresql://") and not PG_URL.startswith("postgresql+"):
        PG_URL = PG_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    if "sslmode" not in PG_URL:
        separator = "&" if "?" in PG_URL else "?"
        PG_URL = f"{PG_URL}{separator}sslmode=require"
    if "sslnegotiation" not in PG_URL:
        separator = "&" if "?" in PG_URL else "?"
        PG_URL = f"{PG_URL}{separator}sslnegotiation=direct"

    # P0-2: Outside Production, remote DATABASE_URL is blocked by default to prevent
    # accidental pollution, but can be explicitly enabled during Evaluation phase via ALLOW_REMOTE_DB=true.
    if not IS_PRODUCTION_ENV and os.getenv("ALLOW_REMOTE_DB", "").strip().lower() != "true":
        try:
            _host = (urllib.parse.urlparse(PG_URL).hostname or "").lower()
        except Exception:
            _host = None
        if _host not in _LOCAL_DB_HOSTS:
            print(f"[DATABASE][P0-2 GUARD] Refusing remote DATABASE_URL host '{_host}' while running in Localhost mode. "
                  f"To connect to remote PostgreSQL for evaluation demos, set ALLOW_REMOTE_DB=true in backend/.env. Falling back to local SQLite.")
            PG_URL = None

# 2. DATABASE PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# [USER REQUEST] Using 'shoelotskey.db' located cleanly inside the dedicated db/ folder.
# Use POSIX slashes so every SQLAlchemy connection opens the same Windows file
# (backslashes in sqlite:///C:\... can resolve to a different path than C:/...).
LOCAL_SQLITE_PATH = os.path.abspath(os.path.join(BASE_DIR, "shoelotskey.db"))
LOCAL_SQLITE = "sqlite:///" + Path(LOCAL_SQLITE_PATH).as_posix()

# 3. ENGINE CONFIGURATION & OFFLINE-FALLBACK Auto-Switch
engine = None
is_sqlite = False
conn_error = None
# P0-5: True only when running in Production AND PostgreSQL is unreachable. In this
# state, NO SQLite fallback is permitted anywhere (module import, get_db(), or the
# auth layer) — the API must fail safely (503) rather than silently serving a local
# SQLite file with seeded default/weak credentials.
DB_UNAVAILABLE = False

try:
    if PG_URL:
        # 1. Fast Offline Check: Check TCP reachability within 8.0s so offline boot at school is fast while allowing normal US-East network latency
        import socket
        try:
            parsed_url = urllib.parse.urlparse(PG_URL)
            host = parsed_url.hostname
            port = parsed_url.port or 5432
            if host:
                sock = socket.create_connection((host, port), timeout=8.0)
                sock.close()
        except Exception as sock_err:
            raise RuntimeError(f"Network offline or server unreachable in 8.0s ({sock_err}). Switching directly to offline fallback.")

        from sqlalchemy.pool import NullPool
        primary_engine = create_engine(
            PG_URL, 
            connect_args={
                "connect_timeout": 15,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5
            }, 
            poolclass=NullPool
        )
        with primary_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = primary_engine
        DATABASE_URL = PG_URL
        print(f"[DATABASE] SUCCESS: Linked to Primary PostgreSQL (Online)")
        print("[SCHEMA]  SUCCESS: Schema validation deferred to main application startup.")
except Exception as e:
    conn_error = str(e)
    print(f"[DATABASE] CRITICAL ERROR / OFFLINE DETECTED: {conn_error}")
    if IS_PRODUCTION_ENV:
        # P0-5: Production PostgreSQL must NEVER silently fail over to SQLite.
        print("[DATABASE][P0-5 GUARD] Running in Production — refusing SQLite fallback. "
              "DB-dependent routes will report 503 Service Unavailable until PostgreSQL recovers.")
        DB_UNAVAILABLE = True
    else:
        print("[DATABASE] ACTION: Auto-Switching to Local SQLite Backup (Offline Mode) — Localhost/defense continuity only.")
    engine = None

# If PG failed or no URL provided (and we're not in the Production-outage lockout
# state above), lock in SQLite Offline Engine for local/offline continuity.
if engine is None and not DB_UNAVAILABLE:
    DATABASE_URL = LOCAL_SQLITE
    is_sqlite = True
    connect_args = {"check_same_thread": False, "timeout": 30}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    print("[DATABASE] SUCCESS: Linked to Local SQLite (Offline)")
elif DB_UNAVAILABLE:
    # Keep a lazy (not-yet-verified) engine bound so module import / SessionLocal
    # construction never crashes the dyno. get_db() explicitly checks
    # DB_UNAVAILABLE and returns HTTP 503 before ever handing out a session from
    # this engine, and re-probes PostgreSQL on each request so service resumes
    # automatically once connectivity is restored.
    from sqlalchemy.pool import NullPool
    DATABASE_URL = PG_URL
    engine = create_engine(PG_URL, poolclass=NullPool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def checkpoint_sqlite(target_engine=None):
    """Flush WAL into shoelotskey.db so created users survive process/OS restart."""
    eng = target_engine
    if eng is None:
        if engine is None or "sqlite" not in str(engine.url):
            return
        eng = engine
    elif "sqlite" not in str(eng.url):
        return
    try:
        with eng.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
            conn.commit()
    except Exception as e:
        print(f"[SQLITE] WAL checkpoint warning: {e}")


def upsert_user_in_session(session, username, email, password_hash, role_name, is_active=True):
    """Insert or update a user by username/email without changing other accounts."""
    from models import User, Role
    from sqlalchemy import func, or_

    role = session.query(Role).filter(func.lower(Role.role_name) == str(role_name).lower()).first()
    if not role:
        role = Role(role_name=str(role_name).lower())
        session.add(role)
        session.flush()

    existing = session.query(User).filter(
        or_(
            func.lower(User.username) == str(username).lower(),
            func.lower(User.email) == str(email).lower(),
        )
    ).first()
    if existing:
        existing.username = username
        existing.email = email
        existing.role_id = role.role_id
        existing.is_active = is_active
        if password_hash:
            existing.password_hash = password_hash
        return existing

    new_user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role_id=role.role_id,
        is_active=is_active,
    )
    session.add(new_user)
    return new_user


def persist_user_to_sqlite_file(username, email, password_hash, role_name, is_active=True):
    """
    Always write the account into the durable local SQLite file.

    Live requests may already be on this file; this second write is idempotent
    and then checkpoints WAL so a restart cannot drop the new row.
    """
    if IS_PRODUCTION_ENV:
        return
    try:
        from models import Base
        sqlite_engine = create_engine(
            LOCAL_SQLITE,
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        Base.metadata.create_all(bind=sqlite_engine)
        ensure_sqlite_schema_and_defaults(sqlite_engine)
        SubSession = sessionmaker(bind=sqlite_engine)
        with SubSession() as ldb:
            upsert_user_in_session(ldb, username, email, password_hash, role_name, is_active)
            ldb.commit()
        checkpoint_sqlite(sqlite_engine)
        sqlite_engine.dispose()
    except Exception as e:
        print(f"[USER PERSIST] Failed to flush account '{username}' to local SQLite: {e}")


def reconcile_sqlite_users_into_session(db):
    """
    Copy any users that exist only in the local SQLite file into the active
    session (PostgreSQL or SQLite). Never deletes accounts.
    """
    if IS_PRODUCTION_ENV or db is None:
        return 0
    if "sqlite" in str(getattr(db.bind, "url", "")):
        checkpoint_sqlite(db.bind)
        return 0
    try:
        from models import User, Role
        sqlite_engine = create_engine(
            LOCAL_SQLITE,
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        SubSession = sessionmaker(bind=sqlite_engine)
        added = 0
        with SubSession() as ldb:
            local_users = ldb.query(User).all()
            for lu in local_users:
                role_name = lu.role.role_name if lu.role else "staff"
                existing = db.query(User).filter(
                    or_(
                        func.lower(User.username) == lu.username.lower(),
                        func.lower(User.email) == (lu.email or "").lower(),
                    )
                ).first()
                if existing:
                    continue
                upsert_user_in_session(
                    db, lu.username, lu.email, lu.password_hash, role_name, bool(lu.is_active)
                )
                added += 1
            if added:
                db.commit()
        sqlite_engine.dispose()
        if added:
            print(f"[USER PERSIST] Reconciled {added} local SQLite account(s) into the active database.")
        return added
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[USER PERSIST] Startup user reconcile warning: {e}")
        return 0


def ensure_sqlite_schema_and_defaults(target_engine):
    """
    Guarantees that Local SQLite database contains all updated schemas, columns, and default user credentials.
    Prevents Internal Server Errors (500) during offline login or offline user management.
    """
    try:
        from models import Base, User, Role # type: ignore # pyre-ignore # pyrefly: ignore # pyrefly-ignore
        
        # 0. Enable WAL mode for high concurrency
        with target_engine.begin() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL;"))
            conn.execute(text("PRAGMA synchronous=NORMAL;"))

        # 1. Create any missing tables in SQLite
        Base.metadata.create_all(bind=target_engine)
        
        # 2. Inspect and migrate any missing columns on existing SQLite tables
        inspector = sql_inspect(target_engine)
        with target_engine.begin() as conn:
            for table_name, table_obj in Base.metadata.tables.items():
                if table_name in inspector.get_table_names():
                    existing_cols = {c['name'] for c in inspector.get_columns(table_name)}
                    for col in table_obj.columns:
                        if col.name not in existing_cols:
                            col_type_upper = str(col.type).upper()
                            if col_type_upper.startswith("VARCHAR") or col_type_upper.startswith("STRING") or "TEXT" in col_type_upper:
                                col_type_str = "VARCHAR(255)"
                            elif "INT" in col_type_upper:
                                col_type_str = "INTEGER DEFAULT 0"
                            elif "NUMERIC" in col_type_upper or "FLOAT" in col_type_upper or "DECIMAL" in col_type_upper:
                                col_type_str = "NUMERIC(10, 2) DEFAULT 0.00"
                            elif "BOOL" in col_type_upper:
                                col_type_str = "BOOLEAN DEFAULT 1" if col.name == "is_active" else "BOOLEAN DEFAULT 0"
                            elif "TIME" in col_type_upper or "DATE" in col_type_upper:
                                col_type_str = "TIMESTAMP NULL"
                            else:
                                col_type_str = "VARCHAR(255)"
                            try:
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type_str}"))
                                print(f"[OFFLINE MIGRATION] Automatically added column '{col.name}' to local table '{table_name}'.")
                            except Exception:
                                pass
                                
        # 3. Clean up legacy/corrupted states in local SQLite
        with target_engine.begin() as conn:
            try:
                conn.execute(text("UPDATE services SET is_active = 0 WHERE service_name IN ('Midsole Full Reglue', 'Undersole Full Reglue');"))
            except Exception:
                pass
            try:
                conn.execute(text("UPDATE inventory SET is_retail = 0 WHERE (retail_price IS NULL OR retail_price <= 0) AND is_retail = 1;"))
            except Exception:
                pass

        # 4. Ensure default Roles and Users exist so offline login and viewing users never fail
        SubSession = sessionmaker(bind=target_engine)
        with SubSession() as ldb:
            if ldb.query(Role).count() == 0:
                ldb.add(Role(role_name="owner"))
                ldb.add(Role(role_name="staff"))
                ldb.add(Role(role_name="admin"))
                ldb.commit()
            role_owner = ldb.query(Role).filter(Role.role_name == "owner").first()
            role_staff = ldb.query(Role).filter(Role.role_name == "staff").first()
            if ldb.query(Role).filter(Role.role_name == "admin").first() is None:
                ldb.add(Role(role_name="admin"))
                ldb.commit()
            
            # Unlock all accounts in SQLite
            for u in ldb.query(User).all():
                u.failed_login_attempts = 0
                u.locked_until = None
                u.is_active = True

            # P0-5 (CRIT-5): Never auto-provision default/weak owner-privilege credentials
            # while running in Production. This seeding path exists solely so a genuine
            # LOCAL/offline defense environment always has working demo accounts; on
            # Heroku it must be a strict no-op even though the SQLite file itself is
            # never reachable via the API in Production (see DB_UNAVAILABLE / P0-5 guards
            # in get_db() and switch_to_offline_sqlite()) — this is defense-in-depth.
            if role_owner and not IS_PRODUCTION_ENV:
                owner_u = ldb.query(User).filter(or_(User.username == "owner", User.email == "owner@shoelotskey.com")).first()
                if not owner_u:
                    ldb.add(User(username="owner", email="owner@shoelotskey.com", password_hash=_hash_pw("owner123"), role_id=role_owner.role_id, is_active=True))
                    
                kylane_u = ldb.query(User).filter(or_(User.username == "kylane", User.email == "kylane@shoelotskey.com")).first()
                if not kylane_u:
                    ldb.add(User(username="kylane", email="kylane@shoelotskey.com", password_hash=_hash_pw("owner123"), role_id=role_owner.role_id, is_active=True))
                    
            if role_staff and not IS_PRODUCTION_ENV:
                staff_u = ldb.query(User).filter(or_(User.username == "staff", User.email == "staff@shoelotskey.com")).first()
                if not staff_u:
                    ldb.add(User(username="staff", email="staff@shoelotskey.com", password_hash=_hash_pw("staff123"), role_id=role_staff.role_id, is_active=True))
                    
            ldb.commit()
        checkpoint_sqlite(target_engine)
    except Exception as e:
        print(f"[OFFLINE SCHEMA WARNING] Non-fatal check: {e}")
        try:
            target_engine.dispose()
        except Exception:
            pass

if is_sqlite and engine is not None:
    ensure_sqlite_schema_and_defaults(engine)

def switch_to_offline_sqlite():
    """
    Dynamically failover to Local SQLite runtime engine when cloud connectivity drops.

    P0-5 (CRIT-5): This must NEVER run while IS_PRODUCTION_ENV is True — production
    PostgreSQL outages must fail safely (503), not silently swap the live API onto a
    local SQLite file seeded with default/weak owner-level credentials. Every caller
    (get_db() below, and auth_utils.get_current_user()'s offline-resilience path)
    checks IS_PRODUCTION_ENV before calling this; the guard here is defense-in-depth
    in case a future caller forgets to.
    """
    global engine, is_sqlite, SessionLocal, DATABASE_URL
    if IS_PRODUCTION_ENV:
        raise RuntimeError("SECURITY (P0-5): switch_to_offline_sqlite() must not run in Production.")
    if not is_sqlite:
        print("[HYBRID FAILOVER] Switching active runtime engine to Local SQLite (shoelotskey.db).")
        is_sqlite = True
        DATABASE_URL = LOCAL_SQLITE
        connect_args = {"check_same_thread": False, "timeout": 30}
        engine = create_engine(DATABASE_URL, connect_args=connect_args)
        ensure_sqlite_schema_and_defaults(engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal

_DB_UNAVAILABLE_MSG = (
    "Database service is temporarily unavailable. Production PostgreSQL is unreachable; "
    "no local fallback is used for the live production database. Please try again shortly."
)

def get_db():
    """
    DEPENDENCY: get_db
    Provides a database session for each API request.

    LOCAL/OFFLINE: Includes dynamic runtime auto-switch to Local SQLite if Postgres
    drops or is unreachable (legitimate offline/defense continuity).

    PRODUCTION (P0-5): NEVER auto-switches to SQLite. If PostgreSQL is unreachable,
    every request gets a clear HTTP 503 instead of silently being served stale/local
    data. Connectivity is re-probed on each call so service resumes automatically
    the moment PostgreSQL is reachable again — no restart required.
    """
    global is_sqlite, SessionLocal, DB_UNAVAILABLE, engine

    if DB_UNAVAILABLE:
        # Attempt a lazy recovery probe — PostgreSQL may have come back online.
        try:
            with engine.connect() as probe:
                probe.execute(text("SELECT 1"))
            print("[DATABASE][P0-5] PostgreSQL connectivity restored. Resuming normal Production operation.")
            DB_UNAVAILABLE = False
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        except Exception:
            raise HTTPException(status_code=503, detail=_DB_UNAVAILABLE_MSG)

    db = SessionLocal()
    if not is_sqlite:
        try:
            # Lightweight health check before processing request
            db.execute(text("SELECT 1"))
        except Exception as e:
            try:
                db.close()
            except Exception:
                pass
            if IS_PRODUCTION_ENV:
                print(f"[DATABASE][P0-5] PostgreSQL became unreachable mid-request: {e}")
                DB_UNAVAILABLE = True
                raise HTTPException(status_code=503, detail=_DB_UNAVAILABLE_MSG)
            print(f"[HYBRID AUTO-SWITCH] Postgres unreachable during request. Switching to offline SQLite.")
            new_session_maker = switch_to_offline_sqlite()
            db = new_session_maker()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception as e:
            # Handle cases where the server closes the connection during the session rollback
            print(f"[DB SESSION CLEANUP] Ignored error closing session: {e}")
