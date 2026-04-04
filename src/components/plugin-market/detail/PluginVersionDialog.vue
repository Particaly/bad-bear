<script setup lang="ts">
import { computed } from 'vue'
import Dropdown from '../../common/Dropdown/Dropdown.vue'
import type { DropdownOption } from '../../common/Dropdown/Dropdown'
import type {
  PluginDetailVersion,
  PluginHashOption,
  PluginVersionOption,
} from '../../../types/pluginMarket'
import { compareVersions, formatDateTime } from '../utils'
import { formatDownloads, formatSize } from './formatters'

type PluginDetailBusyAction = 'download' | 'upgrade' | 'reload' | 'share' | 'uninstall' | null

const props = defineProps<{
  visible: boolean
  installed: boolean
  localVersion?: string
  selectedVersion?: string | null
  selectedHash?: string | null
  selectedBuild?: PluginDetailVersion | null
  versionOptions?: PluginVersionOption[]
  hashOptions?: PluginHashOption[]
  installActionText?: string
  busyAction?: PluginDetailBusyAction
  canInstallFromMarket?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'install'): void
  (e: 'select-version', value: string | number): void
  (e: 'select-hash', value: string | number): void
}>()

const installActionKind = computed<'download' | 'upgrade'>(() =>
  props.installed ? 'upgrade' : 'download',
)
const installActionBusy = computed(() => props.busyAction === installActionKind.value)
const installActionButtonClass = computed(() => {
  if (!props.installed) {
    return 'btn-primary'
  }

  if (!props.localVersion || !props.selectedVersion) {
    return 'btn-primary'
  }

  return compareVersions(props.localVersion, props.selectedVersion) >= 0 ? 'btn-warning' : 'btn-primary'
})
const installActionDisabled = computed(() => {
  if (props.busyAction) {
    return true
  }

  if (props.canInstallFromMarket === false) {
    return !props.selectedVersion
  }

  return !props.selectedBuild
})
const installActionText = computed(() => props.installActionText || '安装插件')
const hasBuildOptions = computed(() => (props.versionOptions?.length || 0) > 0)
const selectedVersionValue = computed(() => props.selectedVersion || '')
const selectedHashValue = computed(() => props.selectedHash || '')
const versionDropdownOptions = computed<DropdownOption[]>(() =>
  (props.versionOptions || []).map((option) => ({
    label: option.label,
    value: option.value,
  })),
)
const hashDropdownOptions = computed<DropdownOption[]>(() =>
  (props.hashOptions || []).map((option) => ({
    label: option.label,
    value: option.value,
  })),
)

function closeVersionModal(): void {
  emit('update:visible', false)
}

function handleVersionModalInstall(): void {
  closeVersionModal()
  emit('install')
}
</script>

<template>
  <div v-if="visible" class="version-modal-mask" @click.self="closeVersionModal">
    <div class="version-modal card" role="dialog" aria-modal="true" aria-label="版本与构建">
      <div class="version-modal-header">
        <div class="section-title">版本与构建</div>
        <button class="icon-btn rating-modal-close" type="button" @click="closeVersionModal">×</button>
      </div>

      <div v-if="!hasBuildOptions" class="form-hint empty-builds">当前没有可安装的版本记录</div>

      <template v-else>
        <div class="build-selector-controls">
          <div class="build-selector-field">
            <span class="build-selector-label">版本</span>
            <Dropdown
              :model-value="selectedVersionValue"
              :options="versionDropdownOptions"
              placeholder="暂无版本"
              @change="emit('select-version', $event)"
            />
          </div>
          <div class="build-selector-field">
            <span class="build-selector-label">构建</span>
            <Dropdown
              :model-value="selectedHashValue"
              :options="hashDropdownOptions"
              placeholder="暂无构建"
              @change="emit('select-hash', $event)"
            />
          </div>
        </div>

        <div v-if="selectedBuild" class="build-meta-grid">
          <div class="build-meta-item build-meta-item--wide">
            <span class="build-meta-label">Hash</span>
            <span class="build-meta-value build-meta-hash" :title="selectedBuild.hash">{{ selectedBuild.hash }}</span>
          </div>
          <div class="build-meta-item build-meta-item--wide">
            <div class="build-meta-inline">
              <span class="build-meta-inline-item">
                <span class="build-meta-label">文件大小</span>
                <span class="build-meta-value">{{ formatSize(selectedBuild.fileSize) }}</span>
              </span>
              <span class="build-meta-inline-item">
                <span class="build-meta-label">下载次数</span>
                <span class="build-meta-value">{{ formatDownloads(selectedBuild.downloads) }}</span>
              </span>
              <span class="build-meta-inline-item">
                <span class="build-meta-label">上传时间</span>
                <span class="build-meta-value">{{ formatDateTime(selectedBuild.createdAt) }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="version-modal-actions">
          <button class="btn btn-lg btn-ghost" @click="closeVersionModal">取消</button>
          <button
            class="btn btn-lg"
            :class="installActionButtonClass"
            :disabled="installActionDisabled"
            @click="handleVersionModalInstall"
          >
            <div v-if="installActionBusy" class="spinner"></div>
            <span v-else>{{ installActionText }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.version-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
}

.version-modal {
  width: min(580px, 100%);
  padding: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
}

.version-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.rating-modal-close {
  flex-shrink: 0;
  font-size: 22px;
  line-height: 1;
}

.form-hint,
.build-meta-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-builds {
  padding: 12px 0;
}

.build-selector-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.build-selector-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.build-selector-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.build-meta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 10px;
}

.build-meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--hover-bg);
  min-width: 0;
}

.build-meta-item--wide {
  grid-column: 1 / -1;
}

.build-meta-inline {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  flex-wrap: wrap;
}

.build-meta-inline-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.build-meta-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
}

.build-meta-hash {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  word-break: break-all;
  font-size: 12px;
}

.version-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
