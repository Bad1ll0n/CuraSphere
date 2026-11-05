@echo off
start "CuraSphere API" cmd /k "cd /d %~dp0enfermaria && pnpm nx serve api"
timeout /t 2 /nobreak >nul
start "CuraSphere Web" cmd /k "cd /d %~dp0enfermaria && pnpm nx dev web"
timeout /t 2 /nobreak >nul
start "CuraSphere Mobile" cmd /k "cd /d %~dp0enfermaria && pnpm nx start mobile -- --web"
