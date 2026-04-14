@echo off
cd /d "C:\Users\asus\Desktop\Projects\cloudbox-var-hunter"
start "VAR Hunter Dev" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
start chrome http://localhost:3000
