@echo off
TITLE SHOELOTSKEY AUDIT LOG MONITOR
echo ====================================================
echo    SHOELOTSKEY SYSTEM INTEGRITY MONITOR 
echo        (Technical Defense Audit Mode)
echo ====================================================
echo [BOOT] Initializing Node.js runtime...

node defense-audit.cjs

if %ERRORLEVEL% NEQ 0 (
    echo [CRITICAL ERROR] Failed to start audit system. 
    echo Ensure Node.js is installed and you are in the project folder.
    pause
)
