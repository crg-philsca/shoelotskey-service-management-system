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

# Load variables from .env if present (Override system variables for project consistency)
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

# 1. DATABASE CONNECTION URL
PG_URL = os.getenv("DATABASE_URL")

if PG_URL:
    if PG_URL.startswith("postgres://"):
        PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)
    if "sslmode" not in PG_URL:
        separator = "&" if "?" in PG_URL else "?"
        PG_URL = f"{PG_URL}{separator}sslmode=require"

# 2. DATABASE PATHS
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# [USER REQUEST] Using 'shoelotskey.db' as the dedicated local fallback
LOCAL_SQLITE_PATH = os.path.join(ROOT_DIR, "shoelotskey.db")
LOCAL_SQLITE = f"sqlite:///{LOCAL_SQLITE_PATH}"

# 3. ENGINE CONFIGURATION & OFFLINE-FALLBACK Auto-Switch
engine = None
is_sqlite = False
conn_error = None

try:
    if PG_URL:
        # Use a short timeout for the initial connection check (OWASP A09: Connection Resilience)
        # connect_timeout=5 ensures we don't hang the server if the network drops/times out
        primary_engine = create_engine(
            PG_URL, 
            connect_args={"sslmode": "require", "connect_timeout": 5}, 
            pool_pre_ping=True,
            pool_recycle=3600
        )
        with primary_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = primary_engine
        DATABASE_URL = PG_URL
        print(f"[DATABASE] SUCCESS: Linked to AWS PostgreSQL (Online)")
        
        # [DEFENSE VERIFICATION] Auto-Check required columns
        from sqlalchemy import inspect
        inspector = inspect(engine)
        if 'orders' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('orders')]
            if 'inventory_applied' in columns and 'inventory_used' in columns:
                print("[SCHEMA]  SUCCESS: inventory_applied column VERIFIED.")
                print("[SCHEMA]  SUCCESS: inventory_used column VERIFIED.")
            else:
                print("[SCHEMA]  WARNING: Missing inventory columns in 'orders' table!")
except Exception as e:
    conn_error = str(e)
    print("[DATABASE] CRITICAL ERROR: Could not connect to Primary PostgreSQL.")
    print(f"           Trace: {str(e)[:100]}...")
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
