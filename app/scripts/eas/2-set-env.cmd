@echo off
setlocal
rem Runs from the app folder; output goes to app\.eas-logs (git-ignored). No secrets are printed.
cd /d "%~dp0..\.."
if not exist ".eas-logs" mkdir ".eas-logs"
set "LOG=.eas-logs\2-env.log"
echo Edufy Academy EAS environment variables %date% %time%> "%LOG%"
rem Public values (built into the app; not secrets).
call :run "npx --yes eas-cli@latest env:create --help"
rem One variable per name, valid for both environments. --force updates an existing variable.
call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name EXPO_PUBLIC_API_URL --value https://api.edufyacademy.com --visibility plaintext --force --non-interactive"
call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name EXPO_PUBLIC_WEB_URL --value https://edufyacademy.com --visibility plaintext --force --non-interactive"
call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://tyqdyfecdvclwsvcahod.supabase.co --visibility plaintext --force --non-interactive"
call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_vdb93o6VLndrVqj806a3MA_-c3Fb096 --visibility plaintext --force --non-interactive"
call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name EAS_PROJECT_ID --value 37cb3efb-c3fa-4181-8486-0f5161c535e6 --visibility plaintext --force --non-interactive"
if exist google-services.json (
  call :run "npx --yes eas-cli@latest env:create --environment preview --environment production --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --force --non-interactive"
) else (
  echo GOOGLE_SERVICES_JSON skipped: app\google-services.json not found>> "%LOG%"
)
call :run "npx --yes eas-cli@latest env:list --environment preview"
call :run "npx --yes eas-cli@latest env:list --environment production"

echo ===== DONE ===== >> "%LOG%"
echo Finished. Log: %CD%\%LOG%
exit /b 0

:run
echo.>> "%LOG%"
echo ===== %~1 =====>> "%LOG%"
call %~1 >> "%LOG%" 2>&1
echo [exit code %errorlevel%]>> "%LOG%"
exit /b 0
