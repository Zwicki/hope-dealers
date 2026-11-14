@echo off
echo Starting Hope Dealers Outreach App (Life Recovery Society)...
cd /d "%~dp0"
start http://localhost:5173
npm run dev
pause
