@echo off
title ClipGrab Server
echo.
echo =========================================
echo       Starting ClipGrab Downloader...
echo =========================================
echo.

:: Check if node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

:: Check if dependencies need to be installed
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    echo.
    call npm install
)

echo [INFO] Starting engine...
echo.
node server.js

pause
