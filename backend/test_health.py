from fastapi import FastAPI
app = FastAPI()
@app.get("/api/test-health")
def test_health():
    return {"message": "If you see this, I am running from backend/test_health.py"}
