@echo off
title AssetFlow Development Server
cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm is not installed or is not available in PATH.
  echo Install Node.js and pnpm, then try again.
  pause
  exit /b 1
)

where supabase >nul 2>&1
if not errorlevel 1 (
  echo Starting local database (Docker Desktop must be running)...
  call supabase start
  echo.
)

echo Starting AssetFlow...
echo Keep this window open while developing.
echo Press Ctrl+C to stop the server.
echo.

call pnpm dev --open

echo.
echo AssetFlow development server has stopped.
pause
