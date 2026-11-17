@echo off
setlocal
rem Downloads the logs of the latest EAS build to app\.eas-logs\6-build-logs.txt (git-ignored).
cd /d "%~dp0..\.."
if not exist ".eas-logs" mkdir ".eas-logs"
call npx --yes eas-cli@latest build:view --json > ".eas-logs\build-view.json" 2> ".eas-logs\build-view.err"
node scripts\eas\fetch-build-logs.mjs ".eas-logs\build-view.json" ".eas-logs\6-build-logs.txt" > ".eas-logs\6-fetch.log" 2>&1
echo Finished.
