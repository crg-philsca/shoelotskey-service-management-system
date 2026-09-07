import os
from sqlalchemy import create_engine, inspect

# 1. Connect to PostgreSQL
PG_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/shoelotskey")
try:
    pg_engine = create_engine(PG_URL)
    pg_inspector = inspect(pg_engine)
    if "historical_orders" in pg_inspector.get_table_names():
        print("PG historical_orders columns:")
        for col in pg_inspector.get_columns("historical_orders"):
            print(f"  - {col['name']} ({col['type']}), nullable={col['nullable']}")
    if "historical_items" in pg_inspector.get_table_names():
        print("PG historical_items columns:")
        for col in pg_inspector.get_columns("historical_items"):
            if col['name'] == 'item_price':
                print(f"  - {col['name']} ({col['type']}), nullable={col['nullable']}")
except Exception as e:
    print(f"PG Error: {e}")

# 2. Connect to SQLite
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db', 'shoelotskey.db')
try:
    sq_engine = create_engine(f"sqlite:///{db_path}")
    sq_inspector = inspect(sq_engine)
    if "historical_orders" in sq_inspector.get_table_names():
        print("SQLite historical_orders columns:")
        for col in sq_inspector.get_columns("historical_orders"):
            if col['name'] in ('expected_release_date', 'original_estimated_release_date'):
                print(f"  - {col['name']} ({col['type']}), nullable={col['nullable']}")
except Exception as e:
    print(f"SQLite Error: {e}")
