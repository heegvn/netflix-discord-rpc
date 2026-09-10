@echo off
title Stop Netflix Discord RPC Bridge
color 0c
echo Stopping Netflix Discord RPC Bridge on port 7777...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7777 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Bridge stopped.
ping 127.0.0.1 -n 2 >nul
