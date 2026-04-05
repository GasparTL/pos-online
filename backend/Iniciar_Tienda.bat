@off
title Sistema de Tienda Portable
color 0b

echo ========================================
echo   INICIANDO MI TIENDITA PORTABLE
echo ========================================

:: 1. Abrir el navegador en el puerto 5000
start http://localhost:5000

:: 2. Ejecutar el servidor usando el motor local (./node.exe)
:: Usamos %~dp0 para asegurarnos de que Windows encuentre el archivo sin importar la letra de la USB
"%~dp0node.exe" "%~dp0server.js"

pause