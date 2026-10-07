@echo off
TITLE SHOELOTSKEY OFFLINE CAPSTONE DEFENSE LAUNCHER
cls
echo ========================================================
echo   SHOELOTSKEY SERVICE MANAGEMENT SYSTEM
echo   OFFLINE CAPSTONE DEFENSE LAUNCHER (ZERO INTERNET MODE)
echo ========================================================
echo.

:: 1. Verify Local SQLite Database exists
if not exist "backend\db\shoelotskey.db" (
    echo [CRITICAL ERROR] SQLite database not found at backend\db\shoelotskey.db!
    echo Please verify the database file before running offline defense mode.
    pause
    exit /b 1
)

:: 2. Verify ML Model exists
if not exist "backend\completion_model.pkl" (
    echo [WARNING] Live ML model backend\completion_model.pkl not found!
)

:: 3. Strictly Lock Environment to Offline Local SQLite
:: Setting ALLOW_REMOTE_DB=false and unsetting DATABASE_URL guarantees
:: that the backend P0-2 Guard refuses any remote host and stays 100% on SQLite.
set ALLOW_REMOTE_DB=false
set DATABASE_URL=
set ENV=development
set OFFLINE_DEFENSE_MODE=true

echo [CONFIG] DATABASE MODE:        OFFLINE DEFENSE
echo [CONFIG] ENGINE:               SQLite
echo [CONFIG] DATABASE FILE:        backend\db\shoelotskey.db
echo [CONFIG] PRODUCTION POSTGRES:  STRICTLY DISCONNECTED
echo [CONFIG] RANDOM FOREST ML:     OFFLINE READY (completion_model.pkl)
echo ========================================================
echo.

:: 4. Terminate any dangling processes
echo [INFO] Stopping any previous background instances...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo [INFO] Starting FastAPI Backend on http://localhost:8000 ...
start "Shoelotskey Backend (SQLite Offline)" cmd /c "cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo [INFO] Waiting for Backend to initialize...
for /L %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Backend is listening on port 8000!
        goto BACKEND_ONLINE
    )
)
echo [WARNING] Backend still starting, proceeding to launch frontend...

:BACKEND_ONLINE
echo [INFO] Starting Vite Frontend on http://localhost:5173 ...
echo.
echo ========================================================
echo   SYSTEM READY FOR OFFLINE DEFENSE PRESENTATION
echo   Local UI URL:      http://localhost:5173
echo   Local Backend API: http://localhost:8000
echo ========================================================
echo.
npm run dev
