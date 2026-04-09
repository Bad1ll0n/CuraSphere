@echo off
echo A parar servidores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3333 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo Servidores parados.
timeout /t 2 /nobreak >nul
