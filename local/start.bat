@echo off
REM ProjectFlow — local, offline launcher. Double-click this file.
REM Everything (database, backend, website) runs only on this PC. Nothing here ever
REM needs the internet, and nothing new needs to be installed — Postgres and Node.js
REM are both bundled, portable copies that live next to this script.
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PG_BIN=%~dp0pg-portable\pgsql\bin
set PG_DATA=%~dp0pg-data
set NODE_EXE=%~dp0node-portable\node-v24.16.0-win-x64\node.exe
set API_DIR=%~dp0app\api
REM Next.js standalone output nests the real server.js under apps/web (mirroring the
REM monorepo's own apps/web path) — found by actually running this and hitting
REM MODULE_NOT_FOUND on the wrong, non-nested path.
set WEB_DIR=%~dp0app\web\apps\web
set ENV_FILE=%~dp0local.env
set PG_PORT=5433
set API_PORT=4100
set WEB_PORT=3100

echo ============================================
echo   ProjectFlow - starting locally, offline
echo ============================================
echo.

REM --- First-run setup: persistent random secrets, so logins survive a restart ---
if not exist "%ENV_FILE%" (
    echo First run - generating local secrets...
    "%NODE_EXE%" -e "const c=require('crypto');console.log('JWT_SECRET='+c.randomBytes(48).toString('base64url'));console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))" > "%ENV_FILE%"
)
for /f "usebackq tokens=1,2 delims==" %%A in ("%ENV_FILE%") do set %%A=%%B

REM --- Database: initialize on first run only, then just start it every time ---
if not exist "%PG_DATA%\PG_VERSION" (
    echo First run - initializing the local database...
    "%PG_BIN%\initdb.exe" -D "%PG_DATA%" --username=projectflow --auth=trust -E UTF8 >nul
)

echo Starting local database...
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -o "-p %PG_PORT% -h 0.0.0.0" -l "%PG_DATA%\logfile.txt" -w start
if errorlevel 1 (
    echo Database may already be running - continuing.
)

set DATABASE_URL=postgresql://projectflow@127.0.0.1:%PG_PORT%/projectflow

REM --- Create the app database if this is the very first run ---
"%PG_BIN%\psql.exe" -h 127.0.0.1 -p %PG_PORT% -U projectflow -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='projectflow'" | findstr "1" >nul
if errorlevel 1 (
    echo Creating application database...
    "%PG_BIN%\createdb.exe" -h 127.0.0.1 -p %PG_PORT% -U projectflow projectflow
)

echo Applying database updates...
pushd "%API_DIR%"
"%NODE_EXE%" node_modules\prisma\build\index.js migrate deploy --schema prisma\schema.prisma
popd

REM --- Figure out this PC's real WiFi/Ethernet LAN IP, so the phone can be told what
REM     to type. Prefer a 192.168.x.x address specifically: this machine (and most
REM     home/office networks) hands those out on the real WiFi/Ethernet adapter, while
REM     virtual adapters WSL/Hyper-V/Docker create use other private ranges (seen here:
REM     172.31.48.1 for WSL's vEthernet) that a phone on the same WiFi can't reach at
REM     all. Falls back to any non-loopback address if no 192.168.x.x is found.
set LAN_IP=
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168."') do (
    set LAN_IP=%%A
    goto gotip
)
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "127.0.0.1"') do (
    set LAN_IP=%%A
    goto gotip
)
:gotip
set LAN_IP=%LAN_IP: =%

echo Starting the app server...
start "ProjectFlow API" /min cmd /c "set DATABASE_URL=%DATABASE_URL%&& set JWT_SECRET=%JWT_SECRET%&& set ENCRYPTION_KEY=%ENCRYPTION_KEY%&& set PORT=%API_PORT%&& set WEB_ORIGIN=http://127.0.0.1:%WEB_PORT%&& set MOBILE_ORIGIN=http://%LAN_IP%:%WEB_PORT%&& "%NODE_EXE%" dist\server.js"

echo Starting the reminder engine...
start "ProjectFlow Worker" /min cmd /c "set DATABASE_URL=%DATABASE_URL%&& "%NODE_EXE%" dist\worker-entry.js"

echo Starting the website...
start "ProjectFlow Web" /min cmd /c "set PORT=%WEB_PORT%&& set HOSTNAME=0.0.0.0&& set API_INTERNAL_URL=http://127.0.0.1:%API_PORT%&& "%NODE_EXE%" "%WEB_DIR%\server.js""

echo.
echo Waiting for everything to come up...
REM ping as a sleep: avoids relying on PATH resolving to Windows' own timeout.exe,
REM which a dev tool's Unix-coreutils "timeout" earlier on PATH can shadow.
ping -n 7 127.0.0.1 >nul

echo.
echo ============================================
echo   ProjectFlow is running.
echo.
echo   On THIS computer:   http://localhost:%WEB_PORT%
if defined LAN_IP echo   On your PHONE (same WiFi): http://%LAN_IP%:%WEB_PORT%
echo.
echo   Leave this window and the small ones it opened running.
echo   Close them (or just shut down this PC) to stop ProjectFlow.
echo ============================================
echo.

start "" "http://localhost:%WEB_PORT%"

pause
