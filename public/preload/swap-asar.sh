#!/bin/bash
# ============================================
# swap-asar.sh
#
# 外部脚本，在 ZTools 退出后执行 asar 替换。
#
# 用法:
#   bash swap-asar.sh <resourcesDir> <ztoolsExePath> [logFilePath]
#
# 流程:
#   1. 轮询检测 ZTools 进程是否退出
#   2. 退出后: app.asar -> app.bak.asar（备份）
#              app.new.asar -> app.asar（替换）
#   3. 重启 ZTools
# ============================================

RESOURCES_DIR="$1"
ZTOOLS_EXE="$2"
LOG_FILE="$3"
APP_ASAR="$RESOURCES_DIR/app.asar"
NEW_ASAR="$RESOURCES_DIR/app.new.asar"
BAK_ASAR="$RESOURCES_DIR/app.bak.asar"
PROCESS_NAME="$(basename "$ZTOOLS_EXE")"
ZTOOLS_DIR="$(dirname "$ZTOOLS_EXE")"
LOCK_FILE="/tmp/ztools_swap_asar.lock"

# ===== 日志函数 =====
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
  # 删除锁文件
  rm -f "$LOCK_FILE" 2>/dev/null
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
    log "错误：asar 替换成功，但重启 ZTools 失败"
    error_exit
  fi
  log "完成：已启动 ZTools"
}

# ===== 检查是否已有实例在运行 =====
if [ -f "$LOCK_FILE" ]; then
  # 锁文件存在，退出
  exit 0
fi

# 创建锁文件
date > "$LOCK_FILE"

# ===== 主流程 =====
log "============================================"
log "  swap-asar.sh STARTED"
log "============================================"
log "resourcesDir: $RESOURCES_DIR"
log "ztoolsExePath: $ZTOOLS_EXE"
log "logFilePath: $LOG_FILE"

# 参数校验
if [ -z "$RESOURCES_DIR" ]; then
  log "ERROR: Missing resourcesDir argument"
  echo "Usage: swap-asar.sh <resourcesDir> <ztoolsExePath> [logFilePath]"
  error_exit
fi
if [ -z "$ZTOOLS_EXE" ]; then
  log "ERROR: Missing ztoolsExePath argument"
  echo "Usage: swap-asar.sh <resourcesDir> <ztoolsExePath> [logFilePath]"
  error_exit
fi

# 路径校验
if [ ! -d "$RESOURCES_DIR" ]; then
  log "ERROR: resourcesDir does not exist: $RESOURCES_DIR"
  error_exit
fi
if [ ! -f "$ZTOOLS_EXE" ]; then
  log "ERROR: ztoolsExePath does not exist: $ZTOOLS_EXE"
  error_exit
fi

APP_ASAR="$RESOURCES_DIR/app.asar"
NEW_ASAR="$RESOURCES_DIR/app.new.asar"
BAK_ASAR="$RESOURCES_DIR/app.bak.asar"

log "appAsarPath: $APP_ASAR"
log "newAsarPath: $NEW_ASAR"
log "bakAsarPath: $BAK_ASAR"

# 进程名：取可执行文件的 basename
PROCESS_NAME=$(basename "$ZTOOLS_EXE")
log "processName: $PROCESS_NAME"

# ===== 等待 ZTools 退出 =====
log "Waiting for $PROCESS_NAME to exit..."
WAIT_COUNT=0

while true; do
  if ! pgrep -x "$PROCESS_NAME" > /dev/null 2>&1; then
    break
  fi
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
    SECONDS_ELAPSED=$((WAIT_COUNT / 2))
    log "Still waiting... (${SECONDS_ELAPSED}s)"
  fi
  sleep 0.5
done
log "$PROCESS_NAME has exited!"
log "Wait 3 seconds to ensure file handles are released..."
sleep 3

# ===== 开始替换 =====
log "=== Starting asar swap ==="

# 检查 app.new.asar
if [ ! -f "$NEW_ASAR" ]; then
  log "ERROR: app.new.asar not found at: $NEW_ASAR"
  log "Directory contents:"
  for f in "$RESOURCES_DIR"/*; do
    log "  - $(basename "$f")"
  done
  error_exit
fi
log "OK: app.new.asar exists"

# 步骤1: 备份 app.asar -> app.bak.asar
log "Step 1: Backing up app.asar -> app.bak.asar"
if [ -f "$APP_ASAR" ]; then
  if [ -f "$BAK_ASAR" ]; then
    log "  Removing existing app.bak.asar..."
    rm -f "$BAK_ASAR"
    if [ -f "$BAK_ASAR" ]; then
      log "ERROR: Failed to delete existing app.bak.asar"
      error_exit
    fi
  fi
  log "  Renaming app.asar -> app.bak.asar"
  mv "$APP_ASAR" "$BAK_ASAR"
  if [ $? -ne 0 ]; then
    log "ERROR: Failed to rename app.asar to app.bak.asar"
    error_exit
  fi
  log "  OK: Backup complete"
else
  log "  WARNING: app.asar not found, skipping backup"
fi

# 步骤2: 替换 app.new.asar -> app.asar
log "Step 2: Replacing app.new.asar -> app.asar"
mv "$NEW_ASAR" "$APP_ASAR"
if [ $? -ne 0 ]; then
  log "ERROR: Failed to rename app.new.asar to app.asar"
  error_exit
fi
log "  OK: Swap complete"

# ===== 重启 ZTools =====
launch_ztools

# 删除锁文件
rm -f "$LOCK_FILE" 2>/dev/null

log "============================================"
log "  swap-asar.sh 执行成功"
log "============================================"

echo ""
echo "操作已完成！按回车键关闭窗口..."
read -r
exit 0
