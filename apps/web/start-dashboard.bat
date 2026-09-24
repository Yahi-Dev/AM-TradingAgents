@echo off
REM ============================================================================
REM DASHBOARD STARTUP SCRIPT FOR WINDOWS
REM This script starts the HTTP server for the development dashboard
REM Put this in C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
REM to auto-start on Windows boot
REM ============================================================================

setlocal enabledelayedexpansion

REM Change to dashboard directory
cd /d "C:\Ia-projects\AM-TradingAgents\apps\web"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found in PATH
    echo Please add Python to your PATH or use the PowerShell service installer instead
    pause
    exit /b 1
)

REM Kill any existing Python http.server on port 8888
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8888') do (
    taskkill /pid %%a /f >nul 2>&1
)

REM Start the server
echo.
echo Starting AM-TradingAgents Dashboard...
echo.
python -m http.server 8888 --bind 127.0.0.1

REM If we get here, the server exited (shouldn't happen in normal operation)
echo.
echo Dashboard server stopped unexpectedly. Keeping window open for 10 seconds...
echo.
timeout /t 10 /nobreak
