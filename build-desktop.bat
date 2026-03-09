@echo off
echo =========================================
echo   Gateway Core Desktop Build Script
echo =========================================

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed
    exit /b 1
)

REM 1. Install Node.js server dependencies
echo [1/4] Installing server dependencies...
cd server
call npm install --production
cd ..

REM 2. Create icon
echo [2/4] Creating icon...
cd electron
call node create-icon.js
cd ..

REM 3. Build frontend
echo [3/4] Building frontend UI...
cd desktop-ui
call npm install --legacy-peer-deps
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Failed to build frontend
    exit /b 1
)
cd ..

REM 4. Copy frontend build to electron
echo [4/4] Copying frontend to electron...
if exist electron\src\ui rmdir /s /q electron\src\ui
xcopy /e /i /y desktop-ui\build electron\src\ui

REM Copy server to electron resources
if not exist electron\release\resources mkdir electron\release\resources
xcopy /e /i /y server electron\release\resources\

echo =========================================
echo   Build Complete!
echo   Output: electron\dist\
echo =========================================

dir electron\dist\
