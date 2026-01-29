@echo off
REMSa7eny🏃‍♂️‍➡️ - Quick Start Launcher

REM Set UTF-8 encoding for proper character display
chcp 65001 >nul 2>&1

setlocal enabledelayedexpansion

:menu
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║    Sa7eny🏃‍♂️‍➡️ - WhatsApp Alarm System                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 1. Start System
echo 2. Install Dependencies
echo 3. Clean Session (remove login)
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto install
if "%choice%"=="3" goto clean
if "%choice%"=="4" goto end
goto menu

:start
cls
echo Starting Sa7eny🏃‍♂️‍➡️...
echo.
npm start
pause
goto menu

:install
cls
echo Installing dependencies...
echo.
npm install
echo.
pause
goto menu

:clean
cls
echo Removing saved login session...
if exist user_data (
    rmdir /s /q user_data
    echo Session removed. Will need to scan QR code on next start.
) else (
    echo No session found.
)
echo.
pause
goto menu

:end
exit /b 0
