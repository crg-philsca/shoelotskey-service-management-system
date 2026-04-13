import sqlite3
import os

db_path = r"c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\shoelotskey.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Safety Update: Reassign any orders using the soon-to-be-deleted values
    # Reassigning 'cancelled' orders to 'new-order'
    cursor.execute("UPDATE orders SET status_id = (SELECT status_id FROM status WHERE status_name = 'new-order') WHERE status_id = (SELECT status_id FROM status WHERE status_name = 'cancelled')")
    # Reassigning 'premium' priority to 'regular'
    cursor.execute("UPDATE orders SET priority_id = (SELECT priority_id FROM priority_levels WHERE priority_name = 'regular') WHERE priority_id = (SELECT priority_id FROM priority_levels WHERE priority_name = 'premium')")
    
    # 2. Deleting the lookup entries
    cursor.execute("DELETE FROM status WHERE status_name = 'cancelled'")
    cursor.execute("DELETE FROM priority_levels WHERE priority_name = 'premium'")
    
    conn.commit()
    conn.close()
    print("SUCCESS: Removed 'cancelled' status and 'premium' priority level from database.")
else:
    print(f"ERROR: Database not found at {db_path}")
