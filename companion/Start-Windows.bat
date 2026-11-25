@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 gma_bridge.py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3.10 or later is required. Install Python from python.org, then run this again.
  ) else (
    python gma_bridge.py
  )
)
pause
