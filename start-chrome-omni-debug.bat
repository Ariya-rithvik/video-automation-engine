@echo off
REM Launch Chrome with --remote-debugging-port=9222 so the ADE Omni Clip Agent
REM can attach via CDP without triggering Google's anti-automation block.
REM
REM Uses a DEDICATED user-data-dir so:
REM   (a) it doesn't conflict with your regular Chrome session
REM   (b) Google login persists between runs (cookies stored in AdeOmniChrome dir)

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% (
  echo.
  echo Chrome not found in standard locations. Edit this file and set CHROME=...
  echo.
  pause
  exit /b 1
)

set USERDIR="%USERPROFILE%\AppData\Local\AdeOmniChrome"

echo.
echo ============================================================
echo   Launching Chrome with debug port 9222
echo   Profile dir: %USERDIR%
echo   First run: you'll need to sign in to your Google account.
echo   Cookies persist after that, so subsequent runs skip login.
echo ============================================================
echo.

start "Chrome (Gemini Omni debug)" %CHROME% --remote-debugging-port=9222 --user-data-dir=%USERDIR% https://gemini.google.com

echo Chrome launched. Sign in if prompted, then go back to the ADE UI
echo and click "Start Watching" in the Omni Clip panel.
echo.
pause
