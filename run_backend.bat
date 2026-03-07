@echo off
echo Starting Python Backend with MySQL...

:: Use the current folder for everything
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

:: Check if venv exists without complex IF blocks
if exist "venv\Scripts\python.exe" goto :RUN_BACKEND

echo [ERROR] Virtual environment (venv) not found!
echo Please run: python -m venv venv
pause
exit /b 1

:RUN_BACKEND
echo Backend Starting...
cd backend
"..\venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
