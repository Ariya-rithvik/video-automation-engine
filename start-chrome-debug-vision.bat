@echo off
REM ============================================================================
REM  Dedicated DEBUG Chrome on port 9222 for the FREE browser-AI vision brain.
REM  Uses a SEPARATE profile (ADE-Debug) so it does NOT touch your main Chrome,
REM  and so the debug port actually opens (recent Chrome blocks it on the Default
REM  profile). Sign into gemini.google.com in the window that opens — ONE time;
REM  the login persists in this profile for next runs.
REM ============================================================================
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% (
  echo Chrome not found. Edit this file and set CHROME=full\path\to\chrome.exe
  pause
  exit /b 1
)
start "ADE Debug Chrome (9222)" %CHROME% --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\ADE-Debug" --no-first-run --no-default-browser-check https://gemini.google.com/app
echo.
echo  Debug Chrome is on port 9222 (separate ADE-Debug profile).
echo  1) Sign into gemini.google.com in that window (one time).
echo  2) Then run the free-vision test / agent.
echo.
