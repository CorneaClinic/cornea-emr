@echo off
REM G1 full restore drill - use from Command Prompt (CMD).
REM
REM   set POSTGRES_PASSWORD=YourPostgresInstallPassword
REM   scripts\drill-restore-local.cmd
REM
REM Optional: scripts\drill-restore-local.cmd skip   (no fresh cloud backup)

setlocal
cd /d "%~dp0\.."

if "%POSTGRES_PASSWORD%"=="" (
  echo.
  echo ERROR: POSTGRES_PASSWORD is not set.
  echo.
  echo   set POSTGRES_PASSWORD=YourPostgresInstallPassword
  echo   scripts\drill-restore-local.cmd
  echo.
  exit /b 1
)

if /i "%~1"=="skip" (
  powershell -ExecutionPolicy Bypass -File scripts\setup-restore-drill-local.ps1 -SkipFreshBackup
) else (
  powershell -ExecutionPolicy Bypass -File scripts\setup-restore-drill-local.ps1
)

exit /b %ERRORLEVEL%
