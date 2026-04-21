import os
from sqlalchemy import text
from database import engine, SessionLocal, is_sqlite

def deploy_stored_procedure():
    """Reads the SQL file and deploys the Stored Procedure directly into PostgreSQL."""
    
    # 1. Safety Check: Prevent execution on SQLite
    if is_sqlite:
        print("\n[ERROR] Aborting: You are currently running on the Offline SQLite database.")
        print("        Stored Procedures in PL/pgSQL require the active PostgreSQL cloud database.")
        print("        Toggle your Wi/Fi hotspot so your system connects to Heroku Postgres first.\n")
        return False
        
    db = SessionLocal()
    print("\n[INFO] Connecting to PostgreSQL to deploy Stored Procedure...")
    
    # The actual raw SQL combining table creation and procedure logic
    sql_script = """
    -- 1. Create the caching table (Data Warehouse principle)
    CREATE TABLE IF NOT EXISTS daily_analytics_summary (
        summary_date DATE PRIMARY KEY,
        total_revenue DECIMAL(10, 2) DEFAULT 0.0,
        total_job_orders INT DEFAULT 0
    );

    -- 2. Define the Stored Procedure natively inside the DB
    CREATE OR REPLACE PROCEDURE generate_daily_sales_summary()
    LANGUAGE plpgsql
    AS $$
    DECLARE
        target_date DATE := CURRENT_DATE - INTERVAL '1 day';
        calc_revenue DECIMAL(10,2);
        calc_orders INT;
    BEGIN
        -- Step A: Calculate totals from the normalized orders table for the previous day
        SELECT COALESCE(SUM(grand_total), 0.0), COUNT(order_id)
        INTO calc_revenue, calc_orders
        FROM orders
        WHERE DATE(created_at) = target_date;

        -- Step B: Upsert (Insert or Update) into the summary cache table
        INSERT INTO daily_analytics_summary (summary_date, total_revenue, total_job_orders)
        VALUES (target_date, calc_revenue, calc_orders)
        ON CONFLICT (summary_date) 
        DO UPDATE SET 
            total_revenue = EXCLUDED.total_revenue,
            total_job_orders = EXCLUDED.total_job_orders;
            
        RAISE NOTICE 'Stored Procedure Completed - %: % Revenue from % Orders', target_date, calc_revenue, calc_orders;
    END;
    $$;
    """

    try:
        # Deploy to database
        db.execute(text(sql_script))
        db.commit()
        print("[SUCCESS] Stored Procedure 'generate_daily_sales_summary' deployed to PostgreSQL.")
        print("          Panelist Defense: Ready to be invoked manually or via pg_cron at midnight.\n")
        return True
    except Exception as e:
        db.rollback()
        print(f"[FAILED] Could not deploy procedure: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    deploy_stored_procedure()
