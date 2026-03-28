<template>
  <div class="container" :class="{ 'container--market': status === 'injected' }">
    <PluginMarketPage
      v-if="status === 'injected'"
      class="market-page"
      :can-uninject="canUninject"
      @request-uninject="handleRequestUninject"
    />

    <div v-else-if="status === 'checking'" class="status-box">
      <div class="loading"></div>
      <p>正在检查插件状态...</p>
    </div>

    <div v-else-if="status === 'cannot-inject'" class="error-box">
      <div class="error-icon">✕</div>
      <h3>无法自动注入</h3>
      <p>{{ errorMessage }}</p>
    </div>

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
          <li>解除注入可在设置页一键触发，退出 ZTools 后会自动恢复原始 <code>app.asar</code></li>
          <li><strong>使用本插件的风险由您自行承担</strong></li>
        </ul>
      </div>

      <div class="agreement-consent">
        <label class="agreement-checkbox">
          <input v-model="hasAcceptedAgreement" type="checkbox" />
          <span>我已阅读并同意</span>
        </label>
        <button class="agreement-link" type="button" @click="openAgreementDialog">
          《{{ AGREEMENT_TITLE }}》
        </button>
      </div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="!hasAcceptedAgreement" @click="startInjection">
          同意并注入
        </button>
        <button class="btn btn-secondary" @click="cancelInjection">取消</button>
      </div>
    </div>

    <div v-else-if="status === 'injecting'" class="status-box">
      <div class="loading"></div>
      <p>{{ injectStep }}</p>
      <div class="progress-bar">
        <div class="progress" :style="{ width: injectProgress + '%' }"></div>
      </div>
    </div>

    <div v-else-if="status === 'inject-success'" class="success-box">
      <div class="success-icon">✓</div>
      <h3>注入成功！</h3>
      <p>
        替换脚本已在后台就绪，请手动退出 ZTools。<br>脚本检测到进程退出后将自动完成备份、替换并重启。
      </p>
      <div class="backup-info">
        <p>备份文件: <code>{{ backupPath }}</code></p>
        <p class="restore-tip">
          恢复方法: 在设置页点击“解除注入”，脚本会在退出 ZTools 后自动恢复并重启
        </p>
      </div>
    </div>

    <div v-else-if="status === 'restore-pending'" class="success-box">
      <div class="success-icon">✓</div>
      <h3>已准备解除注入</h3>
      <p>
        恢复脚本已在后台就绪，请手动退出 ZTools。<br>脚本检测到进程退出后会自动恢复备份并重启。
      </p>
      <div class="backup-info">
        <p>备份文件: <code>{{ backupPath }}</code></p>
      </div>
    </div>

    <div v-else-if="status === 'inject-error'" class="error-box">
      <div class="error-icon">✕</div>
      <h3>注入失败</h3>
      <p>{{ errorMessage }}</p>
      <div class="actions">
        <button class="btn btn-secondary" @click="retryCheck">重新检查</button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="isAgreementDialogVisible"
        class="agreement-dialog-mask"
        @click.self="closeAgreementDialog"
      >
        <div class="agreement-dialog-card">
          <div class="agreement-dialog-header">
            <h3 class="agreement-dialog-title">{{ AGREEMENT_TITLE }}</h3>
            <button class="agreement-dialog-close" type="button" @click="closeAgreementDialog">×</button>
          </div>
          <div class="agreement-dialog-content">{{ AGREEMENT_CONTENT }}</div>
          <div class="agreement-dialog-footer">
            <button class="btn btn-secondary" type="button" @click="closeAgreementDialog">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Toast
      :message="toastState.message"
      :type="toastState.type"
      :duration="toastState.duration"
      v-model:visible="toastState.visible"
    />
    <ConfirmDialog
      :visible="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @update:visible="confirmState.visible = $event"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { Teleport, onMounted, ref, watch } from 'vue'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { Toast, useToast } from './components/common/Toast'
import PluginMarketPage from './components/plugin-market/PluginMarketPage.vue'
import { initializeTheme } from './config/theme'
import {
  checkInjectedStatus,
  createPathContext,
  performInjection,
  scheduleRestore,
  useMarketRiskDialog,
} from './app'

const AGREEMENT_TITLE = '插件上传免责协议'
const AGREEMENT_CONTENT = `本协议（以下简称“本协议”）是用户（以下简称“您”）在上传本地插件至相关平台（以下简称“平台”）时，与平台运营方（以下简称“我方”）之间达成的法律协议。请您务必审慎阅读、充分理解本协议全部条款，特别是免除或限制我方责任的条款，以及您应履行的义务条款。您点击上传插件、确认提交等操作，即视为您已完整阅读、充分理解并自愿接受本协议所有条款的约束，若您不同意本协议任何条款，请勿进行插件上传操作。
一、插件上传前提与承诺

1.1 您承诺，您上传至平台的所有本地插件，均为您本人独立开发、拥有完整知识产权的作品，或已依法取得该插件原作者的书面授权（包括但不限于复制权、传播权、上传权等相关权利），授权范围涵盖本平台上传及相关展示、使用场景，且授权文件真实、合法、有效，不存在任何权利瑕疵。

1.2 您明确知晓并承诺，严禁上传任何收费类uTools插件的破解版、盗版、修改版及衍生侵权版本，严禁上传未经授权的付费插件破解文件、注册机、激活码等相关内容。若您违反本条款，由此产生的一切法律责任（包括但不限于侵权赔偿、行政处罚、刑事责任）均由您自行承担，我方有权立即删除相关插件、封禁您的上传权限，并保留追究您全部责任的权利。

1.3 您确认，您上传的插件内容合法合规，不包含任何违反国家法律法规、公序良俗、平台规则的内容，不包含恶意代码、木马、病毒、间谍程序等危害计算机系统安全的内容，不侵犯任何第三方的知识产权、肖像权、名誉权、隐私权等合法权益。

二、程序运行说明

2.1 您明确知晓并同意，您上传的插件在被平台处理、审核及后续被其他用户下载使用过程中，可能会侵入用户（包括您本人及其他下载该插件的用户）的计算机系统，对计算机的程序运行方式、相关设置等进行修改（包括但不限于插件自身的安装、运行、适配所需的必要修改）。

2.2 您承诺，您上传的插件所进行的上述修改，均为插件正常运行所必需，且不损害用户计算机系统的正常功能、不窃取用户计算机内的任何隐私信息、不影响用户计算机的安全稳定运行。若因插件自身设计、代码问题导致用户计算机系统受损、数据丢失等情况，全部责任由您自行承担，与我方无任何关联。

三、AI审核说明与免责条款

3.1 为保障平台及用户安全，您上传的所有插件将经过我方AI系统进行自动化审核，审核范围包括但不限于插件是否包含恶意行为、违规内容、侵权特征等。但AI审核仅为技术辅助手段，受技术局限，无法完全识别所有恶意行为、侵权内容及违规信息。

3.2 我方明确声明，不对您上传的插件的可靠性、安全性、合规性、完整性、适用性做任何明示或默示的保证，包括但不限于：不保证插件无bug、无错误、能够正常运行；不保证插件不包含隐藏的恶意代码、安全隐患；不保证插件符合所有国家法律法规及相关行业规范；不保证插件不侵犯任何第三方的合法权益。

3.3 因您上传的插件存在任何问题（包括但不限于恶意行为、安全漏洞、侵权、违规等）导致的任何损失（包括但不限于我方的损失、其他用户的损失、第三方的损失），均由您自行承担全部责任，我方不承担任何直接、间接、连带的赔偿责任、补偿责任及其他法律责任。

3.4 无论AI审核是否通过，均不视为我方对插件的合法性、安全性、可靠性作出任何认可或保证，也不免除您应承担的上述承诺及法律责任。若AI审核未发现插件存在的问题，后续引发的一切纠纷及责任，仍由您自行承担。

四、侵权处理

4.1 若您发现任何用户上传的插件存在侵权行为（包括但不限于侵犯您的知识产权、著作权等合法权益），或您自身上传的插件被第三方指控侵权，请立即发送邮件至我方指定邮箱：ohmyztools@gmail.com，邮件中需明确说明侵权插件名称、侵权事实、您的身份信息、相关权属证明及联系方式，以便我方及时核实处理。

4.2 我方在收到上述侵权投诉邮件后，将根据邮件内容进行核实，若确认存在侵权行为，有权立即删除相关侵权插件、封禁侵权用户的上传权限，并将相关情况告知投诉方及侵权方。但我方不承担任何侵权判定、调解、赔偿等相关责任，侵权纠纷由侵权方与被侵权方自行协商解决，或通过法律途径处理。

4.3 若因您上传的插件存在侵权行为，导致我方被第三方起诉、索赔或遭受其他损失（包括但不限于律师费、赔偿金、罚款等），您应全额赔偿我方的全部损失，并承担由此产生的一切法律责任。

五、其他条款

5.1 本协议自您上传插件之日起生效，有效期至您上传的插件被删除、下架之日止。

5.2 我方有权根据平台运营需要、国家法律法规变化等情况，对本协议进行修改、补充，修改后的协议将在平台相关页面公示，您再次上传插件即视为接受修改后的协议。

5.3 本协议未尽事宜，按照国家相关法律法规执行；若您与我方就本协议产生任何纠纷，双方应首先友好协商解决，协商不成的，任何一方均有权向我方所在地有管辖权的人民法院提起诉讼。

5.4 您确认，您已充分理解本协议所有条款的含义，知晓自身的权利与义务，自愿承担违反本协议可能产生的一切法律责任。`

type Status =
  | 'checking'
  | 'injected'
  | 'cannot-inject'
  | 'confirm-inject'
  | 'injecting'
  | 'inject-success'
  | 'restore-pending'
  | 'inject-error'

const status = ref<Status>('checking')
const errorMessage = ref('')
const injectStep = ref('')
const injectProgress = ref(0)
const backupPath = ref('')
const canUninject = ref(false)
const hasAcceptedAgreement = ref(false)
const isAgreementDialogVisible = ref(false)
const hasShownMarketRiskDialogThisSession = ref(false)
const {
  toastState,
  confirmState,
  handleConfirm,
  handleCancel,
  info,
  error: showErrorToast,
  confirm,
} = useToast()

const stepProgress: Record<string, number> = {
  '正在解压 app.asar...': 20,
  '正在读取并分析代码...': 40,
  '正在注入插件名称...': 60,
  '正在打包 app.new.asar...': 80,
  '准备重启，正在启动替换脚本...': 100,
}

const { hasDismissedMarketRiskDialog, openMarketRiskDialog } = useMarketRiskDialog({
  confirmAction: confirm,
})

function updateInjectStep(step: string) {
  injectStep.value = step
  injectProgress.value = stepProgress[step] || injectProgress.value + 5
}

function syncPathState(): void {
  const context = createPathContext()
  backupPath.value = context.backupPath
  canUninject.value = window.services.exists(context.backupPath)
}

function openAgreementDialog(): void {
  isAgreementDialogVisible.value = true
}

function closeAgreementDialog(): void {
  isAgreementDialogVisible.value = false
}

async function maybeShowMarketRiskDialog(): Promise<void> {
  if (
    status.value !== 'injected' ||
    hasDismissedMarketRiskDialog.value ||
    hasShownMarketRiskDialogThisSession.value
  ) {
    return
  }

  hasShownMarketRiskDialogThisSession.value = true
  await openMarketRiskDialog()
}

async function startInjection() {
  if (!hasAcceptedAgreement.value) {
    info('请先阅读并勾选《插件上传免责协议》')
    return
  }

  status.value = 'injecting'
  injectProgress.value = 0

  const result = await performInjection({ updateInjectStep })
  if (result.success) {
    injectProgress.value = 100
    backupPath.value = result.backupPath || backupPath.value
    canUninject.value = false
    status.value = 'inject-success'
  } else {
    errorMessage.value = result.error || '注入失败'
    status.value = 'inject-error'
  }
}

function cancelInjection() {
  status.value = 'cannot-inject'
  errorMessage.value = '用户取消注入操作'
}

function retryCheck() {
  status.value = 'checking'
  void checkAndHandleInjection()
}

async function handleRequestUninject(): Promise<void> {
  syncPathState()

  if (!canUninject.value) {
    showErrorToast(`未找到备份文件，无法解除注入\n路径: ${backupPath.value}`)
    return
  }

  const confirmed = await confirm({
    title: '确认解除注入',
    message:
      `以下操作你也可以手动操作\n` +
      `退出 ZTools 后，脚本会删除当前已修改的 app.asar，` +
      `将 app.bak.asar 恢复为 app.asar。\n\n` +
      `备份文件: \n${backupPath.value}`,
    type: 'info',
    confirmText: '解除注入',
    cancelText: '取消',
  })

  if (!confirmed) {
    return
  }

  const result = await scheduleRestore()
  if (!result.success) {
    showErrorToast(result.error || '启动恢复脚本失败')
    return
  }

  backupPath.value = result.backupPath || backupPath.value
  status.value = 'restore-pending'
  info('请手动退出 ZTools，恢复脚本会在后台自动完成还原')
}

async function checkAndHandleInjection() {
  confirmState.value.visible = false

  try {
    syncPathState()
    const context = createPathContext()
    const isInjected = await checkInjectedStatus()

    if (isInjected) {
      status.value = 'injected'
      return
    }

    if (window.services.exists(context.newAsarPath)) {
      status.value = 'inject-success'
      return
    }

    if (!window.services.exists(context.appAsarPath)) {
      status.value = 'cannot-inject'
      errorMessage.value = `未找到 app.asar 文件，无法进行注入\n路径: ${context.appAsarPath}`
      return
    }

    hasAcceptedAgreement.value = false
    isAgreementDialogVisible.value = false
    status.value = 'confirm-inject'
  } catch (error: any) {
    status.value = 'cannot-inject'
    errorMessage.value = error?.message || String(error)
  }
}

onMounted(() => {
  void initializeTheme()

  window.ztools.onPluginEnter(() => {})
  window.ztools.onPluginOut(() => {})

  watch(
    status,
    (value) => {
      if (value === 'injected') {
        void maybeShowMarketRiskDialog()
      }
    },
    { immediate: true },
  )

  syncPathState()
  void checkAndHandleInjection()
})
</script>

<style scoped>
.container {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 100%;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container--market {
  padding: 0;
  align-items: stretch;
  justify-content: stretch;
}

.market-page {
  flex: 1;
  min-height: 0;
}

.status-box,
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

.agreement-consent {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: -6px;
  text-align: left;
  color: #4b5563;
  font-size: 13px;
}

.agreement-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.agreement-checkbox input {
  margin: 0;
}

.agreement-link {
  border: none;
  padding: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}

.agreement-link:hover {
  color: #1d4ed8;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.btn {
  padding: 10px 20px;
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

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.agreement-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}

.agreement-dialog-card {
  width: min(640px, 100%);
  max-height: min(720px, 100%);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--dialog-bg, #fff);
  border: 1px solid var(--control-border, #d1d5db);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.agreement-dialog-header,
.agreement-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color, #e5e7eb);
}

.agreement-dialog-footer {
  justify-content: flex-end;
  border-bottom: none;
  border-top: 1px solid var(--divider-color, #e5e7eb);
}

.agreement-dialog-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-color, #111827);
}

.agreement-dialog-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.agreement-dialog-content {
  padding: 20px;
  overflow-y: auto;
  white-space: pre-wrap;
  text-align: left;
  line-height: 1.7;
  color: var(--text-secondary, #4b5563);
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
