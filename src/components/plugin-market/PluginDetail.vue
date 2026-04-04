<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PluginCommentsSection from './detail/PluginCommentsSection.vue'
import PluginReadmePanel from './detail/PluginReadmePanel.vue'
import PluginVersionDialog from './detail/PluginVersionDialog.vue'
import { formatDownloads, formatSize } from './detail/formatters'
import type {
  PluginCommentTreeNode,
  PluginDetailVersion,
  PluginHashOption,
  PluginMarketUiPlugin,
  PluginVersionOption,
} from '../../types/pluginMarket'

type PluginDetailBusyAction = 'download' | 'upgrade' | 'reload' | 'share' | 'uninstall' | null

type TabId = 'detail' | 'commands' | 'comments'

const props = defineProps<{
  plugin: PluginMarketUiPlugin
  busyAction?: PluginDetailBusyAction
  shareDisabled?: boolean
  isRunning?: boolean
  isLoggedIn?: boolean
  isInternal?: boolean
  canInstallFromMarket?: boolean
  avgRating?: number
  ratingCount?: number
  currentUserRating?: number
  comments?: PluginCommentTreeNode[]
  commentsLoading?: boolean
  commentsLoadingMore?: boolean
  commentsError?: string
  hasMoreComments?: boolean
  ratingSubmitting?: boolean
  commentSubmitting?: boolean
  currentUserAvatarUrl?: string
  commentSubmitSuccessKey?: number
  versionOptions?: PluginVersionOption[]
  hashOptions?: PluginHashOption[]
  selectedVersion?: string | null
  selectedHash?: string | null
  selectedBuild?: PluginDetailVersion | null
  installActionText?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open'): void
  (e: 'download'): void
  (e: 'install-latest'): void
  (e: 'upgrade'): void
  (e: 'uninstall'): void
  (e: 'share'): void
  (e: 'open-folder'): void
  (e: 'reload'): void
  (e: 'submit-rating', score: number): void
  (e: 'submit-comment', payload: { content: string; parentId?: string }): void
  (e: 'load-more-comments'): void
  (e: 'select-version', value: string | number): void
  (e: 'select-hash', value: string | number): void
}>()

const activeTab = ref<TabId>('detail')
const isVersionModalOpen = ref(false)

const isInstalledPlugin = computed(() => props.plugin.installed && !!props.plugin.path)
const isFromMarket = computed(() => !!props.plugin.marketPlugin)
const hasBuildOptions = computed(() => (props.versionOptions?.length || 0) > 0)
const currentVersion = computed(() => props.selectedVersion || props.plugin.version || '-')
const displayAverageRating = computed(() => props.avgRating ?? props.plugin.avgRating ?? 0)
const displayRatingCount = computed(() => props.ratingCount ?? props.plugin.ratingCount ?? 0)

function isBusyAction(action: Exclude<PluginDetailBusyAction, null>): boolean {
  return props.busyAction === action
}

function handleInstallAction(): void {
  if (isInstalledPlugin.value) {
    emit('upgrade')
    return
  }

  emit('download')
}

function openHomepage(): void {
  const homepage = props.plugin.homepage as string | undefined
  if (homepage && typeof window.ztools?.shellOpenExternal === 'function') {
    window.ztools.shellOpenExternal(homepage)
  }
}

function openVersionModal(): void {
  if (hasBuildOptions.value) {
    isVersionModalOpen.value = true
  }
}

watch(
  () => [props.plugin.name, props.plugin.path],
  () => {
    activeTab.value = 'detail'
    isVersionModalOpen.value = false
  },
)
</script>

<template>
  <div class="plugin-detail">
    <div class="detail-panel-header">
      <button class="back-btn" @click="emit('back')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>插件详情</span>
      </button>
      <div class="header-actions">
        <template v-if="isInstalledPlugin">
          <button class="icon-btn topbar-action-btn open-btn" title="打开" :disabled="!!busyAction" @click="emit('open')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="icon-btn topbar-action-btn folder-btn" title="打开目录" :disabled="!!busyAction" @click="emit('open-folder')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="icon-btn topbar-action-btn reload-btn" title="重载" :disabled="!!busyAction" @click="emit('reload')">
            <div v-if="isBusyAction('reload')" class="spinner"></div>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
          <button class="icon-btn topbar-action-btn share-btn" :title="isInternal ? '内置插件，不可分享' : '分享'" :disabled="!!busyAction || shareDisabled" @click="emit('share')">
            <div v-if="isBusyAction('share')" class="spinner"></div>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
          <button class="icon-btn topbar-action-btn delete-btn" :title="isInternal ? '内置插件，不可卸载' : '卸载'" :disabled="!!busyAction || isInternal" @click="emit('uninstall')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6"></path>
            </svg>
          </button>
        </template>
        <button v-else class="icon-btn topbar-action-btn install-btn" :title="canInstallFromMarket === false ? '下载插件文件' : '安装最新版'" :disabled="!!busyAction" @click="emit('install-latest')">
          <div v-if="isBusyAction('download')" class="spinner"></div>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.7893 3 19.5304 3 19V15"></path>
            <path d="M7 10L12 15L17 10"></path>
            <path d="M12 15V3"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="detail-panel-body">
      <div class="detail-content">
        <div class="detail-header">
          <div class="detail-left">
            <img
              v-if="plugin.logo"
              :src="plugin.logo"
              class="detail-icon"
              alt="插件图标"
              draggable="false"
            />
            <div v-else class="detail-icon placeholder">🧩</div>
            <div class="detail-info">
              <div class="detail-title">
                <span class="detail-name">{{ plugin.title || plugin.name }}</span>
                <span class="detail-version" :class="{ 'detail-version--clickable': hasBuildOptions }" @click="openVersionModal">v{{ currentVersion }}</span>
                <div class="detail-badges">
                  <span v-if="plugin.installed" class="detail-badge">已安装</span>
                  <span v-if="plugin.isDevelopment" class="detail-badge detail-badge-dev">开发中</span>
                  <span v-if="isRunning" class="detail-badge detail-badge-running">运行中</span>
                </div>
              </div>
              <div class="detail-summary">
                <div class="detail-summary-item">
                  <span class="detail-summary-label">开发者</span>
                  <span
                    v-if="plugin.author"
                    class="detail-summary-value"
                    :class="{ clickable: plugin.homepage }"
                    @click="openHomepage"
                  >
                    {{ plugin.author }}
                  </span>
                  <span v-else class="detail-summary-value">未知</span>
                </div>
                <div class="detail-summary-divider"></div>
                <div class="detail-summary-item">
                  <span class="detail-summary-label">大小</span>
                  <span class="detail-summary-value">{{ formatSize(plugin.size) }}</span>
                </div>
                <div class="detail-summary-divider"></div>
                <div class="detail-summary-item">
                  <span class="detail-summary-label">下载量</span>
                  <span class="detail-summary-value">{{ formatDownloads(plugin.totalDownloads) }}</span>
                </div>
                <template v-if="displayRatingCount > 0">
                  <div class="detail-summary-divider"></div>
                  <div class="detail-summary-item">
                    <span class="detail-summary-label">评分</span>
                    <span class="detail-summary-value">{{ displayAverageRating.toFixed(1) }} / {{ displayRatingCount }}</span>
                  </div>
                </template>
              </div>
              <div class="detail-desc">{{ plugin.description || '暂无描述' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-container">
        <div class="tab-header">
          <button class="tab-button" :class="{ active: activeTab === 'detail' }" @click="activeTab = 'detail'">
            详情
          </button>
          <button class="tab-button" :class="{ active: activeTab === 'commands' }" @click="activeTab = 'commands'">
            指令列表
          </button>
          <button v-if="isFromMarket" class="tab-button" :class="{ active: activeTab === 'comments' }" @click="activeTab = 'comments'">
            评论
          </button>
        </div>

        <div class="tab-content">
          <div v-if="activeTab === 'detail'" class="tab-panel">
            <PluginReadmePanel :plugin="plugin" />
          </div>

          <div v-if="activeTab === 'commands'" class="tab-panel">
            <div v-if="plugin.features && plugin.features.length > 0" class="feature-list">
              <div v-for="feature in plugin.features" :key="feature.code" class="card feature-card">
                <div class="feature-title">{{ feature.name || feature.code }}</div>
                <div v-if="feature.explain" class="feature-description">{{ feature.explain }}</div>
              </div>
            </div>
            <div v-else class="empty-message">暂无指令</div>
          </div>

          <div v-if="activeTab === 'comments'" class="tab-panel comments-panel">
            <PluginCommentsSection
              :is-logged-in="isLoggedIn"
              :avg-rating="displayAverageRating"
              :rating-count="displayRatingCount"
              :current-user-rating="currentUserRating"
              :comments="comments"
              :comments-loading="commentsLoading"
              :comments-loading-more="commentsLoadingMore"
              :comments-error="commentsError"
              :has-more-comments="hasMoreComments"
              :rating-submitting="ratingSubmitting"
              :comment-submitting="commentSubmitting"
              :current-user-avatar-url="currentUserAvatarUrl"
              :comment-submit-success-key="commentSubmitSuccessKey"
              @submit-rating="emit('submit-rating', $event)"
              @submit-comment="emit('submit-comment', $event)"
              @load-more-comments="emit('load-more-comments')"
            />
          </div>
        </div>
      </div>
    </div>

    <PluginVersionDialog
      :visible="isVersionModalOpen"
      :installed="isInstalledPlugin"
      :local-version="plugin.localVersion"
      :selected-version="selectedVersion"
      :selected-hash="selectedHash"
      :selected-build="selectedBuild"
      :version-options="versionOptions"
      :hash-options="hashOptions"
      :install-action-text="installActionText"
      :busy-action="busyAction"
      :can-install-from-market="canInstallFromMarket"
      @update:visible="isVersionModalOpen = $event"
      @install="handleInstallAction"
      @select-version="emit('select-version', $event)"
      @select-hash="emit('select-hash', $event)"
    />
  </div>
</template>

<style scoped>
.plugin-detail {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.detail-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--primary-color);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--primary-light-bg);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.topbar-action-btn {
  color: var(--text-secondary);
}

.topbar-action-btn:hover:not(:disabled) {
  background: var(--hover-bg);
}

.topbar-action-btn.open-btn,
.topbar-action-btn.folder-btn,
.topbar-action-btn.reload-btn,
.topbar-action-btn.share-btn,
.topbar-action-btn.install-btn {
  color: var(--primary-color);
}

.topbar-action-btn.open-btn:hover:not(:disabled),
.topbar-action-btn.folder-btn:hover:not(:disabled),
.topbar-action-btn.reload-btn:hover:not(:disabled),
.topbar-action-btn.share-btn:hover:not(:disabled),
.topbar-action-btn.install-btn:hover:not(:disabled) {
  background: var(--primary-light-bg);
}

.topbar-action-btn.delete-btn {
  color: var(--danger-color);
}

.topbar-action-btn.delete-btn:hover:not(:disabled) {
  background: var(--danger-light-bg);
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

.detail-panel-body {
  flex: 1;
  overflow-y: auto;
}

.detail-content {
  padding: 0 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.detail-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.detail-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.detail-icon.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--active-bg);
  font-size: 28px;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color);
}

.detail-version {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.detail-version--clickable {
  color: var(--primary-color);
  cursor: pointer;
  transition: opacity 0.2s;
}

.detail-version--clickable:hover {
  opacity: 0.7;
}

.detail-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--active-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.detail-badge-dev {
  color: var(--purple-color);
  background: var(--purple-light-bg);
}

.detail-badge-running {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
}

.detail-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  word-break: break-word;
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 12px;
}

.detail-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.detail-summary-label {
  color: var(--text-secondary);
}

.detail-summary-value {
  color: var(--text-color);
  min-width: 0;
}

.detail-summary-value.clickable {
  color: var(--primary-color);
  cursor: pointer;
  transition: opacity 0.2s;
}

.detail-summary-value.clickable:hover {
  opacity: 0.7;
}

.detail-summary-divider {
  width: 1px;
  height: 12px;
  background: var(--divider-color);
}

.tab-container {
  margin-left: 10px;
  margin-right: 10px;
}

.tab-header {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--divider-color);
}

.tab-button {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  bottom: -1px;
}

.tab-button:hover {
  color: var(--text-color);
  background: var(--hover-bg);
}

.tab-button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-content {
  min-height: 200px;
  padding: 16px 0;
}

.tab-panel {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-message {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-card {
  padding: 14px;
  cursor: default;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.feature-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.comments-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
