@echo off
REM ============================================================================
REM  Launch YOUR REAL Chrome (your Default profile = every site you're already
REM  logged into) with the remote-debugging port, so the ADE crawler/agent can
REM  ATTACH to it via CDP. Attaching to your real browser is the strongest
REM  bot-detection bypass (real fingerprint + real cookies) AND means no
REM  re-login on sites like CollabCanvas / BookMyShow.
REM
REM  NOTE: Chrome ignores the debug flag if it's already running on this profile,
REM  so this script CLOSES all Chrome windows first. Save your work before running.
REM ============================================================================

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% (
  echo Chrome not found. Edit this file and set CHROME=full\path\to\chrome.exe
  pause
  exit /b 1
)

echo.
echo  This will CLOSE all open Chrome windows, then reopen Chrome (your real
echo  profile, already logged in) listening on debug port 9222.
echo.
pause

taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 >nul

start "Chrome (ADE attach - real profile)" %CHROME% --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data" --profile-directory="Default"

echo.
echo  Chrome is now on debug port 9222 with your real, logged-in profile.
echo  In the ADE UI, turn ON "Attach to my Chrome" and run the crawl/agent.
echo  (Money/payment steps still require YOU to confirm — the agent won't pay.)
echo.
pause
