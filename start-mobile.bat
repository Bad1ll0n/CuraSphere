@echo off
cd /d "%~dp0enfermaria"
pnpm nx start mobile -- --web
pause
