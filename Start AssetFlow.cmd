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
  where docker >nul 2>&1
  if errorlevel 1 (
    echo Docker CLI was not found. Start Docker Desktop manually.
  ) else (
    docker ps >nul 2>&1
    if errorlevel 1 (
      echo Starting Docker Desktop...
      if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
        start "" /min "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
        echo Waiting for the Docker engine...
        for /l %%I in (1,1,30) do (
          docker ps >nul 2>&1 && goto docker_ready
          timeout /t 2 /nobreak >nul
        )
        echo Docker did not become ready. Open Docker Desktop and try again.
        pause
        exit /b 1
      ) else (
        echo Docker Desktop was not found. Start it manually and try again.
        pause
        exit /b 1
      )
    )
  )

  :docker_ready
  echo Starting local Supabase...
  call supabase start
  if errorlevel 1 (
    echo Local Supabase could not be started.
    pause
    exit /b 1
  )

  echo Applying pending AssetFlow database upgrades...
  call supabase migration up --local
  if errorlevel 1 (
    echo Database upgrade failed. AssetFlow was not started to protect your data.
    pause
    exit /b 1
  )
  echo.
)

echo Starting AssetFlow...
echo Keep this window open while developing.
echo Press Ctrl+C to stop the server.
echo.

set "ASSETFLOW_DEV_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":4321 .*LISTENING"') do set "ASSETFLOW_DEV_PID=%%P"
if defined ASSETFLOW_DEV_PID (
  echo AssetFlow is already running on http://localhost:4321
  start "" http://localhost:4321
  exit /b 0
)

call pnpm dev --open

echo.
echo AssetFlow development server has stopped.
pause
