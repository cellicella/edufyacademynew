@echo off
setlocal
rem Runs from the app folder; output goes to app\.eas-logs (git-ignored). No secrets are printed.
cd /d "%~dp0..\.."
if not exist ".eas-logs" mkdir ".eas-logs"
set "LOG=.eas-logs\3-build-preview.log"
echo Edufy Academy preview APK build %date% %time%> "%LOG%"
call :run "npx --yes eas-cli@latest env:list --environment preview"
call :run "npx --yes eas-cli@latest config --platform android --profile preview --non-interactive"
call :run "npx --yes eas-cli@latest build --platform android --profile preview --non-interactive --no-wait"

echo ===== DONE ===== >> "%LOG%"
echo Finished. Log: %CD%\%LOG%
exit /b 0

:run
echo.>> "%LOG%"
echo ===== %~1 =====>> "%LOG%"
call %~1 >> "%LOG%" 2>&1
echo [exit code %errorlevel%]>> "%LOG%"
exit /b 0
