@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================
echo Claude-Code-Tudou one-click dependency repair
echo ============================================
echo.

echo [1/5] Kill processes that may lock node_modules...
for %%P in (node.exe electron.exe bun.exe) do (
  taskkill /F /IM %%P >nul 2>nul
)

echo [2/5] Clean previous install artifacts...
if exist "node_modules" (
  rmdir /s /q "node_modules"
)
if exist "package-lock.json" (
  del /f /q "package-lock.json"
)

echo [3/5] Set mirror env for this install session...
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
set "NPM_CONFIG_FETCH_RETRIES=5"
set "NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000"
set "NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000"

echo [4/5] Verify npm cache...
call npm cache verify

echo [5/5] Install dependencies with up to 3 retries...
set /a RETRY=0
:install_retry
set /a RETRY+=1
echo.
echo ---- Install attempt !RETRY! ----
call npm install
if !ERRORLEVEL! EQU 0 goto success

if !RETRY! GEQ 3 goto failed
echo Install failed. Retry in 10 seconds...
timeout /t 10 /nobreak >nul
goto install_retry

:success
echo.
echo ============================================
echo Install succeeded.
echo Next: npm run desktop
echo ============================================
pause
exit /b 0

:failed
echo.
echo ============================================
echo Install failed after 3 attempts.
echo Common causes: unstable network or file locks.
echo Try closing antivirus temporarily and run again.
echo ============================================
pause
exit /b 1
