# PoE QoL Overlay

Desktop overlay helper for Path of Exile with account context, mission tracking, and guide step overlays.

## Quick start (development)

1. Install Node.js (LTS) and npm.
2. In a terminal:
   1. `cd "C:\Users\komil\OneDrive\Desktop\PathOfAutomation"`
   2. `npm install`
   3. `npm start`

## Build a Windows EXE (portable install)

This repo uses `electron-builder` with an NSIS installer.

1. Install dependencies:
   `npm install`
2. Build:
   `npm run package`

The generated installer will be in:

- `dist/`

Example expected file:
- `dist/PoEQoLOverlay-setup-0.1.0.exe`

To create a portable `.exe` without installer:

- `npm run build:portable`

If your environment blocks the installer pipeline, use:

- `npm run package:raw`

This creates:
- `dist/PoEQoLOverlay-win32-x64/PoEQoLOverlay.exe`

## Zero-command start

After one-time build, run:

- Double-click `start-app.bat` to launch the app.

If you ever need to rebuild on this machine:

- Double-click `build-app.bat`

## Branch used for this project

- `poe-qol-overlay`

## Notes

- First run after install creates state in your app data directory.
- Keep your token and local account settings in sync with the dashboard.
