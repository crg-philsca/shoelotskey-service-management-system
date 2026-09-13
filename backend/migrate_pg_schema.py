import os
from dotenv import load_dotenv
load_dotenv("backend/.env")
from sqlalchemy import create_engine, text

pg_url = os.getenv("DATABASE_URL")
if pg_url and pg_url.startswith("postgres://"):
    pg_url = pg_url.replace("postgres://", "postgresql+psycopg://", 1)
if "sslmode" not in pg_url:
    separator = "&" if "?" in pg_url else "?"
    pg_url = f"{pg_url}{separator}sslmode=require"
if "sslnegotiation" not in pg_url:
    separator = "&" if "?" in pg_url else "?"
    pg_url = f"{pg_url}{separator}sslnegotiation=direct"

print(f"Connecting to PostgreSQL...")
engine = create_engine(
    pg_url, 
    connect_args={
        "connect_timeout": 15,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
)

with engine.begin() as conn:
    print("Adding missing columns to orders...")
    conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_stage VARCHAR(30);"))
    conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30);"))
    conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) DEFAULT 0.0;"))
    conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(255);"))
    conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;"))

    print("Adding missing columns to services...")
    conn.execute(text("ALTER TABLE services ADD COLUMN IF NOT EXISTS connected_addons JSON;"))

    print("Checking column list on orders...")
    cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='orders'")).fetchall()
    print("orders columns now:", [c[0] for c in cols])

print("SUCCESSFULLY MIGRATED POSTGRESQL SCHEMA!")
