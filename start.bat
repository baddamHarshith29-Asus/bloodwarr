@echo off
echo Starting BloodMind Backend...
cd /d "%~dp0backend"
start "BloodMind API" cmd /k "uvicorn main:app --reload --host 127.0.0.1 --port 8096"
echo Starting BloodMind Frontend...
cd /d "%~dp0frontend"
start "BloodMind UI" cmd /k "npm run dev"
echo.
echo Backend: http://localhost:8095/docs
echo Frontend: http://localhost:5173
echo.
