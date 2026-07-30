@echo off
TITLE SHOELOTSKEY SMS CONTROL CENTER
:MENU
cls
echo ====================================================
echo         SHOELOTSKEY SMS v2.0 - CONTROL CENTER
echo ====================================================
echo   [1] Start Shoelotskey Dev Server (Backend + Frontend)
echo   [2] Start File Integrity Audit Watcher
echo   [3] Exit
echo ====================================================
set /p choice="Select an option (1-3): "

if "%choice%"=="1" goto MONOLITH
if "%choice%"=="2" goto AUDIT
if "%choice%"=="3" goto :EOF
goto MENU

:MONOLITH
cls
echo ====================================================
echo      SHOELOTSKEY MONOLITH STARTUP (Dev Mode)
echo ====================================================
echo [INFO] Terminating existing services...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo [INFO] Starting Backend (FastAPI in background)...
start /B cmd /c "npm run server"

echo [INFO] Waiting for database initialization...
timeout /t 3 /nobreak >nul

echo [INFO] Starting Frontend (Vite in foreground)...
npm run dev
goto MENU

:AUDIT
cls
echo ====================================================
echo      SHOELOTSKEY FILE INTEGRITY WATCHER
echo ====================================================
node defense-audit.cjs
goto MENU
