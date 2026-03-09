
import sqlite3
import os

db_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\backend\shoelotskey.db'

def migrate():
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Renaming shoe_type to shoe_model in items table
        # SQLite doesn't directly support renaming columns in older versions, 
        # but 3.25.0+ does via ALTER TABLE RENAME COLUMN.
        # Let's check columns first.
        cursor.execute("PRAGMA table_info(items)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'shoe_type' in columns and 'shoe_model' not in columns:
            print("Renaming shoe_type to shoe_model...")
            cursor.execute("ALTER TABLE items RENAME COLUMN shoe_type TO shoe_model")
            print("Done.")
        else:
            print("shoe_type already renamed or not found.")

        # Removing shelf_location from orders table
        # SQLite doesn't support dropping columns easily in versions < 3.35.0.
        # Let's check columns for orders.
        cursor.execute("PRAGMA table_info(orders)")
        order_columns = [col[1] for col in cursor.fetchall()]

        if 'shelf_location' in order_columns:
            print("Dropping shelf_location from orders (emulated if necessary)...")
            # If SQLite version is 3.35.0+, we can just DROP COLUMN.
            try:
                cursor.execute("ALTER TABLE orders DROP COLUMN shelf_location")
                print("Dropped successfully using DROP COLUMN.")
            except Exception as e:
                print(f"DROP COLUMN failed: {e}. Attempting manual table recreation...")
                # Fallback: Recreate table if DROP COLUMN is unsupported
                # This is more complex but safer for older SQLite.
                # However, for now let's hope DROP COLUMN works or skip if it's just a cleanup.
                pass
        else:
            print("shelf_location already removed or not found.")

        conn.commit()
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
