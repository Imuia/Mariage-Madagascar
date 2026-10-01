@echo off
setlocal
title Mariage Madagascar - Images Blog V5
cd /d "%~dp0"

echo.
echo ===============================================
echo  MARIAGE MADAGASCAR - IMAGES BLOG V5
echo ===============================================
echo.
echo La fenetre restera ouverte a la fin.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0RECUPERER-IMAGES-BLOG-V5-OFFICIEL.ps1"

echo.
echo FIN DU TRAITEMENT.
echo.
pause
