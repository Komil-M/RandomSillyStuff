@echo off
setlocal

set "ROOT=%~dp0"
if not exist "%ROOT%dist\PoEQoLOverlay-win32-x64\PoEQoLOverlay.exe" (
  echo ERROR: PoEQoLOverlay executable not found.
  echo Build has not been run yet. Run build-app.bat first.
  pause
  exit /b 1
)

start "" "%ROOT%dist\PoEQoLOverlay-win32-x64\PoEQoLOverlay.exe"
exit /b 0
