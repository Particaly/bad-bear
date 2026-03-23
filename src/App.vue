<template>
  <div class="container">
    <!-- 检查状态中 -->
    <div v-if="status === 'checking'" class="status-box">
      <div class="loading"></div>
      <p>正在检查插件状态...</p>
    </div>

    <!-- 已注入 - 显示插件内容 -->
    <div v-else-if="status === 'injected'" class="injected">
      <div class="success-icon">✓</div>
      <h3>插件已激活</h3>
      <p>当前功能: {{ route || '主页面' }}</p>
    </div>

    <!-- 不可注入 -->
    <div v-else-if="status === 'cannot-inject'" class="error-box">
      <div class="error-icon">✕</div>
      <h3>无法自动注入</h3>
      <p>{{ errorMessage }}</p>
    </div>

    <!-- 请求注入确认 -->
    <div v-else-if="status === 'confirm-inject'" class="confirm-box">
      <div class="warning-icon">⚠</div>
      <h3>需要注入插件</h3>
      <p>检测到插件尚未被系统识别，需要修改 ZTools 主程序以启用此插件。</p>

      <div class="disclaimer">
        <h4>⚠️ 重要提示</h4>
        <ul>
          <li>此操作将解压并修改 ZTools 主程序，重新打包为 <code>app.new.asar</code></li>
          <li>手动退出后，脚本会自动将 <code>app.asar</code> 备份为 <code>app.bak.asar</code></li>
          <li>完成后将 <code>app.new.asar</code> 替换为 <code>app.asar</code> 并自动重启 ZTools</li>
          <li>如需恢复，将 <code>app.bak.asar</code> 重命名为 <code>app.asar</code> 即可</li>
          <li><strong>使用本插件的风险由您自行承担</strong></li>
        </ul>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="startInjection">同意并注入</button>
        <button class="btn btn-secondary" @click="cancelInjection">取消</button>
      </div>
    </div>

    <!-- 注入进行中 -->
    <div v-else-if="status === 'injecting'" class="status-box">
      <div class="loading"></div>
      <p>{{ injectStep }}</p>
      <div class="progress-bar">
        <div class="progress" :style="{ width: injectProgress + '%' }"></div>
      </div>
    </div>

    <!-- 注入成功 -->
    <div v-else-if="status === 'inject-success'" class="success-box">
      <div class="success-icon">✓</div>
      <h3>注入成功！</h3>
      <p>替换脚本已在后台就绪，请手动退出 ZTools。脚本检测到进程退出后将自动完成备份、替换并重启。</p>
      <div class="backup-info">
        <p>备份文件: <code>{{ backupPath }}</code></p>
        <p>日志文件: <code>{{ logPath }}</code></p>
        <p class="restore-tip">恢复方法: 将 <code>app.bak.asar</code> 重命名为 <code>app.asar</code> 即可还原</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="copyCompleteInfo">复制完成信息</button>
      </div>
    </div>

    <!-- 注入失败 -->
    <div v-else-if="status === 'inject-error'" class="error-box">
      <div class="error-icon">✕</div>
      <h3>注入失败</h3>
      <p>{{ errorMessage }}</p>
      <div class="actions">
        <button class="btn btn-secondary" @click="retryCheck">重新检查</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

// 状态类型
type Status =
  | 'checking'
  | 'injected'
  | 'cannot-inject'
  | 'confirm-inject'
  | 'injecting'
  | 'inject-success'
  | 'inject-error'

const route = ref('')
const enterAction = ref<any>({})
const status = ref<Status>('checking')
const errorMessage = ref('')
const injectStep = ref('')
const injectProgress = ref(0)
const backupPath = ref('')
const logPath = ref('')
const resourcesPath = ref('')

// 步骤进度映射
const stepProgress: Record<string, number> = {
  '正在解压 app.asar...': 20,
  '正在读取并分析代码...': 40,
  '正在注入插件名称...': 60,
  '正在打包 app.new.asar...': 80,
  '准备重启，正在启动替换脚本...': 100,
}

// 插件名称
const PLUGIN_NAME = 'bad-bear'
const TARGET_FILE = 'out/main/index.js'

// 更新注入进度
function updateInjectStep(step: string) {
  console.log(`[BadBear] Step: ${step}`)
  injectStep.value = step
  injectProgress.value = stepProgress[step] || injectProgress.value + 5
}

// 检查插件是否已被注入
async function checkInjectedStatus(): Promise<boolean> {
  console.log('[BadBear] Checking if plugin is already injected...')
  try {
    const plugins = await window.ztools.internal.getAllPlugins()
    console.log('[BadBear] Current plugins:', plugins)
    const isInjected = plugins.some((t: any) => t.name === PLUGIN_NAME)
    console.log('[BadBear] Is injected:', isInjected)
    return isInjected
  } catch (e) {
    console.log('[BadBear] Check failed (not injected yet):', e)
    return false
  }
}

// 获取资源目录
function getResourcesPath(): string {
  const exePath = window.ztools.getPath('exe')
  console.log('[BadBear] Exe path:', exePath)
  // exePath 通常是类似 "C:\...\ZTools.exe" 的路径
  // resources 目录在同级
  const exeDir = window.services.path.dirname(exePath)
  const resourcesPath = window.services.path.join(exeDir, 'resources')
  console.log('[BadBear] Resources path:', resourcesPath)
  return resourcesPath
}

// 执行注入
async function performInjection(): Promise<boolean> {
  console.log('[BadBear] ========== Starting injection process ==========')
  try {
    updateInjectStep('正在解压 app.asar...')

    const appAsarPath = window.services.path.join(resourcesPath.value, 'app.asar')
    const appFolderPath = window.services.path.join(resourcesPath.value, 'app')
    const targetFilePath = window.services.path.join(appFolderPath, TARGET_FILE)

    console.log('[BadBear] Paths:')
    console.log('  - app.asar:', appAsarPath)
    console.log('  - app folder:', appFolderPath)
    console.log('  - target file:', targetFilePath)

    // 1. 解压 app.asar → app/ 目录
    //    如果 app/ 目录已存在（可能上次注入中断），先清理
    if (window.services.exists(appFolderPath)) {
      console.log('[BadBear] app/ folder already exists, cleaning up...')
      window.services.removeDirectory(appFolderPath)
    }

    console.log('[BadBear] Extracting app.asar...')
    window.services.extractAsar(appAsarPath, appFolderPath)
    console.log('[BadBear] Extraction complete')

    // 2. 读取目标文件
    updateInjectStep('正在读取并分析代码...')
    console.log('[BadBear] Reading target file...')
    const originalCode = window.services.readFile(targetFilePath, 'utf-8')
    console.log('[BadBear] File size:', originalCode.length, 'chars')

    // 3. 使用 AST 注入插件名称
    updateInjectStep('正在注入插件名称...')
    console.log('[BadBear] Parsing AST and injecting plugin name...')

    const { code: modifiedCode } = window.services.transformCode(
      originalCode,
      {
        VariableDeclarator(path: any) {
          // 查找 INTERNAL_PLUGIN_NAMES 的定义
          if (
            path.node.id.type === 'Identifier' &&
            path.node.id.name === 'INTERNAL_PLUGIN_NAMES'
          ) {
            console.log('[BadBear] Found INTERNAL_PLUGIN_NAMES declaration')
            const init = path.node.init
            if (init && init.type === 'ArrayExpression') {
              // 检查是否已包含 bad-bear
              const hasBadBear = init.elements.some((el: any) => {
                if (el && el.type === 'StringLiteral') {
                  return el.value === PLUGIN_NAME
                }
                return false
              })

              console.log('[BadBear] Current elements:', init.elements.length)
              console.log('[BadBear] Has bad-bear:', hasBadBear)

              // 如果没有则添加
              if (!hasBadBear) {
                init.elements.push(
                  window.services.astTypes.stringLiteral(PLUGIN_NAME),
                )
                console.log('[BadBear] Added bad-bear to INTERNAL_PLUGIN_NAMES')
              } else {
                console.log('[BadBear] bad-bear already exists, skipping')
              }
            }
          }
        },
      },
      {}, // parse options
      { retainLines: true }, // generate options - 保留行号以便调试
    )
    console.log('[BadBear] Modified code size:', modifiedCode.length, 'chars')

    // 4. 写回修改后的文件到临时目录
    console.log('[BadBear] Writing modified file...')
    window.services.writeFile(targetFilePath, modifiedCode)
    console.log('[BadBear] File written')

    // 5. 将修改后的 app/ 目录重新打包为 app.new.asar
    updateInjectStep('正在打包 app.new.asar...')
    const newAsarPath = window.services.path.join(resourcesPath.value, 'app.new.asar')
    console.log('[BadBear] Packing app.new.asar:', newAsarPath)
    await window.services.createAsar(appFolderPath, newAsarPath)
    console.log('[BadBear] app.new.asar created')

    // 6. 清理临时解压目录
    console.log('[BadBear] Cleaning up temp app/ folder...')
    window.services.removeDirectory(appFolderPath)
    console.log('[BadBear] Cleanup complete')

    // 7. 启动外部替换脚本（detached），脚本等待 ZTools 退出后执行：
    //    - app.asar -> app.bak.asar（备份）
    //    - app.new.asar -> app.asar（替换）
    //    - 重启 ZTools
    //    脚本由 services.js 按当前 OS 从 preload 同级目录自动定位
    updateInjectStep('准备重启，正在启动替换脚本...')
    const exePath = window.ztools.getPath('exe')
    // 日志文件放在 userData 目录下
    logPath.value = window.services.path.join(
      window.ztools.getPath('userData'),
      'plugins',
      PLUGIN_NAME,
      'swap-asar.log',
    )
    console.log('[BadBear] Launching swap script')
    console.log('[BadBear] resourcesPath:', resourcesPath.value)
    console.log('[BadBear] exePath:', exePath)
    console.log('[BadBear] logPath:', logPath.value)
    window.services.spawnDetached([resourcesPath.value, exePath, logPath.value])
    console.log('[BadBear] Swap script launched')

    // 设置备份路径用于显示（实际备份由脚本执行）
    backupPath.value = window.services.path.join(resourcesPath.value, 'app.bak.asar')

    console.log('[BadBear] ========== Injection successful ==========')
    return true
  } catch (e: any) {
    console.error('[BadBear] Injection failed:', e)
    errorMessage.value = e.message || String(e)
    return false
  }
}

// 开始注入
async function startInjection() {
  console.log('[BadBear] User confirmed injection')
  status.value = 'injecting'
  injectProgress.value = 0

  const success = await performInjection()
  if (success) {
    injectProgress.value = 100
    status.value = 'inject-success'
    console.log('[BadBear] Status changed to: inject-success')
  } else {
    status.value = 'inject-error'
    console.log('[BadBear] Status changed to: inject-error')
  }
}

// 取消注入
function cancelInjection() {
  console.log('[BadBear] User cancelled injection')
  status.value = 'cannot-inject'
  errorMessage.value = '用户取消注入操作'
}

// 重试检查
function retryCheck() {
  console.log('[BadBear] User requested retry')
  status.value = 'checking'
  checkAndHandleInjection()
}

// 复制完成信息到剪贴板
function copyCompleteInfo() {
  const info = `插件注入完成！请手动退出 ZTools，脚本将自动完成备份、替换并重启。

备份文件: ${backupPath.value}
日志文件: ${logPath.value}
恢复方法: 将 app.bak.asar 重命名为 app.asar 即可还原`

  navigator.clipboard.writeText(info).then(() => {
    window.ztools.showToast('完成信息已复制，请手动退出 ZTools')
  }).catch(() => {
    window.ztools.showToast('请手动退出 ZTools')
  })
}

// 检查并处理注入逻辑
async function checkAndHandleInjection() {
  console.log('[BadBear] ========== Starting check and handle ==========')
  // 首先检查是否已注入
  const isInjected = await checkInjectedStatus()
  if (isInjected) {
    console.log('[BadBear] Plugin already injected, status: injected')
    status.value = 'injected'
    return
  }

  // 获取资源目录
  resourcesPath.value = getResourcesPath()
  const appAsarPath = window.services.path.join(resourcesPath.value, 'app.asar')
  const appFolderPath = window.services.path.join(resourcesPath.value, 'app')

  // 检查是否已存在 app.new.asar（之前注入过但未重启完成）
  const newAsarPath = window.services.path.join(resourcesPath.value, 'app.new.asar')
  if (window.services.exists(newAsarPath)) {
    console.log('[BadBear] app.new.asar already exists, injection was done previously')
    status.value = 'inject-success'
    backupPath.value = window.services.path.join(resourcesPath.value, 'app.bak.asar')
    logPath.value = window.services.path.join(
      window.ztools.getPath('userData'),
      'plugins',
      PLUGIN_NAME,
      'swap-asar.log',
    )
    return
  }

  // 检查 app.asar 是否存在
  console.log('[BadBear] Checking if app.asar exists:', appAsarPath)
  if (!window.services.exists(appAsarPath)) {
    console.log('[BadBear] app.asar not found, status: cannot-inject')
    status.value = 'cannot-inject'
    errorMessage.value = `未找到 app.asar 文件，无法进行注入\n路径: ${appAsarPath}`
    return
  }

  console.log('[BadBear] app.asar found, status: confirm-inject')
  // 显示注入确认
  status.value = 'confirm-inject'
}

// 插件进入回调
onMounted(() => {
  console.log('[BadBear] ========== Plugin mounted ==========')

  window.ztools.onPluginEnter((action) => {
    console.log('[BadBear] Plugin enter:', action)
    route.value = action.code
    enterAction.value = action
  })

  window.ztools.onPluginOut(() => {
    console.log('[BadBear] Plugin out')
    route.value = ''
  })

  // 启动检查
  console.log('[BadBear] Starting initial check...')
  checkAndHandleInjection()
})
</script>

<style scoped>
.container {
  padding: 20px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-box,
.injected,
.error-box,
.confirm-box,
.success-box {
  text-align: center;
  max-width: 500px;
}

.loading {
  width: 40px;
  height: 40px;
  margin: 0 auto 20px;
  border: 3px solid #e0e0e0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-top: 20px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.success-icon,
.error-icon,
.warning-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
}

.success-icon {
  background: #10b981;
  color: white;
}

.error-icon {
  background: #ef4444;
  color: white;
}

.warning-icon {
  background: #f59e0b;
  color: white;
}

h3 {
  margin: 0 0 10px;
  font-size: 20px;
}

p {
  margin: 10px 0;
  color: #666;
}

.disclaimer {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 15px;
  margin: 20px 0;
  text-align: left;
}

.disclaimer h4 {
  margin: 0 0 10px;
  color: #92400e;
  font-size: 14px;
}

.disclaimer ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #78350f;
}

.disclaimer li {
  margin: 5px 0;
}

.disclaimer code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.btn {
  padding: 0px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.backup-info {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 10px;
  margin: 15px 0;
}

.restore-tip {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.backup-info code {
  font-size: 12px;
  color: #4b5563;
  word-break: break-all;
}
</style>
