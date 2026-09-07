import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv
import sqlite3
import json

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '.env'))

results = {}

# 1. Postgres
pg_url = os.getenv("DATABASE_URL")
if pg_url:
    if pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)
    try:
        engine = create_engine(pg_url)
        insp = inspect(engine)
        tables = insp.get_table_names()
        
        ho_cols = []
        if "historical_orders" in tables:
            ho_cols = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"]} for c in insp.get_columns("historical_orders")]
            
        hi_cols = []
        if "historical_items" in tables:
            hi_cols = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"]} for c in insp.get_columns("historical_items")]
            
        results["postgres"] = {"historical_orders": ho_cols, "historical_items": hi_cols, "error": None}
    except Exception as e:
        results["postgres"] = {"error": str(e)}

# 2. SQLite
sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'db', 'shoelotskey.db')
try:
    engine = create_engine(f"sqlite:///{sqlite_path}")
    insp = inspect(engine)
    tables = insp.get_table_names()
    
    ho_cols = []
    if "historical_orders" in tables:
        ho_cols = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"]} for c in insp.get_columns("historical_orders")]
        
    hi_cols = []
    if "historical_items" in tables:
        hi_cols = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"]} for c in insp.get_columns("historical_items")]
        
    results["sqlite"] = {"historical_orders": ho_cols, "historical_items": hi_cols, "error": None}
except Exception as e:
    results["sqlite"] = {"error": str(e)}

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audit_results.json')
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2)
