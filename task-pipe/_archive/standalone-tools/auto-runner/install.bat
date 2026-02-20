@echo off
REM 安裝 Auto Runner 依賴

echo.
echo ========================================
echo   Auto Runner - 安裝依賴
echo ========================================
echo.

cd /d "%~dp0"

echo 正在安裝依賴套件...
echo.

npm install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   安裝成功！
    echo ========================================
    echo.
    echo 現在可以執行:
    echo   node index.cjs --clean --verbose
    echo.
) else (
    echo.
    echo ========================================
    echo   安裝失敗！
    echo ========================================
    echo.
    echo 請檢查錯誤訊息
    echo.
)

pause
