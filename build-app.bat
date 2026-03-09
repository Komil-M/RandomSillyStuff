@echo off
setlocal

set "ROOT=%~dp0"
set "NODE_PATH=%ProgramFiles%\nodejs"

if not exist "%NODE_PATH%\node.exe" (
  echo ERROR: Node.js not found. Install Node.js (LTS) first.
  echo Run: winget install -e --id OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

cd /d "%ROOT%"
"%NODE_PATH%\npm.cmd" install
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

set "PATH=%NODE_PATH%;%PATH%"
"%NODE_PATH%\npm.cmd" run package:raw
if errorlevel 1 (
  echo ERROR: Packaging failed.
  pause
  exit /b 1
)

echo Build complete.
echo Executable: dist\PoEQoLOverlay-win32-x64\PoEQoLOverlay.exe
pause
exit /b 0
