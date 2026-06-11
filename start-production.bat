@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Cornea Clinic - PRODUCTION startup
echo ==============================================
echo.

rem --- Ensure API .env exists ---
if not exist "apps\api\.env" (
    echo ERROR: apps\api\.env not found.
    echo Copy apps\api\.env.example to .env and configure for production.
    pause
    exit /b 1
)

rem --- Start production API if not already running ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health/live' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo Starting Cornea EMR API ^(production^)...
    start "Cornea EMR API" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-production-api.ps1"
    timeout /t 4 /nobreak >nul
) else (
    echo API already running
)

rem --- Open clinic UI ---
start "" "http://127.0.0.1:8080/Cornea.html"

rem --- Start clinic static server if needed ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:8080/Cornea.html' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo Clinic UI already running at http://127.0.0.1:8080/Cornea.html
    echo.
    echo Optional HTTPS: run scripts\start-caddy.ps1 and use https://clinic.local
    pause
    exit /b 0
)

echo Starting clinic UI server...
cd /d "%~dp0..\Cornea Clinic file"
node clinic-server.js
