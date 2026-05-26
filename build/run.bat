@echo off
title SITREP Lite
cd /d "%~dp0"

if not exist ".venv" (
    echo ============================================
    echo   SITREP Lite - First Run Setup
    echo ============================================
    echo.
    echo Installing dependencies... this takes ~30 seconds.
    echo.
    pip install uv >nul 2>&1
    uv venv >nul 2>&1
    uv pip install -e . >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies.
        echo Make sure Python 3.12+ is installed and on your PATH.
        echo Download from: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    echo Done! Starting SITREP Lite...
    echo.
)

echo ============================================
echo   SITREP Lite - http://localhost:8000
echo ============================================
echo.
echo Opening browser...
start http://localhost:8000
uv run python -m sitrep_lite.main
pause
