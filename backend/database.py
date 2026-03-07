from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# MySQL Connection (Default for XAMPP/WAMP is root with no password)
# Format: mysql+pymysql://user:password@host/database_name
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost/shoelotskey_db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,            # Maintain 10 active connections
    max_overflow=20,         # Allow up to 30 total connections
    pool_recycle=3600,       # Reset connections every hour
    pool_pre_ping=True       # Check if connection is alive before using
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
