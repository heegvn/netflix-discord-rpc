Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = strDir & "\bridge"
WshShell.Run "cmd /c node dist/index.js", 0, False
Set WshShell = Nothing
Set fso = Nothing
