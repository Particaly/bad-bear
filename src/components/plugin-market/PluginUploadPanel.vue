<script setup lang="ts">
import { computed } from 'vue'
import type { AuthUser } from '../../types/auth'
import type { GitHubBindingState } from '../../types/auth'
import type {
  MyPluginUploadRecord,
  MyPluginUploadStatus,
  PluginHashCheckStatus,
} from '../../types/pluginMarket'
import { formatDateTime } from './utils'
import { formatSize, formatDownloads } from './detail/formatters'

const props = defineProps<{
  currentUser: AuthUser | null
  githubBinding: GitHubBindingState
  selectedFile: File | null
  validationError: string
  hashCheckResult: { status: PluginHashCheckStatus; pluginName?: string; version?: string } | null
  isHashing: boolean
  isCheckingHash: boolean
  isUploading: boolean
  canUpload: boolean
  uploads: MyPluginUploadRecord[]
  uploadsTotal: number
  uploadsPage: number
  uploadsLoading: boolean
  uploadsError: string
  deletingIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select-file', file: File): void
  (e: 'clear-file'): void
  (e: 'precheck'): void
  (e: 'upload'): void
  (e: 'refresh-uploads'): void
  (e: 'delete-upload', record: MyPluginUploadRecord): void
  (e: 'open-plugin', name: string): void
}>()

const isLoggedIn = computed(() => !!props.currentUser)
const isGithubBound = computed(() => props.githubBinding.bound && props.githubBinding.supported)
const isGithubLoading = computed(() => props.githubBinding.loading && !props.githubBinding.loaded)
const canSelectFile = computed(() => isLoggedIn.value && isGithubBound.value && !props.isUploading)
const canPrecheck = computed(
  () =>
    !!props.selectedFile &&
    !props.validationError &&
    !props.isHashing &&
    !props.isCheckingHash &&
    !props.isUploading &&
    props.hashCheckResult === null,
)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.uploadsTotal / 20)),
)

function handleFileInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (file) {
    emit('select-file', file)
  }
  if (target) {
    target.value = ''
  }
}

function getStatusLabel(status: MyPluginUploadStatus): string {
  switch (status) {
    case 'PENDING': return '等待审查'
    case 'RUNNING': return '审查中'
    case 'FAILED': return '失败'
    case 'REJECTED': return '已拒绝'
    case 'CANCELED': return '已取消'
    case 'PUBLISHED': return '已发布'
    default: return status
  }
}

function getStatusClass(status: MyPluginUploadStatus): string {
  switch (status) {
    case 'PENDING': return 'status-pending'
    case 'RUNNING': return 'status-running'
    case 'FAILED': return 'status-failed'
    case 'REJECTED': return 'status-rejected'
    case 'CANCELED': return 'status-canceled'
    case 'PUBLISHED': return 'status-published'
    default: return ''
  }
}

function getHashCheckMessage(): string {
  if (!props.hashCheckResult) return ''
  switch (props.hashCheckResult.status) {
    case 'blocked': return '该文件哈希已被封禁，无法上传'
    case 'processing': return '该文件正在后台分析中，请勿重复上传'
    case 'exists': return `该插件已存在：${props.hashCheckResult.pluginName || ''} ${props.hashCheckResult.version || ''}`
    case 'safe': return '预检通过，可以上传'
    default: return ''
  }
}

function isDeleting(id: string): boolean {
  return props.deletingIds.has(id)
}

function canDelete(record: MyPluginUploadRecord): boolean {
  return record.status !== 'PENDING' && record.status !== 'RUNNING'
}
</script>

<template>
  <div class="upload-panel">
    <div class="card panel-card panel-hero">
      <div class="panel-hero-copy">
        <h2 class="panel-title">上传插件</h2>
      </div>
    </div>

    <!-- Not logged in -->
    <div v-if="!isLoggedIn" class="card panel-card section-card empty-card">
      <h3 class="section-title">登录后上传插件</h3>
      <p class="panel-tip">请先登录账号，并绑定 GitHub 后即可上传插件。</p>
    </div>

    <!-- Logged in but GitHub not bound -->
    <div v-else-if="!isGithubBound && !isGithubLoading" class="card panel-card section-card empty-card">
      <h3 class="section-title">绑定 GitHub 后上传</h3>
      <p class="panel-tip">请在上方账号区域完成 GitHub 绑定后再上传插件。</p>
    </div>

    <!-- Upload form + history -->
    <template v-else>
      <div class="card panel-card section-card">
        <div class="section-header">
          <h3 class="section-title">我的上传记录</h3>
          <div class="section-actions">
            <button
              class="btn btn-md btn-primary"
              type="button"
              :disabled="!canSelectFile"
              @click="($refs.fileInput as HTMLInputElement | null)?.click()"
            >
              上传插件
            </button>
            <button
              class="btn btn-md btn-ghost"
              type="button"
              :disabled="uploadsLoading"
              @click="emit('refresh-uploads')"
            >
              刷新
            </button>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".zpx"
          class="hidden-input"
          @change="handleFileInput"
        />

        <div v-if="selectedFile || validationError" class="upload-form">
          <div class="file-input-row">
            <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
            <span v-if="selectedFile" class="file-size">({{ formatSize(selectedFile.size) }})</span>
          </div>

          <div v-if="validationError" class="validation-error">{{ validationError }}</div>

          <div v-if="selectedFile && !validationError" class="upload-actions">
            <button
              v-if="hashCheckResult === null"
              class="btn btn-md btn-ghost"
              type="button"
              :disabled="!canPrecheck"
              @click="emit('precheck')"
            >
              {{ isHashing ? '计算哈希中...' : isCheckingHash ? '预检中...' : '预检文件' }}
            </button>

            <div v-if="hashCheckResult" class="hash-check-result" :class="`hash-${hashCheckResult.status}`">
              <span>{{ getHashCheckMessage() }}</span>
              <button
                v-if="hashCheckResult.status === 'exists' && hashCheckResult.pluginName"
                class="btn btn-sm btn-ghost"
                type="button"
                @click="emit('open-plugin', hashCheckResult.pluginName!)"
              >
                查看插件
              </button>
            </div>

            <div class="upload-button-row">
              <button
                v-if="hashCheckResult?.status === 'safe'"
                class="btn btn-md btn-primary"
                type="button"
                :disabled="!canUpload"
                @click="emit('upload')"
              >
                {{ isUploading ? '上传中...' : '确认上传' }}
              </button>
              <button
                class="btn btn-md btn-ghost"
                type="button"
                :disabled="isUploading"
                @click="emit('clear-file')"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        <div v-if="uploadsLoading && uploads.length === 0" class="loading-container">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="uploadsError" class="error-container">
          <span>{{ uploadsError }}</span>
          <button class="btn btn-md btn-ghost" type="button" @click="emit('refresh-uploads')">重试</button>
        </div>

        <div v-else-if="uploads.length === 0" class="empty-message">暂无上传记录</div>

        <div v-else class="upload-list">
          <div v-for="record in uploads" :key="record.id" class="upload-record">
            <div class="record-main">
              <div class="record-info">
                <span class="record-name">{{ record.pluginName || record.originalName }}</span>
                <span v-if="record.version" class="record-version">v{{ record.version }}</span>
              </div>
              <div class="record-meta">
                <span class="record-filename">{{ record.originalName }}</span>
                <span>{{ formatSize(record.fileSize) }}</span>
                <span>{{ formatDateTime(record.createdAt) }}</span>
                <span>{{ formatDownloads(record.downloads) }} 次下载</span>
              </div>
            </div>
            <div class="record-actions">
              <span class="status-badge" :class="getStatusClass(record.status)">
                {{ getStatusLabel(record.status) }}
              </span>
              <button
                v-if="canDelete(record)"
                class="btn btn-sm btn-ghost btn-danger"
                type="button"
                :disabled="isDeleting(record.id)"
                @click="emit('delete-upload', record)"
              >
                {{ isDeleting(record.id) ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="uploadsTotal > 20" class="pagination-row">
          <span class="pagination-text">共 {{ uploadsTotal }} 条，当前第 {{ uploadsPage }} / {{ totalPages }} 页</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  padding: 18px;
}

.panel-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-hero-copy {
  flex: 1;
  min-width: 0;
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

.panel-tip {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-card {
  align-items: center;
  text-align: center;
  padding: 32px 18px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  color: var(--text-color);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hidden-input {
  display: none;
}

.file-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  color: var(--text-color);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: var(--text-secondary);
  font-size: 12px;
}

.validation-error {
  color: var(--danger-color, #e74c3c);
  font-size: 13px;
}

.upload-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-button-row {
  display: flex;
  gap: 8px;
}

.hash-check-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
}

.hash-check-result.hash-safe {
  color: var(--success-color, #27ae60);
  background: color-mix(in srgb, var(--success-color, #27ae60) 10%, transparent);
}

.hash-check-result.hash-blocked,
.hash-check-result.hash-processing,
.hash-check-result.hash-exists {
  color: var(--warning-color, #e67e22);
  background: color-mix(in srgb, var(--warning-color, #e67e22) 10%, transparent);
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.error-container {
  color: var(--danger-color, #e74c3c);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--divider-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-message {
  text-align: center;
  padding: 24px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.upload-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--divider-color);
  border-radius: 10px;
  overflow: hidden;
}

.upload-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-color);
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-name {
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.record-version {
  color: var(--text-secondary);
  font-size: 12px;
}

.record-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.record-filename {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-pending {
  color: var(--text-secondary);
  background: var(--surface-elevated);
}

.status-running {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.status-failed {
  color: var(--danger-color, #e74c3c);
  background: color-mix(in srgb, var(--danger-color, #e74c3c) 12%, transparent);
}

.status-rejected {
  color: var(--danger-color, #e74c3c);
  background: color-mix(in srgb, var(--danger-color, #e74c3c) 12%, transparent);
}

.status-canceled {
  color: var(--text-secondary);
  background: var(--surface-elevated);
}

.status-published {
  color: var(--success-color, #27ae60);
  background: color-mix(in srgb, var(--success-color, #27ae60) 12%, transparent);
}

.btn-danger {
  color: var(--danger-color, #e74c3c);
}

.btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger-color, #e74c3c) 12%, transparent);
}

.pagination-row {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.pagination-text {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
