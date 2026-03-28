@echo off
chcp 65001 >nul 2>&1
title swap-asar runner
setlocal enabledelayedexpansion

set "RESOURCES_DIR=%~1"
set "ZTOOLS_EXE=%~2"
set "LOG_FILE=%~3"
set "ZTOOLS_DIR=%~dp2"
set "PROCESS_NAME=%~nx2"
set "APP_ASAR=%RESOURCES_DIR%\app.asar"
set "NEW_ASAR=%RESOURCES_DIR%\app.new.asar"
set "BAK_ASAR=%RESOURCES_DIR%\app.bak.asar"
set "LOCK_FILE=%TEMP%\ztools_swap_asar.lock"

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

:is_process_running
powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "$targetExe = $env:ZTOOLS_EXE; $targetName = $env:PROCESS_NAME; $running = Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq $targetName -and $_.ExecutablePath -and $_.ExecutablePath -ieq $targetExe } | Select-Object -First 1; if ($running) { exit 0 } else { exit 1 }" >nul 2>&1
if "%ERRORLEVEL%"=="0" exit /b 0
if "%ERRORLEVEL%"=="1" exit /b 1
tasklist /FI "IMAGENAME eq %PROCESS_NAME%" /NH 2>nul | find /i "%PROCESS_NAME%" >nul
exit /b %ERRORLEVEL%

:launch_ztools
REM 检查是否已经有 ZTools 在运行
call :is_process_running
if %ERRORLEVEL%==0 (
    call :log "检测到 ZTools 已经在运行，跳过自动启动"
    goto :eof
)
call :log "=== 正在启动 ZTools：%ZTOOLS_EXE% ==="
start "" "%ZTOOLS_EXE%"
if errorlevel 1 (
    call :log "错误：asar 替换成功，但启动 ZTools 失败"
    goto :error_exit
)
call :log "完成：已启动 ZTools"
goto :eof

:: ===== 主流程 =====
:start
REM ===== 检查是否已有实例在运行 =====
if exist "%LOCK_FILE%" (
    REM 锁文件存在，退出
    exit /b 0
)

REM 创建锁文件
echo %DATE% %TIME% > "%LOCK_FILE%"

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
call :log "进程名：%PROCESS_NAME%"

:: ===== 等待 ZTools 退出 =====
call :log "正在等待 %PROCESS_NAME% 退出..."
set WAIT_COUNT=0

:wait_loop
call :is_process_running
if %ERRORLEVEL%==0 (
    set /a WAIT_COUNT+=1
    set /a MOD=WAIT_COUNT %% 10
    if !MOD!==0 (
        set /a SECONDS=WAIT_COUNT
        call :log "仍在等待...（!SECONDS! 秒）"
    )
    timeout /t 1 /nobreak >nul 2>&1
    goto :wait_loop
)
call :log "%PROCESS_NAME% 已退出"
call :log "等待 3 秒，确保文件句柄释放..."
timeout /t 3 /nobreak >nul 2>&1

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
call :launch_ztools

REM 删除锁文件
if exist "%LOCK_FILE%" del "%LOCK_FILE%" 2>nul

call :log "============================================"
call :log "  swap-asar.bat 执行成功"
call :log "============================================"

echo.
echo 操作已完成！按任意键关闭窗口...
pause >nul
exit /b 0

:: ===== 错误退出 =====
:error_exit
REM 删除锁文件
if exist "%LOCK_FILE%" del "%LOCK_FILE%" 2>nul
echo.
echo ============================================
echo   [ERROR] Script failed! See above for details.
echo   Press any key to close...
echo ============================================
pause >nul
exit /b 1
