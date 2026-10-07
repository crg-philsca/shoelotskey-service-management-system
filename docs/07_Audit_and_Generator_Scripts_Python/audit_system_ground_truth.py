import os
import re

def analyze_system():
    print("=== CHECKPOINT 1: SYSTEM GROUND TRUTH INSPECTION ===")
    
    # 1. Inspect backend/database.py
    print("\n--- 1. DATABASE CONFIGURATION (backend/database.py) ---")
    if os.path.exists("backend/database.py"):
        with open("backend/database.py", "r", encoding="utf-8") as f:
            content = f.read()
            for line in content.splitlines():
                if any(k in line for k in ["SQLALCHEMY_DATABASE_URL", "create_engine", "sqlite", "postgres", "connect_args"]):
                    print("  ", line.strip())
    
    # 2. Inspect backend/auth_utils.py
    print("\n--- 2. AUTHENTICATION & SECURITY (backend/auth_utils.py) ---")
    if os.path.exists("backend/auth_utils.py"):
        with open("backend/auth_utils.py", "r", encoding="utf-8") as f:
            content = f.read()
            for line in content.splitlines():
                if any(k in line for k in ["ALGORITHM", "ACCESS_TOKEN_EXPIRE", "CryptContext", "bcrypt", "lockout", "MAX_LOGIN", "pwd_context"]):
                    print("  ", line.strip())

    # 3. Inspect backend/models.py for tables
    print("\n--- 3. DATABASE MODELS (backend/models.py) ---")
    if os.path.exists("backend/models.py"):
        with open("backend/models.py", "r", encoding="utf-8") as f:
            content = f.read()
            classes = re.findall(r'class\s+([A-Za-z0-9_]+)\(Base\):', content)
            tables = re.findall(r'__tablename__\s*=\s*[\'"]([A-Za-z0-9_]+)[\'"]', content)
            print(f"  Model Classes found ({len(classes)}):", classes)
            print(f"  Table Names found ({len(tables)}):", tables)

    # 4. Inspect backend/main.py endpoints & security
    print("\n--- 4. API ENDPOINTS & RBAC (backend/main.py) ---")
    if os.path.exists("backend/main.py"):
        with open("backend/main.py", "r", encoding="utf-8") as f:
            lines = f.readlines()
            endpoints = []
            role_guards = []
            for i, line in enumerate(lines):
                if re.match(r'@app\.(get|post|put|delete|patch)\(', line.strip()):
                    endpoints.append(line.strip())
                if "require_role" in line or "RoleChecker" in line:
                    role_guards.append((i+1, line.strip()))
            print(f"  Total REST endpoints found: {len(endpoints)}")
            print("  Sample endpoints (first 10):", endpoints[:10])
            print(f"  Role guard usages found ({len(role_guards)}):")
            for rg in role_guards[:8]:
                print(f"    Line {rg[0]}: {rg[1]}")

    # 5. Inspect backend/cache.py
    print("\n--- 5. CACHING IMPLEMENTATION (backend/cache.py) ---")
    if os.path.exists("backend/cache.py"):
        with open("backend/cache.py", "r", encoding="utf-8") as f:
            print(f.read()[:500])
            
    # 6. Inspect frontend routing & roles (src/app/App.tsx)
    print("\n--- 6. FRONTEND ROUTING & GUARDS (src/app/App.tsx) ---")
    if os.path.exists("src/app/App.tsx"):
        with open("src/app/App.tsx", "r", encoding="utf-8") as f:
            content = f.read()
            routes = re.findall(r'<Route\s+[^>]*path=[\'"]([^\'"]+)[\'"][^>]*>', content)
            print("  Frontend Routes found:", routes)
            for line in content.splitlines():
                if any(k in line for k in ["ProtectedRoute", "allowedRoles", "role", "navigate", "localStorage"]):
                    print("   ", line.strip()[:100])

if __name__ == "__main__":
    analyze_system()
