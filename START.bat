@echo off
REM WhatsApp Alarm System - Quick Start Launcher
REM This batch file provides easy access to common commands

setlocal enabledelayedexpansion

:menu
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     WhatsApp Alarm System - Windows 11 Edition            ║
echo ║        Arabic Keyword Detection with Alarm                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 1. Start System (npm start)
echo 2. Install Dependencies (npm install)
echo 3. Open README Documentation
echo 4. Open Quick Start Guide
echo 5. Clean Session (remove login)
echo 6. View Configuration
echo 7. View Source Code
echo 8. Exit
echo.
set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto install
if "%choice%"=="3" goto readme
if "%choice%"=="4" goto quickstart
if "%choice%"=="5" goto clean
if "%choice%"=="6" goto config
if "%choice%"=="7" goto source
if "%choice%"=="8" goto end
goto menu

:start
cls
echo Starting WhatsApp Alarm System...
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

:readme
start notepad README.md
goto menu

:quickstart
start notepad QUICKSTART.md
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

:config
cls
echo Opening configuration file...
start notepad src\config.js
goto menu

:source
cls
echo Opening source code folder...
start explorer src
goto menu

:end
exit /b 0
