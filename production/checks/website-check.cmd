@echo off
setlocal
rem Website + API checks before pushing: TypeScript, tests, production website build.
rem Output: .check-logs\website-check.log in the project folder (git-ignored).
cd /d "%~dp0..\.."
if not exist ".check-logs" mkdir ".check-logs"
set "LOG=.check-logs\website-check.log"
echo Edufy Academy website/API checks %date% %time%> "%LOG%"
call :run "npx tsc --noEmit"
call :run "npm test"
call :run "npm run build:web"
call :run "npm run build:server"
echo ===== DONE ===== >> "%LOG%"
echo Finished. Log: %CD%\%LOG%
exit /b 0

:run
echo.>> "%LOG%"
echo ===== %~1 =====>> "%LOG%"
call %~1 >> "%LOG%" 2>&1
echo [exit code %errorlevel%]>> "%LOG%"
exit /b 0
