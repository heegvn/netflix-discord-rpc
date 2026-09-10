@echo off
title Netflix Discord RPC Bridge
color 0c
echo ====================================================
echo      NETFLIX DISCORD RICH PRESENCE - BRIDGE
echo ====================================================
echo.
echo Demarrage du pont local TypeScript...
echo Assurez-vous que Discord Desktop est ouvert sur votre PC !
echo.

cd /d "%~dp0bridge"
npm run start

pause
