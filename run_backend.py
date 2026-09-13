import sys
import os

# Redirect standard outputs to log file
log_file = open("backend_boot.log", "w", encoding="utf-8")
sys.stdout = log_file
sys.stderr = log_file

try:
    import uvicorn
    print("Starting uvicorn on port 8000...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, app_dir="backend")
except Exception as e:
    print("Error starting uvicorn:", e)
finally:
    log_file.flush()
    log_file.close()
