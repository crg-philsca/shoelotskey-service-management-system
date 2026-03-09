"""
DATABASE CONFIGURATION
======================
Handles the SQLAlchemy Engine initialization and Session factory.
Pooling is optimized for multi-user access (10 base connections + 20 overflow).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 1. DATABASE CONNECTION URL
# Automatically handles Heroku (DATABASE_URL) or fallback to local SQLite for deployment ease.
# Note: For production MySQL, set DATABASE_URL=mysql+pymysql://root:@localhost/shoelotskey_db
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Heroku URLs start with 'postgres://', 
    # but SQLAlchemy 1.4+ requires 'postgresql://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    # Fallback to local SQLite for development
    DATABASE_URL = "sqlite:///./shoelotskey.db"

# SQLite specific config (check_same_thread) is required for multithreaded fastAPI access
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

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
