@echo off
title Enable Auto-Start
color 0a

set "SCRIPT_DIR=%~dp0"
set "TARGET_VBS=%SCRIPT_DIR%start-bridge-silent.vbs"
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NetflixDiscordBridge.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

echo ====================================================
echo Auto-start enabled successfully!
echo The bridge will now run silently in the background
echo whenever Windows starts, just like PreMiD.
echo ====================================================
echo.
pause
