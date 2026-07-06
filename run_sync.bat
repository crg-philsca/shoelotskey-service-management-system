@echo off
TITLE SHOELOTSKEY DATABASE SYNCHRONIZER
echo ====================================================
echo   SHOELOTSKEY SYSTEM INTEGRITY: DATABASE SYNC
echo          (Cloud to Offline SQLite Mode)
echo ====================================================

:: Set working directory to the folder containing this batch script
cd /d "%~dp0"

:: Check if the virtual environment exists
if not exist "venv\Scripts\python.exe" goto :NO_VENV

:: Run the sync script
echo [ACTION] Initializing data synchronization...
"venv\Scripts\python.exe" backend\sync_to_local.py
goto :END

:NO_VENV
echo [ERROR] Virtual environment (venv) not found!
echo Please make sure you are running this from the project folder.

:END
echo ====================================================
pause
