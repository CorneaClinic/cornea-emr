@echo off
:: Run production setup as Administrator (hosts, Caddy trust, scheduled tasks).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-production-admin.ps1"
pause
