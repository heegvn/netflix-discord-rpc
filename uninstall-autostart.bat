@echo off
title Disable Auto-Start
color 0c

set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NetflixDiscordBridge.lnk"

if exist "%SHORTCUT%" (
    del "%SHORTCUT%"
    echo Auto-start disabled.
) else (
    echo Auto-start was not enabled.
)

pause
