@echo off
start "CuraSphere API" cmd /k "cd /d C:\Users\Badillon\Projeto_Enfermaria\enfermaria && pnpm nx serve api"
timeout /t 2 /nobreak >nul
start "CuraSphere Web" cmd /k "cd /d C:\Users\Badillon\Projeto_Enfermaria\enfermaria && pnpm nx dev web"
