Set oShell = CreateObject("WScript.Shell")
Set oFso = CreateObject("Scripting.FileSystemObject")
pasta = oFso.GetParentFolderName(WScript.ScriptFullName) & "\enfermaria"
oShell.Run "cmd /k ""cd /d " & pasta & " && pnpm nx serve api""", 1, False
oShell.Run "cmd /k ""cd /d " & pasta & " && pnpm nx dev web""", 1, False
