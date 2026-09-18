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

set LOCAL_IP=localhost
for /f "tokens=*" %%i in ('venv\Scripts\python.exe -c "import socket; ips = [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith('127.') and not ip.startswith('169.254.')]; print(ips[0] if ips else 'localhost')" 2^>nul') do set LOCAL_IP=%%i

echo ====================================================
echo   ACCESS URLS (Works locally and on local Wi-Fi/LAN):
echo   * Local PC:    http://localhost:5173
echo   * Other Device: http://%LOCAL_IP%:5173
echo   * Backend API:  http://%LOCAL_IP%:8000
echo   (Connect any phone/tablet/PC to the same Wi-Fi
echo    to open the system even without internet access!)
echo ====================================================
echo.

echo [INFO] Starting Backend (FastAPI in background)...
start /B cmd /c "npm run server"

echo [INFO] Waiting for FastAPI backend to be ready on port 8000 (cloud DB sync)...
for /L %%i in (1,1,60) do (
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Backend is ready on port 8000!
        goto BACKEND_READY
    )
)
echo [WARNING] Backend startup taking longer than usual, proceeding with frontend...
:BACKEND_READY

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
