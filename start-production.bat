@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  stingdev - run frontend + backend in PRODUCTION mode (fast)
REM  Site:  http://localhost:3000     Admin: http://127.0.0.1:8000/admin/
REM  Paths are derived from this file's location (no hardcoded drive).
REM ============================================================

set "ROOT=%~dp0"

REM --- 1) Start Django FIRST (the production build fetches content from it) ---
echo [1/4] Starting Django on http://127.0.0.1:8000 ...
start "Django Backend" cmd /k "cd /d %ROOT%backend && call .venv\Scripts\activate.bat && python manage.py runserver 8000 --no-frontend --no-browser"

REM --- 2) Wait until the API is reachable before building ---
echo [2/4] Waiting for the API to be ready...
cd /d "%ROOT%backend" || (echo Cannot find backend folder at %ROOT%backend & pause & exit /b 1)
set "READY=0"
for /L %%i in (1,1,40) do (
    if "!READY!"=="0" (
        curl -s -o nul http://127.0.0.1:8000/api/v1/health/ && set "READY=1"
        if "!READY!"=="0" (ping -n 2 127.0.0.1 >nul)
    )
)

REM --- 3) Ensure a VALID and CURRENT production build ---
REM     Rebuild when EITHER is true:
REM       (a) the build is invalid/incomplete - next dev / turbopack (or a build made
REM           while the API was down) leaves ".next" without a usable routes manifest,
REM           and "next start" then crashes or serves 500s; we detect the "dataRoutes"
REM           key that a real "next build" writes.
REM       (b) the build is STALE - any frontend source file is newer than the last
REM           build (.next\BUILD_ID). Serving a stale build means running old code.
cd /d "%ROOT%frontend" || (echo Cannot find frontend folder at %ROOT%frontend & pause & exit /b 1)

set "NEED_BUILD=1"
if exist ".next\BUILD_ID" (
    if exist ".next\routes-manifest.json" (
        findstr /C:"dataRoutes" ".next\routes-manifest.json" >nul 2>&1 && set "NEED_BUILD=0"
    )
)

REM Staleness check: rebuild if any file under src\ (or a key config file) is newer
REM than .next\BUILD_ID. Single-line PowerShell to stay robust inside this if-block.
if "%NEED_BUILD%"=="0" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=(Get-Item '.next\BUILD_ID').LastWriteTimeUtc; $files=@(Get-ChildItem -Recurse -File -Path 'src' -ErrorAction SilentlyContinue); foreach ($f in @('next.config.mjs','package.json','package-lock.json')) { if (Test-Path $f) { $files += Get-Item $f } }; $n=$files | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1; if ($n -and $n.LastWriteTimeUtc -gt $b) { exit 1 } else { exit 0 }"
    if errorlevel 1 (
        echo [3/4] Source changed since last build - a rebuild is needed.
        set "NEED_BUILD=1"
    )
)

if "%NEED_BUILD%"=="1" (
    echo [3/4] Building the frontend for production...
    if exist ".next" rmdir /s /q ".next"
    call npm run build
    if errorlevel 1 (
        echo.
        echo Frontend build FAILED. See the errors above.
        pause
        exit /b 1
    )
) else (
    echo [3/4] Valid and current production build found - skipping build.
)

REM --- 4) Start Next.js in production mode on 3000 ---
echo [4/4] Starting frontend (production) on http://localhost:3000 ...
start "Next.js Frontend" cmd /k "cd /d %ROOT%frontend && npm start"

REM --- Open the site once the frontend is warming up ---
timeout /t 5 /nobreak >nul
start "" http://localhost:3000

echo.
echo Running. Site: http://localhost:3000    Admin: http://127.0.0.1:8000/admin/
echo Two windows opened (Django Backend / Next.js Frontend). Close them to stop.
endlocal
exit /b 0
