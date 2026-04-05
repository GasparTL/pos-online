@echo off
title Sistema de Tienda Portable
set NODE_SKIP_PLATFORM_CHECK=1

echo Verificando archivos...
if not exist "%~dp0node.exe" echo ERROR: No se encuentra node.exe en esta carpeta && pause && exit
if not exist "%~dp0server.js" echo ERROR: No se encuentra server.js && pause && exit
if not exist "%~dp0dist" echo ERROR: No se encuentra la carpeta dist && pause && exit

echo Preparando el navegador para iniciar desde cero...
:: Lanza un contador en segundo plano que espera 2 segundos y luego abre Chrome en Incognito
start /b cmd /c "timeout /t 2 >nul & start  http://localhost:5000"

echo Iniciando servidor...
:: Ejecutamos node y mantenemos la ventana abierta pase lo que pase
"%~dp0node.exe" "%~dp0server.js"
if %errorlevel% neq 0 echo El servidor se detuvo con un error. && pause
pause