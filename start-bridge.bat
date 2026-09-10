@echo off
title Netflix Discord RPC Bridge
color 0c
echo ====================================================
echo      NETFLIX DISCORD RICH PRESENCE - BRIDGE
echo ====================================================
echo.
echo Starting local TypeScript bridge...
echo Please ensure Discord Desktop is running on your PC!
echo.

cd /d "%~dp0bridge"
npm run start

pause
