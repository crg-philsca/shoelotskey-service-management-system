
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_orders():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT order_id, order_number, created_at FROM orders ORDER BY created_at DESC LIMIT 5")).fetchall()
        print("Last 5 orders in Database:")
        for row in result:
            print(f"ID: {row[0]}, Number: {row[1]}, Created At: {row[2]}")
            
        count = db.execute(text("SELECT COUNT(*) FROM orders")).scalar()
        print(f"\nTotal Orders: {count}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_orders()
