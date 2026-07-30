import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
app = FastAPI()
@app.get("/api/test-health")
def test_health():
    return {"message": "If you see this, I am running from backend/test_health.py"}
