@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /O2 /utf-8 uacapp.c /Fe:uacapp.exe /link advapi32.lib user32.lib shell32.lib ole32.lib oleaut32.lib ntdll.lib