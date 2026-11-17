@echo off
rem Edufy Academy: Android signing keystore + FCM V1 push key, managed by EAS (interactive).
rem Answer the prompts in this window. Nothing here is saved to the project or to GitHub.
cd /d "%~dp0..\.."
echo.
echo  Edufy Academy - EAS Android credentials (com.edufyacademy.student)
echo  -----------------------------------------------------------------
echo  1. Pick the build profile:  production
echo  2. READ the "Android Credentials" summary shown first:
echo       - If a Keystore is already listed, DO NOT create a new one. Close this window and tell Claude.
echo       - If it says no keystore: choose  "Keystore: Manage everything needed to build your project"
echo         then  "Set up a new keystore"  ^>  accept the default name  ^>  "Generate a new Android Keystore?"  Y
echo  3. Back up:  "Keystore"  ^>  "Download existing keystore"  ^>  Y to show passwords.
echo       Save the .jks file and the passwords in your password manager / a safe drive (NOT in this folder).
echo  4. Push key: "Google Service Account"  ^>  "Manage your Google Service Account Key for Push Notifications (FCM V1)"
echo       ^>  "Set up a Google Service Account Key for Push Notifications (FCM V1)"  ^>  "Upload a new service account key"
echo       and give the FULL path of the Firebase private-key JSON in your Downloads folder.
echo  5. Choose "Exit" when done.
echo.
call npx --yes eas-cli@latest credentials -p android
echo.
echo Done. You can close this window.
pause
