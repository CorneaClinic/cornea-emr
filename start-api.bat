@echo off
setlocal
cd /d "%~dp0apps\api"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if "%POSTGRES_PASSWORD%"=="" (
  echo.
  echo PostgreSQL setup required. Enter your postgres superuser password
  echo ^(the one you chose during PostgreSQL 18 installation^):
  set /p POSTGRES_PASSWORD=
)

echo Creating database and user...
set POSTGRES_PASSWORD=%POSTGRES_PASSWORD%
call npm run setup:db
if errorlevel 1 (
  echo.
  echo Database setup failed. Check your postgres password and try again.
  exit /b 1
)

echo Running migrations...
call npm run migrate
if errorlevel 1 exit /b 1

echo.
echo Starting API at http://127.0.0.1:3000
echo Sign in via the clinic app Cloud Sign In dialog ^(credentials from npm run seed^).
echo.
call npm run dev
