@echo off
rem Edufy Academy: push the website and API code to GitHub (Hostinger then deploys automatically).
rem Optional: PUSH-TO-GITHUB.cmd -Message "What changed"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0production\github\push-to-github.ps1" %*
echo.
pause
