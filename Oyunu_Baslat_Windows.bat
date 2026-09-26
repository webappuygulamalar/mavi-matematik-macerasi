@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "HOST=127.0.0.1"
set "VERSION=pwa-1"
set "LOG_FILE=.mavi_server_windows.log"
set "PORT="
set "PYTHON_CMD="

where python >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=python"

if "%PYTHON_CMD%"=="" (
  where py >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=py"
)

for %%P in (8081 8082 8083 8084) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Method Head -Uri 'http://%HOST%:%%P' -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    set "PORT=%%P"
    goto :OPEN_GAME
  )

  if "%PYTHON_CMD%"=="" goto :NO_PYTHON

  start "" /min cmd /c "cd /d ""%~dp0"" && %PYTHON_CMD% -m http.server %%P --bind %HOST% > ""%LOG_FILE%"" 2>&1"
  timeout /t 1 /nobreak >nul

  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Method Head -Uri 'http://%HOST%:%%P' -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    set "PORT=%%P"
    goto :OPEN_GAME
  )
)

:NO_PYTHON
echo Oyun baslatilamadi.
echo Python kurulu degilse Windows icin Python yuklemeniz gerekebilir.
echo Detay icin %LOG_FILE% dosyasini kontrol edin.
pause
exit /b 1

:OPEN_GAME
set "URL=http://%HOST%:%PORT%/?v=%VERSION%"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%URL%"
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%URL%"
  exit /b 0
)

start "" "%URL%"
exit /b 0
