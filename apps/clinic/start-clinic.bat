@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Cornea Clinic - starting all services
echo ==============================================
echo.

rem --- Start production API via scheduled task if registered, else script ---
powershell -NoProfile -Command "try { Get-ScheduledTask -TaskName 'CorneaEMR-API' -ErrorAction Stop | Out-Null; Start-ScheduledTask -TaskName 'CorneaEMR-API'; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health/live' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
    if errorlevel 1 (
        echo Starting Cornea EMR API ^(production^)...
        start "Cornea EMR API" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\..\scripts\run-production-api.ps1"
        timeout /t 4 /nobreak >nul
    )
) else (
    timeout /t 3 /nobreak >nul
)

rem --- Start Caddy HTTPS proxy if task exists ---
powershell -NoProfile -Command "try { Get-ScheduledTask -TaskName 'CorneaEMR-Caddy' -ErrorAction Stop | Out-Null; Start-ScheduledTask -TaskName 'CorneaEMR-Caddy'; exit 0 } catch { exit 1 }" >nul 2>&1

rem --- Open the clinic UI (HTTPS via Caddy when running, else HTTP fallback) ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://clinic.local/Cornea.html' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process 'https://clinic.local/Cornea.html'; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 start "" "http://127.0.0.1:8080/Cornea.html"

rem --- Start the clinic UI server unless port 8080 is already in use ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:8080/Cornea.html' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo Clinic UI already running -^>  http://127.0.0.1:8080/Cornea.html
    echo.
    echo Nothing else to do. You can close this window.
    pause
    exit /b 0
)

echo Starting clinic UI server -^>  http://127.0.0.1:8080/Cornea.html
echo.
echo Keep this window open while using the clinic app.
echo Press Ctrl+C to stop.
echo.
node clinic-server.js
if errorlevel 1 (
    echo.
    echo Node.js is required. Install from https://nodejs.org/
    pause
)
