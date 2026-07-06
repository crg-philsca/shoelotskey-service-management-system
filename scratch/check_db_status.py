from sqlalchemy import create_engine, text
import os

backend_path = r"c:\Users\charm\Desktop\Shoelotskey Service Management System\backend"
pg_url = "postgresql://u24tnl88dcgknd:p7d629ec3f3af1f2cf30757ec8efce446d3283727fcf9b50047204dcda6eae73f@cduf3or326qj7m.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d6281rp0p4pg8c"

# Engines
pg_eng = create_engine(pg_url)
sqlite_eng = create_engine(f"sqlite:///{backend_path}/../shoelotskey.db")

print("--- POSTGRESQL STATUS ---")
try:
    with pg_eng.connect() as conn:
        res = conn.execute(text("SELECT order_number, grand_total, created_at FROM orders WHERE order_number = 'ORD-2026-07-06-001'")).fetchall()
        print(f"PostgreSQL ORD-2026-07-06-001: {res}")
        
        health_cnt = conn.execute(text("SELECT COUNT(*) FROM orders WHERE order_number LIKE 'HEALTH-%'")).scalar()
        print(f"PostgreSQL HEALTH- order count: {health_cnt}")
except Exception as e:
    print(f"PG error: {e}")

print("--- SQLITE STATUS ---")
try:
    with sqlite_eng.connect() as conn:
        res = conn.execute(text("SELECT order_number, grand_total, created_at FROM orders WHERE order_number = 'ORD-2026-07-06-001'")).fetchall()
        print(f"SQLite ORD-2026-07-06-001: {res}")
        
        health_cnt = conn.execute(text("SELECT COUNT(*) FROM orders WHERE order_number LIKE 'HEALTH-%'")).scalar()
        print(f"SQLite HEALTH- order count: {health_cnt}")
except Exception as e:
    print(f"SQLite error: {e}")
