#!/bin/bash

RESOURCES_DIR="$1"
ZTOOLS_EXE="$2"
LOG_FILE="$3"
APP_ASAR="$RESOURCES_DIR/app.asar"
BAK_ASAR="$RESOURCES_DIR/app.bak.asar"
PROCESS_NAME="$(basename "$ZTOOLS_EXE")"
ZTOOLS_DIR="$(dirname "$ZTOOLS_EXE")"
LOCK_FILE="/tmp/ztools_restore_asar.lock"

log() {
  local msg="$1"
  echo "$msg"
  if [ -n "$LOG_FILE" ]; then
    local dir
    dir=$(dirname "$LOG_FILE")
    [ ! -d "$dir" ] && mkdir -p "$dir"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" >> "$LOG_FILE"
  fi
}

error_exit() {
  echo ""
  echo "============================================"
  echo "  [错误] 脚本执行失败，请查看上方输出。"
  echo "  按回车键关闭窗口..."
  echo "============================================"
  read -r
  exit 1
}

launch_ztools() {
  # 检查是否已经有 ZTools 在运行
  if pgrep -x "$PROCESS_NAME" > /dev/null 2>&1; then
    log "检测到 ZTools 已经在运行，跳过自动启动"
    return 0
  fi
  log "=== 正在启动 ZTools：$ZTOOLS_EXE ==="
  (
    cd "$ZTOOLS_DIR" || exit 1
    nohup "$ZTOOLS_EXE" < /dev/null > /dev/null 2>&1 &
  )
  if [ $? -ne 0 ]; then
    log "错误：asar 恢复成功，但重启 ZTools 失败"
    error_exit
  fi
  log "完成：已通过独立进程启动 ZTools"
}

# ===== 检查是否已有实例在运行 =====
if [ -f "$LOCK_FILE" ]; then
  # 检查锁文件是否在 5 分钟内
  if [ -n "$LOCK_FILE" ]; then
    CURRENT_TIME=$(date +%s)
    LOCK_TIME=$(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE" 2>/dev/null || echo "0")
    AGE=$((CURRENT_TIME - LOCK_TIME))
    if [ $AGE -lt 300 ]; then
      exit 0
    fi
  fi
fi

# 创建锁文件
date > "$LOCK_FILE"

log "============================================"
log "  restore-asar.sh 已启动"
log "============================================"
log "资源目录：$RESOURCES_DIR"
log "ZTools 可执行文件：$ZTOOLS_EXE"
log "日志文件：$LOG_FILE"
log "进程名：$PROCESS_NAME"

if [ -z "$RESOURCES_DIR" ]; then
  log "错误：缺少 resourcesDir 参数"
  echo "用法：restore-asar.sh <resourcesDir> <ztoolsExePath> [logFilePath]"
  error_exit
fi
if [ -z "$ZTOOLS_EXE" ]; then
  log "错误：缺少 ztoolsExePath 参数"
  echo "用法：restore-asar.sh <resourcesDir> <ztoolsExePath> [logFilePath]"
  error_exit
fi
if [ ! -d "$RESOURCES_DIR" ]; then
  log "错误：resourcesDir 不存在：$RESOURCES_DIR"
  error_exit
fi
if [ ! -f "$ZTOOLS_EXE" ]; then
  log "错误：ztoolsExePath 不存在：$ZTOOLS_EXE"
  error_exit
fi

log "app.asar 路径：$APP_ASAR"
log "app.bak.asar 路径：$BAK_ASAR"

log "正在等待 $PROCESS_NAME 退出..."
WAIT_COUNT=0
while true; do
  if ! pgrep -x "$PROCESS_NAME" > /dev/null 2>&1; then
    break
  fi
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
    log "仍在等待...（${WAIT_COUNT} 秒）"
  fi
  sleep 1
done
log "$PROCESS_NAME 已退出"

log "=== 开始恢复 asar ==="
if [ ! -f "$BAK_ASAR" ]; then
  log "错误：未找到 app.bak.asar：$BAK_ASAR"
  log "恢复已中止：在确认备份存在之前不会删除 app.asar"
  error_exit
fi
log "确认：app.bak.asar 存在"

if [ -f "$APP_ASAR" ]; then
  log "步骤 1：删除当前修改过的 app.asar"
  rm -f "$APP_ASAR"
  if [ -f "$APP_ASAR" ]; then
    log "错误：删除 app.asar 失败"
    error_exit
  fi
  log "  完成：已删除 app.asar"
else
  log "步骤 1：未找到 app.asar，跳过删除"
fi

log "步骤 2：恢复 app.bak.asar -> app.asar"
mv "$BAK_ASAR" "$APP_ASAR"
if [ $? -ne 0 ]; then
  log "错误：重命名 app.bak.asar 到 app.asar 失败"
  error_exit
fi
log "  完成：恢复成功"

launch_ztools

log "============================================"
log "  restore-asar.sh 执行成功"
log "============================================"

echo ""
echo "操作已完成！按回车键关闭窗口..."
read -r
exit 0
