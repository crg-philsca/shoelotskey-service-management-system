"""
DATABASE CONFIGURATION
======================
Handles the SQLAlchemy Engine initialization and Session factory.
Pooling is optimized for multi-user access (10 base connections + 20 overflow).
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from pathlib import Path
import bcrypt as _native_bcrypt
import urllib.parse

def _hash_pw(password: str) -> str:
    return _native_bcrypt.hashpw(password.encode('utf-8'), _native_bcrypt.gensalt()).decode('utf-8')

# Load variables from .env located in the parent backend/ folder
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=False)

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

# 2. DATABASE PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# [USER REQUEST] Using 'shoelotskey.db' located cleanly inside the dedicated db/ folder
LOCAL_SQLITE_PATH = os.path.join(BASE_DIR, "shoelotskey.db")
LOCAL_SQLITE = f"sqlite:///{LOCAL_SQLITE_PATH}"

# 3. ENGINE CONFIGURATION & OFFLINE-FALLBACK Auto-Switch
engine = None
is_sqlite = False
conn_error = None

try:
    if PG_URL:
        # 1. Fast Offline Check: Check TCP reachability within 1.5s so offline boot at school is instantaneous
        import socket
        try:
            parsed_url = urllib.parse.urlparse(PG_URL)
            host = parsed_url.hostname
            port = parsed_url.port or 5432
            if host:
                sock = socket.create_connection((host, port), timeout=1.5)
                sock.close()
        except Exception as sock_err:
            raise RuntimeError(f"Network offline or server unreachable in 1.5s ({sock_err}). Switching directly to offline fallback.")

        primary_engine = create_engine(
            PG_URL, 
            connect_args={
                "connect_timeout": 10,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5
            }, 
            pool_size=2,          # Optimal base size to prevent pool starvation
            max_overflow=4,       # Max 6 connections total per Uvicorn worker during traffic peaks
            pool_timeout=20,      # Give AWS RDS connection establishment sufficient buffer
            pool_pre_ping=True,   # Heartbeat check before checking out connections
            pool_recycle=60       # Recycle connections every 60s to avoid RDS silently terminating idle sockets
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
    print("[DATABASE] ACTION: Auto-Switching to Local SQLite Backup (Offline Mode)")
    engine = None

# If PG failed or no URL provided, lock in SQLite Offline Engine
if engine is None:
    DATABASE_URL = LOCAL_SQLITE
    is_sqlite = True
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    print("[DATABASE] SUCCESS: Linked to Local SQLite (Offline)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def ensure_sqlite_schema_and_defaults(target_engine):
    """
    Guarantees that Local SQLite database contains all updated schemas, columns, and default user credentials.
    Prevents Internal Server Errors (500) during offline login or offline user management.
    """
    try:
        from models import Base, User, Role
        from sqlalchemy import inspect as sql_inspect, text
        
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
                            col_type_str = "VARCHAR(255)" if str(col.type).startswith("VARCHAR") or str(col.type).startswith("String") else "INTEGER DEFAULT 0" if "INT" in str(col.type).upper() else "BOOLEAN DEFAULT 1" if "BOOL" in str(col.type).upper() else "TIMESTAMP NULL"
                            try:
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type_str}"))
                                print(f"[OFFLINE MIGRATION] Automatically added column '{col.name}' to local table '{table_name}'.")
                            except Exception:
                                pass
                                
        # 3. Ensure default Roles and Users exist so offline login and viewing users never fail
        from sqlalchemy.orm import sessionmaker
        SubSession = sessionmaker(bind=target_engine)
        with SubSession() as ldb:
            if ldb.query(Role).count() == 0:
                ldb.add(Role(role_name="owner"))
                ldb.add(Role(role_name="staff"))
                ldb.commit()
            if ldb.query(User).count() == 0:
                role_owner = ldb.query(Role).filter(Role.role_name == "owner").first()
                role_staff = ldb.query(Role).filter(Role.role_name == "staff").first()
                if role_owner:
                    ldb.add(User(username="owner", email="owner@shoelotskey.com", password_hash=_hash_pw("owner123"), role_id=role_owner.role_id, is_active=True))
                if role_staff:
                    ldb.add(User(username="staff", email="staff@shoelotskey.com", password_hash=_hash_pw("staff123"), role_id=role_staff.role_id, is_active=True))
                ldb.commit()
    except Exception as e:
        print(f"[OFFLINE SCHEMA WARNING] Non-fatal check: {e}")
        try:
            target_engine.dispose()
        except Exception:
            pass

if is_sqlite and engine is not None:
    ensure_sqlite_schema_and_defaults(engine)

def switch_to_offline_sqlite():
    """Dynamically failover to Local SQLite runtime engine when cloud connectivity drops."""
    global engine, is_sqlite, SessionLocal, DATABASE_URL
    if not is_sqlite:
        print("[HYBRID FAILOVER] Switching active runtime engine to Local SQLite (shoelotskey.db).")
        DATABASE_URL = LOCAL_SQLITE
        is_sqlite = True
        connect_args = {"check_same_thread": False}
        engine = create_engine(DATABASE_URL, connect_args=connect_args)
        ensure_sqlite_schema_and_defaults(engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal

def get_db():
    """
    DEPENDENCY: get_db
    Provides a database session for each API request.
    Includes dynamic runtime auto-switch to Local SQLite if Cloud Postgres drops or is offline.
    """
    global is_sqlite, SessionLocal
    db = SessionLocal()
    if not is_sqlite:
        try:
            # Lightweight health check before processing request
            db.execute(text("SELECT 1"))
        except Exception as e:
            print(f"[HYBRID AUTO-SWITCH] Postgres unreachable during request ({str(e)[:80]}...). Switching to offline SQLite.")
            db.close()
            new_session_maker = switch_to_offline_sqlite()
            db = new_session_maker()
    try:
        yield db
    finally:
        db.close()
