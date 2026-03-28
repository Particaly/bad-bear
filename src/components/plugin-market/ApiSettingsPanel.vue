<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  baseUrl: string
  canUninject: boolean
  isRestorePending: boolean
}>()

const emit = defineEmits<{
  (e: 'save', value: string): void
  (e: 'uninject'): void
}>()

const draftBaseUrl = ref(props.baseUrl)

watch(
  () => props.baseUrl,
  (value) => {
    draftBaseUrl.value = value
  },
)

function submit(): void {
  emit('save', draftBaseUrl.value)
}

function requestUninject(): void {
  emit('uninject')
}
</script>

<template>
  <div class="settings-panel">
    <div class="card panel-card panel-hero">
      <h2 class="panel-title">设置</h2>
    </div>

    <div class="card panel-card settings-card">
      <div class="field-group">
        <label class="field-label" for="shop-api-base-url">API Base URL</label>
        <input
          id="shop-api-base-url"
          v-model="draftBaseUrl"
          class="text-input"
          type="text"
          placeholder="http://localhost:3000"
          @keydown.enter="submit"
        />
        <p class="field-help">输入 localhost:3000 时会自动补全为 http://localhost:3000，并去掉结尾斜杠。</p>
      </div>

      <div class="runtime-info">
        <span class="runtime-label">当前生效地址</span>
        <code class="runtime-value">{{ baseUrl }}</code>
      </div>

      <div class="action-row">
        <button class="btn btn-md btn-primary" @click="submit">保存地址</button>
      </div>
    </div>

    <div class="card panel-card manage-card">
      <div class="manage-header">
        <h3 class="manage-title">注入管理</h3>
        <p class="manage-description">
          恢复原始 <code>app.asar</code> 并移除当前注入。脚本会在你退出 ZTools 后自动执行恢复并尝试重启。
        </p>
      </div>

      <div class="manage-actions">
        <button class="btn btn-md btn-primary" :disabled="!canUninject || isRestorePending" @click="requestUninject">
          {{ isRestorePending ? '等待退出以完成恢复' : '解除注入' }}
        </button>
      </div>

      <p v-if="isRestorePending" class="manage-help">
        恢复脚本已在后台就绪，请手动退出 ZTools，脚本会自动恢复备份并重启。
      </p>
      <p v-else-if="!canUninject" class="manage-help">未检测到 app.bak.asar 备份文件，当前无法解除注入。</p>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  padding: 18px;
}

.panel-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
}

.panel-description {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.settings-card,
.manage-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.text-input {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  background: var(--bg-color);
  color: var(--text-color);
  outline: none;
}

.text-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.field-help {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.runtime-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface-elevated);
}

.runtime-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.runtime-value {
  display: block;
  overflow-x: auto;
  color: var(--text-color);
  font-size: 13px;
}

.action-row,
.manage-actions {
  display: flex;
  justify-content: flex-end;
}

.manage-card {
  border: 1px solid var(--divider-color);
}

.manage-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.manage-title {
  margin: 0;
  font-size: 16px;
  color: var(--text-color);
}

.manage-description,
.manage-help {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.manage-description code {
  font-size: 12px;
}
</style>
