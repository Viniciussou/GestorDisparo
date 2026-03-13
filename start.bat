@echo off
echo Iniciando GestorDisparo...

echo Iniciando servidor WhatsApp...
start /B cmd /C "cd scripts\whatsapp-server && npm start"

timeout /t 3 /nobreak > nul

echo Iniciando aplicacao Next.js...
npm run dev

pause