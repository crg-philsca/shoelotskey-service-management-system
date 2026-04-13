import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Look for .env in the backend folder
load_dotenv(os.path.join("backend", ".env"), override=True)

# 1. Get Connection URL
PG_URL = os.getenv("DATABASE_URL")
if PG_URL and PG_URL.startswith("postgres://"):
    PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)

if not PG_URL:
    print("ERROR: DATABASE_URL not found in .env file!")
    exit(1)

print(f"Connecting to: {PG_URL.split('@')[-1]}")

try:
    engine = create_engine(PG_URL, connect_args={"sslmode": "require"})
    
    with engine.connect() as conn:
        print("Connected! Verifying columns...")
        
        # SQL Commands to fix the orders table
        commands = [
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_applied BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_used JSONB DEFAULT '{}'::jsonb;",
            "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE username = 'owner';"
        ]
        
        for cmd in commands:
            print(f"Executing: {cmd}")
            conn.execute(text(cmd))
            conn.commit()
            
        print("\nSUCCESS: Database schema is now up to date!")
        print("You can now refresh your browser and log in.")

except Exception as e:
    print(f"\nERROR DURING FIX: {e}")
