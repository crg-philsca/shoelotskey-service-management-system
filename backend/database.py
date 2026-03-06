from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# MySQL Connection (Default for XAMPP/WAMP is root with no password)
# Format: mysql+pymysql://user:password@host/database_name
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost/shoelotskey_db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # MySQL specific connection settings (optional but good for stability)
    pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
