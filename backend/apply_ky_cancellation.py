import os, sqlite3
from datetime import datetime
from dotenv import load_dotenv
load_dotenv("backend/.env")
from sqlalchemy import create_engine, text

# 1. Update PG
pg_url = os.getenv("DATABASE_URL").replace("postgres://", "postgresql+psycopg://")
engine = create_engine(pg_url)
with engine.begin() as conn:
    conn.execute(text("""
        UPDATE orders 
        SET status_id = 4,
            cancellation_stage = 'new-order',
            refund_status = 'refunded',
            refund_amount = 325.00,
            refund_reason = 'Order cancelled before service commenced (full refund)',
            cancelled_at = :cancelled_at
        WHERE order_id = 643 OR order_number = 'ORD-2026-07-30-013'
    """), {"cancelled_at": datetime.now()})
    print("[PG] Successfully updated Order 643 to CANCELLED + REFUNDED (PHP 325.00)")

# 2. Update SQLite
sq = sqlite3.connect("backend/db/shoelotskey.db")
cur = sq.cursor()
cur.execute("""
    UPDATE orders 
    SET status_id = 4,
        cancellation_stage = 'new-order',
        refund_status = 'refunded',
        refund_amount = 325.00,
        refund_reason = 'Order cancelled before service commenced (full refund)',
        cancelled_at = ?
    WHERE order_id = 643 OR order_number = 'ORD-2026-07-30-013'
""", (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),))
sq.commit()
print("[SQLite] Successfully updated Order 643 to CANCELLED + REFUNDED (PHP 325.00)")
