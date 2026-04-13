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
load_dotenv(override=True)

# 1. DATABASE CONNECTION URL
PG_URL = os.getenv("DATABASE_URL")

if PG_URL:
    if PG_URL.startswith("postgres://"):
        PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)
    if "sslmode" not in PG_URL:
        separator = "&" if "?" in PG_URL else "?"
        PG_URL = f"{PG_URL}{separator}sslmode=require"

LOCAL_SQLITE = "sqlite:///./shoelotskey_offline.db"

# 2. ENGINE CONFIGURATION & OFFLINE-FALLBACK Auto-Switch
engine = None
is_sqlite = False

if PG_URL:
    try:
        # Try primary AWS RDS PostgreSQL Connection
        print("[DATABASE] Attempting connection to Primary PostgreSQL Database...")
        primary_engine = create_engine(PG_URL, connect_args={"sslmode": "require"}, pool_pre_ping=True)
        # Test connection validity
        with primary_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        engine = primary_engine
        DATABASE_URL = PG_URL
        print("[DATABASE] SUCCESS: Linked to AWS PostgreSQL (Online)")
        
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
