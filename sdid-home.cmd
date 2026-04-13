@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%CD%"

set "CMD=node "%SCRIPT_DIR%sdid-core\home.cjs" --target="%PROJECT_ROOT%""

:parse
if "%~1"=="" goto run
set "CMD=%CMD% %~1"
shift
goto parse

:run
call %CMD%
