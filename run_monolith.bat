@echo off
echo ====================================================
echo      SHOELOTSKEY MONOLITH STARTUP (Dev Mode)
echo ====================================================

:: Cleanup existing processes (Avoid port 8000/5173 conflicts)
echo [INFO] Terminating existing services...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo [INFO] Starting Backend (FastAPI)...
:: Start backend in background
start /B cmd /c "npm run server"

:: Short delay to let DB initialize
timeout /t 3 /nobreak >nul

echo [INFO] Starting Frontend (Vite)...
:: Run frontend in foreground so logs are visible
npm run dev

echo ====================================================
echo  SERVICES STOPPED. 
echo ====================================================
pause
