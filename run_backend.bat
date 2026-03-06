@echo off
echo Starting Python Backend...
if not exist "venv" (
    echo Virtual environment not found. Please run:
    echo python -m venv venv
    echo .\venv\Scripts\pip install -r backend\requirements.txt
    exit /b 1
)

call venv\Scripts\activate.bat
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
