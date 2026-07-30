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
import urllib.parse

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

def get_db():
    """
    DEPENDENCY: get_db
    Provides a database session for each API request.
    Ensures safe closing of connections after transaction.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
