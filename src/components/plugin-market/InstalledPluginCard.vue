<script setup lang="ts">
import type { InstalledViewPlugin } from '../../types/pluginMarket'

const props = defineProps<{
  plugin: InstalledViewPlugin
  isBusy?: boolean
  shareDisabled?: boolean
  isInternal?: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'open'): void
  (e: 'open-folder'): void
  (e: 'reload'): void
  (e: 'share'): void
  (e: 'uninstall'): void
}>()
</script>

<template>
  <div class="card installed-plugin-card" :title="plugin.description" @click="emit('click')">
    <img
      v-if="plugin.logo"
      :src="plugin.logo"
      class="plugin-icon"
      alt="插件图标"
      draggable="false"
    />
    <div v-else class="plugin-icon placeholder">🧩</div>

    <div class="plugin-info">
      <div class="plugin-title-row">
        <span class="plugin-name">{{ plugin.title || plugin.name }}</span>
        <span class="plugin-version">v{{ plugin.localVersion || plugin.version }}</span>
        <span v-if="plugin.isDevelopment" class="dev-badge">开发中</span>
        <span v-if="plugin.isRunning" class="running-badge">
          <span class="status-dot"></span>
          运行中
        </span>
        <span v-if="plugin.hasUpdate" class="update-badge">可更新</span>
        <span v-if="isInternal" class="internal-badge">内置</span>
      </div>
      <div class="plugin-desc">{{ plugin.description || '暂无描述' }}</div>
      <div class="plugin-path">{{ plugin.path }}</div>
    </div>

    <div class="plugin-actions">
      <button class="icon-btn open-btn" title="打开插件" @click.stop="emit('open')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
      <button class="icon-btn folder-btn" title="打开插件目录" @click.stop="emit('open-folder')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      <button class="icon-btn reload-btn" :disabled="isBusy" title="重载插件" @click.stop="emit('reload')">
        <div v-if="isBusy" class="spinner"></div>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
      <button class="icon-btn share-btn" :disabled="isBusy || shareDisabled" :title="isInternal ? '内置插件，不可分享' : '分享插件'" @click.stop="emit('share')">
        <div v-if="isBusy" class="spinner"></div>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>
      <button class="icon-btn delete-btn" :disabled="isBusy || isInternal" :title="isInternal ? '内置插件，不可卸载' : '卸载插件'" @click.stop="emit('uninstall')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.installed-plugin-card {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 0;
}

.installed-plugin-card:hover {
  background: var(--hover-bg);
  transform: translateX(2px);
}

.plugin-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.plugin-icon.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--active-bg);
  font-size: 24px;
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.plugin-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.plugin-version,
.dev-badge,
.running-badge,
.update-badge,
.internal-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
}

.plugin-version {
  color: var(--text-secondary);
  background: var(--active-bg);
}

.dev-badge {
  color: var(--purple-color);
  background: var(--purple-light-bg);
}

.running-badge {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
}

.update-badge {
  color: var(--warning-color);
  background: var(--warning-light-bg);
}

.internal-badge {
  color: var(--text-secondary);
  background: var(--active-bg);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.plugin-desc,
.plugin-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.plugin-path {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.75;
}

.plugin-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.open-btn,
.folder-btn,
.reload-btn,
.share-btn {
  color: var(--primary-color);
}

.open-btn:hover:not(:disabled),
.folder-btn:hover:not(:disabled),
.reload-btn:hover:not(:disabled),
.share-btn:hover:not(:disabled) {
  background: var(--primary-light-bg);
}

.delete-btn {
  color: var(--danger-color);
}

.delete-btn:hover:not(:disabled) {
  background: var(--danger-light-bg);
}

.spinner {
  width: 14px;
  height: 14px;
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
