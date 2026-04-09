Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd /k ""cd /d C:\Users\Badillon\Projeto_Enfermaria\enfermaria && pnpm nx serve api""", 1, False
oShell.Run "cmd /k ""cd /d C:\Users\Badillon\Projeto_Enfermaria\enfermaria && pnpm nx dev web""", 1, False
