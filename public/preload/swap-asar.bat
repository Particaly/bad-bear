@echo off
chcp 65001 >nul 2>&1
title swap-asar runner
setlocal enabledelayedexpansion

:: ============================================
:: swap-asar.bat
::
:: 外部脚本，在 ZTools 退出后执行 asar 替换。
::
:: 用法:
::   swap-asar.bat <resourcesDir> <ztoolsExePath> [logFilePath]
::
:: 流程:
::   1. 轮询检测 ZTools 进程是否退出
::   2. 退出后: app.asar -> app.bak.asar（备份）
::              app.new.asar -> app.asar（替换）
::   3. 重启 ZTools
:: ============================================

set "RESOURCES_DIR=%~1"
set "ZTOOLS_EXE=%~2"
set "LOG_FILE=%~3"

:: ===== 日志函数 =====
:: call :log "message"
goto :start

:log
set "MSG=%~1"
echo %MSG%
if defined LOG_FILE (
    echo [%date% %time%] %MSG%>>"%LOG_FILE%"
)
goto :eof

:: ===== 主流程 =====
:start

call :log "============================================"
call :log "  swap-asar.bat STARTED"
call :log "============================================"
call :log "resourcesDir: %RESOURCES_DIR%"
call :log "ztoolsExePath: %ZTOOLS_EXE%"
call :log "logFilePath: %LOG_FILE%"

:: 参数校验
if "%RESOURCES_DIR%"=="" (
    call :log "ERROR: Missing resourcesDir argument"
    echo Usage: swap-asar.bat ^<resourcesDir^> ^<ztoolsExePath^> [logFilePath]
    goto :error_exit
)
if "%ZTOOLS_EXE%"=="" (
    call :log "ERROR: Missing ztoolsExePath argument"
    echo Usage: swap-asar.bat ^<resourcesDir^> ^<ztoolsExePath^> [logFilePath]
    goto :error_exit
)

:: 路径校验
if not exist "%RESOURCES_DIR%" (
    call :log "ERROR: resourcesDir does not exist: %RESOURCES_DIR%"
    goto :error_exit
)
if not exist "%ZTOOLS_EXE%" (
    call :log "ERROR: ztoolsExePath does not exist: %ZTOOLS_EXE%"
    goto :error_exit
)

set "APP_ASAR=%RESOURCES_DIR%\app.asar"
set "NEW_ASAR=%RESOURCES_DIR%\app.new.asar"
set "BAK_ASAR=%RESOURCES_DIR%\app.bak.asar"

call :log "appAsarPath: %APP_ASAR%"
call :log "newAsarPath: %NEW_ASAR%"
call :log "bakAsarPath: %BAK_ASAR%"

:: ===== 等待 ZTools 退出 =====
call :log "Waiting for ZTools.exe to exit..."
set WAIT_COUNT=0

:wait_loop
tasklist /FI "IMAGENAME eq ZTools.exe" /NH 2>nul | find /i "ZTools.exe" >nul
if %ERRORLEVEL%==0 (
    set /a WAIT_COUNT+=1
    set /a MOD=WAIT_COUNT %% 10
    if !MOD!==0 (
        set /a SECONDS=WAIT_COUNT
        call :log "Still waiting... (!SECONDS!s)"
    )
    timeout /t 1 /nobreak >nul 2>&1
    goto :wait_loop
)
call :log "ZTools.exe has exited!"

:: ===== 开始替换 =====
call :log "=== Starting asar swap ==="

:: 检查 app.new.asar
if not exist "%NEW_ASAR%" (
    call :log "ERROR: app.new.asar not found at: %NEW_ASAR%"
    call :log "Directory contents:"
    for %%f in ("%RESOURCES_DIR%\*") do call :log "  - %%~nxf"
    goto :error_exit
)
call :log "OK: app.new.asar exists"

:: 步骤1: 备份 app.asar -> app.bak.asar
call :log "Step 1: Backing up app.asar -> app.bak.asar"
if exist "%APP_ASAR%" (
    if exist "%BAK_ASAR%" (
        call :log "  Removing existing app.bak.asar..."
        del /f "%BAK_ASAR%"
        if exist "%BAK_ASAR%" (
            call :log "ERROR: Failed to delete existing app.bak.asar"
            goto :error_exit
        )
    )
    call :log "  Renaming app.asar -> app.bak.asar"
    move /y "%APP_ASAR%" "%BAK_ASAR%" >nul
    if errorlevel 1 (
        call :log "ERROR: Failed to rename app.asar to app.bak.asar"
        goto :error_exit
    )
    call :log "  OK: Backup complete"
) else (
    call :log "  WARNING: app.asar not found, skipping backup"
)

:: 步骤2: 替换 app.new.asar -> app.asar
call :log "Step 2: Replacing app.new.asar -> app.asar"
move /y "%NEW_ASAR%" "%APP_ASAR%" >nul
if errorlevel 1 (
    call :log "ERROR: Failed to rename app.new.asar to app.asar"
    goto :error_exit
)
call :log "  OK: Swap complete"

:: ===== 重启 ZTools =====
call :log "=== Launching ZTools: %ZTOOLS_EXE% ==="
start "" "%ZTOOLS_EXE%"
if errorlevel 1 (
    call :log "ERROR: Failed to launch ZTools"
    goto :error_exit
)
call :log "OK: ZTools launched"

call :log "============================================"
call :log "  swap-asar.bat COMPLETED SUCCESSFULLY"
call :log "============================================"

:: 成功，3秒后自动关闭
echo.
echo Done! Window will close in 3 seconds...
timeout /t 3 /nobreak >nul 2>&1
exit /b 0

:: ===== 错误退出 =====
:error_exit
echo.
echo ============================================
echo   [ERROR] Script failed! See above for details.
echo   Press any key to close...
echo ============================================
pause >nul
exit /b 1
