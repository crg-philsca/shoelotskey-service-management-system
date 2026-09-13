import os
from dotenv import load_dotenv
load_dotenv("backend/.env")
from sqlalchemy import create_engine, text

pg_url = os.getenv("DATABASE_URL").replace("postgres://", "postgresql+psycopg://")
engine = create_engine(pg_url)

proc_sql = """
CREATE OR REPLACE PROCEDURE generate_daily_sales_summary()
LANGUAGE plpgsql
AS $$
DECLARE
    target_date DATE := CURRENT_DATE - INTERVAL '1 day';
    calc_revenue DECIMAL(10,2);
    calc_orders INT;
BEGIN
    -- Step A: Calculate totals from the normalized orders table for the previous day
    -- Lessening refunds, and retaining forfeited cancellation deposits
    SELECT COALESCE(SUM(
        CASE 
            WHEN status_id = 4 THEN (
                COALESCE((SELECT COALESCE(SUM(p.amount_received), 0.0) FROM payments p WHERE p.order_id = orders.order_id), 0.0) 
                - COALESCE(refund_amount, 0.0)
            )
            ELSE grand_total - COALESCE(refund_amount, 0.0)
        END
    ), 0.0), 
    COUNT(CASE WHEN status_id != 4 THEN order_id END)
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

with engine.begin() as conn:
    conn.execute(text(proc_sql))
    print("[SUCCESS] Stored Procedure redeployed cleanly to PostgreSQL!")
