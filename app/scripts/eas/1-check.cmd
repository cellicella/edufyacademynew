@echo off
setlocal
rem Runs from the app folder; output goes to app\.eas-logs (git-ignored). No secrets are printed.
cd /d "%~dp0..\.."
if not exist ".eas-logs" mkdir ".eas-logs"
set "LOG=.eas-logs\1-check.log"
echo Edufy Academy app checks %date% %time%> "%LOG%"
call :run "node --version"
call :run "npx --yes eas-cli@latest --version"
call :run "npx --yes eas-cli@latest whoami"
call :run "npx --yes eas-cli@latest project:info"
call :run "npx expo config --type public"
call :run "npx --yes eas-cli@latest env:list --environment preview"
call :run "npx --yes eas-cli@latest env:list --environment production"
call :run "npx tsc --noEmit"
call :run "npm test"
call :run "npx expo-doctor"
call :run "npx expo install --check"
if exist google-services.json (echo google-services.json: present>> "%LOG%") else (echo google-services.json: MISSING>> "%LOG%")

echo ===== DONE ===== >> "%LOG%"
echo Finished. Log: %CD%\%LOG%
exit /b 0

:run
echo.>> "%LOG%"
echo ===== %~1 =====>> "%LOG%"
call %~1 >> "%LOG%" 2>&1
echo [exit code %errorlevel%]>> "%LOG%"
exit /b 0
