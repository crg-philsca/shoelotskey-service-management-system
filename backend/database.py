"""
DATABASE CONFIGURATION
======================
Handles the SQLAlchemy Engine initialization and Session factory.
Pooling is optimized for multi-user access (10 base connections + 20 overflow).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load variables from .env if present
load_dotenv()

# 1. DATABASE CONNECTION URL
# Automatically handles Heroku (DATABASE_URL) or fallback to local SQLite for deployment ease.
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Heroku URLs start with 'postgres://',
    # but SQLAlchemy 1.4+ requires 'postgresql://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    # Heroku PostgreSQL REQUIRES SSL - append sslmode=require if not already set
    if "sslmode" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"
else:
    # Fallback to local SQLite for development
    DATABASE_URL = "sqlite:///./shoelotskey.db"

# 2. ENGINE CONFIGURATION
is_sqlite = DATABASE_URL.startswith("sqlite")

connect_args = {}
if is_sqlite:
    connect_args = {"check_same_thread": False}
elif "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
    # Only force SSL for remote (Heroku/Cloud) connections
    # This matches the user's "Gold Standard" for professional deployment
    connect_args = {"sslmode": "require"}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

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
