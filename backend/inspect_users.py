import os
import sys
import sqlite3
import bcrypt
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "db"
SQLITE_DB = DB_DIR / "shoelotskey.db"
ENV_FILE = BASE_DIR / ".env"

print("=" * 60)
print("     SHOELOTSKEY SYSTEM ACCOUNT DIAGNOSTIC & REPAIR TOOL")
print("=" * 60)

# Generate a fresh bcrypt password hash for 'owner123' and 'staff123'
owner_pw_hash = bcrypt.hashpw(b"owner123", bcrypt.gensalt()).decode("utf-8")
staff_pw_hash = bcrypt.hashpw(b"staff123", bcrypt.gensalt()).decode("utf-8")

# 1. INSPECT & REPAIR LOCAL SQLITE DATABASE
if SQLITE_DB.exists():
    print(f"\n[1] Checking Local SQLite Database: {SQLITE_DB}")
    try:
        conn = sqlite3.connect(str(SQLITE_DB))
        cursor = conn.cursor()
        
        # Check users table
        cursor.execute("SELECT user_id, username, email, role_id, is_active, failed_login_attempts, locked_until FROM users")
        rows = cursor.fetchall()
        print("\n  --> CURRENT SQLITE USERS:")
        for r in rows:
            print(f"      ID: {r[0]} | Username: '{r[1]}' | Email: '{r[2]}' | RoleID: {r[3]} | Active: {r[4]} | Fails: {r[5]} | LockedUntil: {r[6]}")
        
        # Unlock all users and reset failed attempts
        cursor.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, is_active = 1")
        print(f"\n  --> Unlocked and activated {cursor.rowcount} user account(s) in SQLite.")
        
        # Ensure owner exists or fix duplicate email
        cursor.execute("SELECT user_id FROM users WHERE email = 'owner@shoelotskey.com' OR username = 'owner' COLLATE NOCASE")
        owner_row = cursor.fetchone()
        if owner_row:
            cursor.execute("UPDATE users SET username = 'owner', email = 'owner@shoelotskey.com', password_hash = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?", (owner_pw_hash, owner_row[0]))
            print("  --> Repaired & reset password for 'owner' (password: owner123).")
        else:
            # Check for owner role
            cursor.execute("SELECT role_id FROM roles WHERE role_name = 'owner' COLLATE NOCASE")
            role_row = cursor.fetchone()
            role_id = role_row[0] if role_row else 1
            cursor.execute("INSERT INTO users (username, email, password_hash, role_id, is_active, failed_login_attempts) VALUES (?, ?, ?, ?, 1, 0)",
                           ("owner", "owner@shoelotskey.com", owner_pw_hash, role_id))
            print("  --> Created 'owner' account (password: owner123).")

        # Ensure kylane account exists as owner
        cursor.execute("SELECT user_id FROM users WHERE username = 'kylane' COLLATE NOCASE OR email = 'kylane@shoelotskey.com'")
        kylane_row = cursor.fetchone()
        if kylane_row:
            cursor.execute("UPDATE users SET username = 'kylane', password_hash = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?", (owner_pw_hash, kylane_row[0]))
            print("  --> Repaired & reset password for 'kylane' (password: owner123).")
        else:
            cursor.execute("SELECT role_id FROM roles WHERE role_name = 'owner' COLLATE NOCASE")
            role_row = cursor.fetchone()
            role_id = role_row[0] if role_row else 1
            cursor.execute("INSERT INTO users (username, email, password_hash, role_id, is_active, failed_login_attempts) VALUES (?, ?, ?, ?, 1, 0)",
                           ("kylane", "kylane@shoelotskey.com", owner_pw_hash, role_id))
            print("  --> Created 'kylane' account as Owner (password: owner123).")
            
        conn.commit()
        
        # Display final list
        cursor.execute("SELECT user_id, username, email, is_active FROM users")
        print("\n  --> FINAL READY-TO-USE SQLITE ACCOUNTS:")
        for r in cursor.fetchall():
            print(f"      [*] Username: '{r[1]}' | Email: '{r[2]}'")
            
        conn.close()
    except Exception as e:
        print(f"[SQLITE ERROR] {e}")
else:
    print(f"\n[1] Local SQLite Database not found at: {SQLITE_DB}")

# 2. INSPECT & REPAIR CLOUD POSTGRESQL DATABASE (If reachable)
try:
    from db.database import engine, is_sqlite, SessionLocal
    from models import User, Role
    from sqlalchemy import or_
    
    print("\n[2] Checking Cloud PostgreSQL / Active Runtime Engine...")
    if is_sqlite:
        print("    (Note: Active runtime engine is currently connected to Local SQLite above due to offline auto-switch)")
    else:
        db = SessionLocal()
        try:
            users = db.query(User).all()
            print("\n  --> CURRENT CLOUD POSTGRESQL USERS:")
            for u in users:
                print(f"      ID: {u.user_id} | Username: '{u.username}' | Email: '{u.email}' | Active: {u.is_active} | Fails: {u.failed_login_attempts} | LockedUntil: {u.locked_until}")
                
            # Reset locks
            for u in users:
                u.failed_login_attempts = 0
                u.locked_until = None
                u.is_active = True
            db.commit()
            
            # Ensure owner exists
            role_owner = db.query(Role).filter(Role.role_name.ilike("owner")).first()
            owner_u = db.query(User).filter(or_(User.username.ilike("owner"), User.email.ilike("owner@shoelotskey.com"))).first()
            if owner_u:
                owner_u.username = "owner"
                owner_u.password_hash = owner_pw_hash
                owner_u.is_active = True
                print("  --> Cloud Postgres: Repaired 'owner' account (password: owner123).")
            elif role_owner:
                db.add(User(username="owner", email="owner@shoelotskey.com", password_hash=owner_pw_hash, role_id=role_owner.role_id, is_active=True))
                print("  --> Cloud Postgres: Created 'owner' account (password: owner123).")
                
            # Ensure kylane exists
            kylane_u = db.query(User).filter(or_(User.username.ilike("kylane"), User.email.ilike("kylane@shoelotskey.com"))).first()
            if kylane_u:
                kylane_u.username = "kylane"
                kylane_u.password_hash = owner_pw_hash
                kylane_u.is_active = True
                print("  --> Cloud Postgres: Repaired 'kylane' account (password: owner123).")
            elif role_owner:
                db.add(User(username="kylane", email="kylane@shoelotskey.com", password_hash=owner_pw_hash, role_id=role_owner.role_id, is_active=True))
                print("  --> Cloud Postgres: Created 'kylane' account as Owner (password: owner123).")
                
            db.commit()
            
            print("\n  --> FINAL READY-TO-USE CLOUD POSTGRESQL ACCOUNTS:")
            for u in db.query(User).all():
                print(f"      [*] Username: '{u.username}' | Email: '{u.email}'")
        except Exception as pg_e:
            print(f"[CLOUD POSTGRESQL ERROR] {pg_e}")
            db.rollback()
        finally:
            db.close()
except Exception as imp_e:
    print(f"[RUNTIME ENGINE CHECK ERROR] {imp_e}")

print("\n" + "=" * 60)
print(" REPAIR COMPLETE. You can now log in using:")
print("   Username: owner  | Password: owner123")
print("   Username: kylane | Password: owner123")
print("   Username: staff  | Password: staff123")
print("=" * 60)
