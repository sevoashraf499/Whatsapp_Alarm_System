@echo off
REMSa7eny🏃‍♂️‍➡️ - Windows Setup Batch Script
REM Usage: setup.bat

setlocal enabledelayedexpansion

echoSa7eny🏃‍♂️‍➡️ - Windows Setup
echo ======================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js not found!
    echo Please install from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo [OK] Node.js version: %NODE_VERSION%
echo [OK] npm version: %NPM_VERSION%
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [X] npm install failed!
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed
echo.

REM Check for alarm file
if not exist "assets\alarm.mp3" (
    echo [WARNING] assets\alarm.mp3 not found!
    echo Please add an alarm audio file before running the system
    echo Download from: https://freesound.org/
    echo.
)

REM Create user_data directory
if not exist "user_data" (
    mkdir user_data
)

echo [OK] Setup complete!
echo.
echo To start the system, run:
echo   npm start
echo.
echo For more information, see README.md
echo.
pause
