@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cornea-emr\scripts\setup-cloudflare-tunnel.ps1"
pause
