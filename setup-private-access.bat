@echo off
echo Private remote access setup (Tailscale - invite only, not public)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-tailscale.ps1"
echo.
echo Sign in to Tailscale from the system tray, then run:
echo   scripts\setup-tailscale-serve.ps1
echo.
pause
