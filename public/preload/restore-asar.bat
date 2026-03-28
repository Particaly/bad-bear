@echo off
chcp 65001 >nul 2>&1
title 解除注入提示窗口
setlocal enabledelayedexpansion

set "RESOURCES_DIR=%~1"
set "ZTOOLS_EXE=%~2"
set "LOG_FILE=%~3"
set "ZTOOLS_DIR=%~dp2"
set "PROCESS_NAME=%~nx2"
set "APP_ASAR=%RESOURCES_DIR%\app.asar"
set "BAK_ASAR=%RESOURCES_DIR%\app.bak.asar"
set "LOCK_FILE=%TEMP%\ztools_restore_asar.lock"

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
powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Process -FilePath '%ZTOOLS_EXE%' -WorkingDirectory '%ZTOOLS_DIR:~0,-1%' | Out-Null; exit 0 } catch { Write-Error $_; exit 1 }"
if errorlevel 1 (
    call :log "错误：asar 恢复成功，但通过 PowerShell 重启 ZTools 失败"
    goto :error_exit
)
call :log "完成：已通过独立进程启动 ZTools"
goto :eof

:start
REM ===== 检查是否已有实例在运行 =====
if exist "%LOCK_FILE%" (
    findstr /c:"%LOCK_FILE%" "%LOCK_FILE%" >nul 2>&1
    if not errorlevel 1 (
        REM 检查锁文件是否是最近的（5分钟内）
        for %%A in ("%LOCK_FILE%") do set "LOCK_AGE=%%~tA"
        REM 锁文件存在，退出
        exit /b 0
    )
)

REM 创建锁文件
echo %DATE% %TIME% > "%LOCK_FILE%"

call :log "============================================"
call :log "  restore-asar.bat 已启动"
call :log "============================================"
call :log "资源目录：%RESOURCES_DIR%"
call :log "ZTools 可执行文件：%ZTOOLS_EXE%"
call :log "日志文件：%LOG_FILE%"
call :log "进程名：%PROCESS_NAME%"
call :log "提示：请保持此窗口开启，脚本会在检测到 ZTools 退出后自动继续。"

if "%RESOURCES_DIR%"=="" (
    call :log "错误：缺少 resourcesDir 参数"
    echo 用法：restore-asar.bat ^<resourcesDir^> ^<ztoolsExePath^> [logFilePath]
    goto :error_exit
)
if "%ZTOOLS_EXE%"=="" (
    call :log "错误：缺少 ztoolsExePath 参数"
    echo 用法：restore-asar.bat ^<resourcesDir^> ^<ztoolsExePath^> [logFilePath]
    goto :error_exit
)
if "%PROCESS_NAME%"=="" (
    call :log "错误：无法从 exe 路径推导进程名"
    goto :error_exit
)

if not exist "%RESOURCES_DIR%" (
    call :log "错误：resourcesDir 不存在：%RESOURCES_DIR%"
    goto :error_exit
)
if not exist "%ZTOOLS_EXE%" (
    call :log "错误：ztoolsExePath 不存在：%ZTOOLS_EXE%"
    goto :error_exit
)

call :log "app.asar 路径：%APP_ASAR%"
call :log "app.bak.asar 路径：%BAK_ASAR%"

call :log "正在等待 %PROCESS_NAME% 退出..."
set WAIT_COUNT=0

:wait_loop
call :is_process_running
if %ERRORLEVEL%==0 (
    set /a WAIT_COUNT+=1
    set /a MOD=WAIT_COUNT %% 10
    if !MOD!==0 (
        call :log "仍在等待...（!WAIT_COUNT! 秒）"
    )
    timeout /t 1 /nobreak >nul 2>&1
    goto :wait_loop
)
call :log "%PROCESS_NAME% 已退出"

call :log "=== 开始恢复 asar ==="
if not exist "%BAK_ASAR%" (
    call :log "错误：未找到 app.bak.asar：%BAK_ASAR%"
    call :log "恢复已中止：在确认备份存在之前不会删除 app.asar"
    goto :error_exit
)
call :log "确认：app.bak.asar 存在"

if exist "%APP_ASAR%" (
    call :log "步骤 1：删除当前修改过的 app.asar"
    del /f "%APP_ASAR%"
    if exist "%APP_ASAR%" (
        call :log "错误：删除 app.asar 失败"
        goto :error_exit
    )
    call :log "  完成：已删除 app.asar"
) else (
    call :log "步骤 1：未找到 app.asar，跳过删除"
)

call :log "步骤 2：恢复 app.bak.asar -> app.asar"
move /y "%BAK_ASAR%" "%APP_ASAR%" >nul
if errorlevel 1 (
    call :log "错误：重命名 app.bak.asar 到 app.asar 失败"
    goto :error_exit
)
call :log "  完成：恢复成功"

call :launch_ztools

REM 删除锁文件
if exist "%LOCK_FILE%" del "%LOCK_FILE%" 2>nul

call :log "============================================"
call :log "  restore-asar.bat 执行成功"
call :log "============================================"

echo.
echo 操作已完成！按任意键关闭窗口...
pause >nul
exit /b 0

:error_exit
REM 删除锁文件
if exist "%LOCK_FILE%" del "%LOCK_FILE%" 2>nul
echo.
echo ============================================
echo   [错误] 脚本执行失败，请查看上方输出。
echo   按任意键关闭窗口...
echo ============================================
pause >nul
exit /b 1
