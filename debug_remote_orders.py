import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

def check_remote_data():
    env_path = Path(__file__).parent / "backend" / ".env"
    load_dotenv(dotenv_path=env_path)
    url = os.getenv("DATABASE_URL")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)
    with engine.connect() as conn:
        print("\n--- RECENT ORDERS (Last 20) ---")
        result = conn.execute(text("SELECT order_number, created_at FROM orders ORDER BY created_at DESC LIMIT 20"))
        for row in result:
            print(f"Order: {row[0]} | Date: {row[1]}")

if __name__ == "__main__":
    check_remote_data()
