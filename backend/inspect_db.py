"""
SHOELOTSKEY DATABASE INSPECTOR (PostgreSQL & SQLite)
=====================================================
Run this script to view your database tables and records without relying on external UI tools like DBeaver!

Usage:
  - View all tables & record counts:
      python backend/inspect_db.py
  - Dump records from a specific table (e.g. audit_logs, orders, users, inventory):
      python backend/inspect_db.py audit_logs
"""

import sys
import os
import argparse
from tabulate import tabulate

# Ensure we can import from db module
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from db import engine, SessionLocal
    from sqlalchemy import text, inspect
except ImportError as e:
    print(f"[ERROR] Could not import database engine: {e}")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Shoelotskey Database Inspector")
    parser.add_argument("table", nargs="?", default=None, help="Table name to view records for (e.g. audit_logs, users, orders)")
    parser.add_argument("--limit", type=int, default=25, help="Maximum number of rows to display (default: 25)")
    args = parser.parse_args()

    print("\n" + "="*65)
    print("      SHOELOTSKEY SMS - DATABASE TABLE INSPECTOR")
    print("="*65)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if not args.table:
            print("\n[Connected Database Overview]")
            summary = []
            for t_name in sorted(tables):
                count_res = conn.execute(text(f"SELECT COUNT(*) FROM {t_name}")).scalar()
                columns = [col['name'] for col in inspector.get_columns(t_name)]
                summary.append([t_name, count_res, ", ".join(columns[:5]) + ("..." if len(columns) > 5 else "")])
            
            print(tabulate(summary, headers=["Table Name", "Total Records", "Preview Columns"], tablefmt="fancy_grid"))
            print("\n💡 Tip: To view rows from a specific table, run:")
            print("         venv\\Scripts\\python.exe backend\\inspect_db.py <table_name>")
            print("         (e.g. venv\\Scripts\\python.exe backend\\inspect_db.py audit_logs)\n")
        else:
            t_name = args.table.lower()
            if t_name not in tables:
                print(f"\n[ERROR] Table '{t_name}' does not exist in the database.")
                print(f"Available tables: {', '.join(tables)}\n")
                return
            
            print(f"\n[Showing up to {args.limit} latest records from table: '{t_name}']\n")
            
            # Select records
            res = conn.execute(text(f"SELECT * FROM {t_name} LIMIT {args.limit}"))
            rows = res.fetchall()
            keys = res.keys()
            
            if not rows:
                print(f" (Table '{t_name}' currently has 0 rows)")
            else:
                # Truncate long texts for terminal readability
                formatted_rows = []
                for row in rows:
                    formatted_rows.append([
                        (str(val)[:35] + '...') if val is not None and len(str(val)) > 38 else str(val)
                        for val in row
                    ])
                print(tabulate(formatted_rows, headers=keys, tablefmt="grid"))
            print("")

if __name__ == "__main__":
    main()
