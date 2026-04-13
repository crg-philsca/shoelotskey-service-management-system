import sys
import os

print("--- Shoelotskey SMS Dependency Diagnostic ---")
print(f"Python Executable: {sys.executable}")
print(f"Python Version: {sys.version}")

modules_to_test = [
    "fastapi",
    "fastapi.middleware.cors",
    "sqlalchemy",
    "sqlalchemy.orm",
    "fastapi.staticfiles",
    "fastapi.responses",
    "fastapi.templating",
    "bcrypt"
]

missing = []
for mod in modules_to_test:
    try:
        __import__(mod)
        print(f"[OK] Found: {mod}")
    except ImportError:
        print(f"[ERROR] Missing: {mod}")
        missing.append(mod)

if not missing:
    print("\nSUCCESS: All dependencies are installed in this environment.")
    print("If your IDE shows errors, please switch the Python Interpreter to this environment.")
else:
    print(f"\nFAILURE: {len(missing)} modules are missing.")
    print("Run: pip install -r requirements.txt")
