<script setup lang="ts">
import { computed } from 'vue'
import type { AuthUser } from '../../types/auth'
import type {
  NotificationFilter,
  NotificationRecord,
  NotificationStatus,
  NotificationTreeNode,
} from '../../types/notification'
import { formatDateTime } from './utils'

const props = defineProps<{
  items: NotificationTreeNode[]
  loading: boolean
  error: string
  filter: NotificationFilter
  page: number
  pageSize: number
  total: number
  unreadTotal: number
  selectedId: string | null
  selectedItem: NotificationRecord | null
  readingIds: string[]
  markingAllRead: boolean
  currentUser: AuthUser | null
}>()

const emit = defineEmits<{
  (e: 'change-filter', filter: NotificationFilter): void
  (e: 'change-page', page: number): void
  (e: 'open-item', item: NotificationTreeNode): void
  (e: 'close-detail'): void
  (e: 'mark-all-read'): void
  (e: 'go-login'): void
  (e: 'refresh'): void
}>()

const filterOptions: Array<{ label: string; value: NotificationFilter }> = [
  { label: '全部', value: 'ALL' },
  { label: '未读', value: 'UNREAD' },
  { label: '已读', value: 'READ' },
]

const readingIdSet = computed(() => new Set(props.readingIds))
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(props.pageSize, 1))))
const canGoPrev = computed(() => props.page > 1)
const canGoNext = computed(() => props.page < totalPages.value)
const canMarkAllRead = computed(() => !!props.currentUser && props.unreadTotal > 0 && !props.markingAllRead)
const shouldShowPagination = computed(() => props.total > 0)

const emptyStateText = computed(() => {
  if (props.filter === 'UNREAD') {
    return '暂无未读通知'
  }

  if (props.filter === 'READ') {
    return '暂无已读通知'
  }

  return '暂无通知'
})

function getStatusText(status: NotificationStatus): string {
  return status === 'UNREAD' ? '未读' : '已读'
}

function getTypeLabel(type: string): string {
  return type || '通知'
}

function isReading(id: string): boolean {
  return readingIdSet.value.has(id)
}

function handleChangeFilter(filter: NotificationFilter): void {
  if (filter === props.filter) {
    return
  }

  emit('change-filter', filter)
}

function openItem(item: NotificationTreeNode): void {
  emit('open-item', item)
}

function closeDetail(): void {
  emit('close-detail')
}
</script>

<template>
  <div class="notification-panel">
    <div class="card panel-card panel-hero">
      <div class="panel-hero-copy">
        <h2 class="panel-title">通知中心</h2>
      </div>

      <div class="hero-actions">
        <button class="btn btn-lg btn-ghost" type="button" :disabled="loading" @click="emit('refresh')">
          刷新
        </button>
        <button
          class="btn btn-lg btn-primary"
          type="button"
          :disabled="!canMarkAllRead"
          @click="emit('mark-all-read')"
        >
          {{ markingAllRead ? '处理中...' : '全部已读' }}
        </button>
      </div>
    </div>

    <template v-if="!currentUser">
      <div class="card panel-card section-card empty-card">
        <h3 class="section-title">登录后查看通知</h3>
        <p class="panel-tip">未登录时不会请求通知列表。登录后可查看回复、互动提醒和系统消息。</p>
        <div class="login-cta">
          <button class="btn btn-lg btn-primary" type="button" @click="emit('go-login')">前往登录</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="card panel-card section-card">
        <div class="notification-toolbar">
          <div class="filter-tabs" role="tablist" aria-label="通知筛选">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              class="filter-tab"
              :class="{ active: filter === option.value }"
              type="button"
              @click="handleChangeFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="toolbar-meta">第 {{ page }} / {{ totalPages }} 页</div>
        </div>

        <div v-if="loading" class="loading-container">
          <div class="spinner"></div>
          <span>通知加载中...</span>
        </div>

        <div v-else-if="error" class="error-container">
          <span>{{ error }}</span>
          <button class="btn btn-lg btn-ghost" type="button" @click="emit('refresh')">重试</button>
        </div>

        <div v-else-if="items.length === 0" class="empty-message">{{ emptyStateText }}</div>

        <div v-else class="notification-list">
          <div v-for="item in items" :key="item.id" class="notification-thread">
            <button
              class="notification-card"
              :class="{
                'is-selected': selectedId === item.id,
                'is-unread': item.status === 'UNREAD',
              }"
              type="button"
              @click="openItem(item)"
            >
              <div class="notification-card-header">
                <div class="notification-title-row">
                  <h3 class="notification-title">{{ item.title || '未命名通知' }}</h3>
                </div>
                <span
                  class="status-badge"
                  :class="{ 'is-unread': item.status === 'UNREAD', 'is-reading': isReading(item.id) }"
                >
                  {{ isReading(item.id) ? '标记中...' : getStatusText(item.status) }}
                </span>
              </div>
              <p class="notification-preview">{{ item.message || '暂无内容' }}</p>
              <div class="notification-meta">
                <span>{{ formatDateTime(item.createdAt) }}</span>
                <span v-if="item.readAt">已读于 {{ formatDateTime(item.readAt) }}</span>
              </div>
            </button>

            <div v-if="item.replies.length > 0" class="reply-list">
              <div v-for="reply in item.replies" :key="reply.id" class="reply-entry">
                <button
                  class="reply-card"
                  :class="{
                    'is-selected': selectedId === reply.id,
                    'is-unread': reply.status === 'UNREAD',
                  }"
                  type="button"
                  @click.stop="openItem(reply)"
                >
                  <div class="notification-card-header">
                    <div class="notification-title-row">
                      <span class="notification-type">回复</span>
                      <h4 class="notification-title notification-title--reply">{{ reply.title || '通知回复' }}</h4>
                    </div>
                    <span
                      class="status-badge"
                      :class="{ 'is-unread': reply.status === 'UNREAD', 'is-reading': isReading(reply.id) }"
                    >
                      {{ isReading(reply.id) ? '标记中...' : getStatusText(reply.status) }}
                    </span>
                  </div>
                  <p class="notification-preview notification-preview--reply">{{ reply.message || '暂无内容' }}</p>
                  <div class="notification-meta">
                    <span>{{ formatDateTime(reply.createdAt) }}</span>
                    <span v-if="reply.readAt">已读于 {{ formatDateTime(reply.readAt) }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <Teleport to="body">
          <div v-if="props.selectedItem" class="notification-modal-mask" @click.self="closeDetail">
            <div class="notification-modal card" role="dialog" aria-modal="true" aria-label="通知详情">
              <div class="notification-modal-header">
                <div>
                  <div class="detail-label">通知详情</div>
                  <h3 class="notification-modal-title">{{ props.selectedItem.title || '未命名通知' }}</h3>
                </div>
                <button class="notification-modal-close" type="button" @click="closeDetail">×</button>
              </div>
              <div class="notification-modal-meta">
                <span>{{ formatDateTime(props.selectedItem.createdAt) }}</span>
                <span>{{ getTypeLabel(props.selectedItem.type) }}</span>
                <span
                  class="status-badge"
                  :class="{
                    'is-unread': props.selectedItem.status === 'UNREAD',
                    'is-reading': isReading(props.selectedItem.id),
                  }"
                >
                  {{ isReading(props.selectedItem.id) ? '标记中...' : getStatusText(props.selectedItem.status) }}
                </span>
              </div>
              <div class="detail-content notification-modal-content">
                {{ props.selectedItem.message || '暂无内容' }}
              </div>
            </div>
          </div>
        </Teleport>

        <div v-if="shouldShowPagination" class="pagination-row">
          <button class="btn btn-lg btn-ghost" type="button" :disabled="!canGoPrev" @click="emit('change-page', page - 1)">
            上一页
          </button>
          <span class="pagination-text">共 {{ total }} 条，当前第 {{ page }} / {{ totalPages }} 页</span>
          <button class="btn btn-lg btn-ghost" type="button" :disabled="!canGoNext" @click="emit('change-page', page + 1)">
            下一页
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notification-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notification-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.48);
}

.notification-modal {
  width: min(640px, 100%);
  max-height: min(80vh, 720px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
}

.notification-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.notification-modal-title {
  margin: 6px 0 0;
  font-size: 18px;
  color: var(--text-color);
}

.notification-modal-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
}

.notification-modal-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 13px;
}

.notification-modal-content {
  overflow-y: auto;
}

.panel-card {
  padding: 18px;
}

.panel-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-hero-copy {
  flex: 1;
  min-width: 0;
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

.panel-description,
.panel-tip,
.toolbar-meta,
.notification-meta,
.pagination-text,
.detail-label,
.summary-label {
  color: var(--text-secondary);
  font-size: 13px;
}

.panel-description {
  margin: 8px 0 0;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card--accent {
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 10%, var(--surface-color, var(--card-bg))) 0%, var(--surface-color, var(--card-bg)) 100%);
}

.summary-value {
  font-size: 24px;
  line-height: 1;
  color: var(--text-color);
}

.section-card,
.summary-card,
.notification-card,
.reply-card,
.notification-detail {
  border: 1px solid var(--divider-color);
  border-radius: 16px;
  background: var(--surface-color, var(--card-bg));
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-card {
  align-items: flex-start;
}

.section-title {
  margin: 0;
  font-size: 16px;
  color: var(--text-color);
}

.login-cta,
.pagination-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.notification-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-tabs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  background: var(--surface-elevated);
}

.filter-tab {
  min-width: 68px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  transition: background 0.2s ease, color 0.2s ease;
}

.filter-tab.active {
  background: var(--primary-color);
  color: var(--text-on-primary);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.notification-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-card,
.reply-card {
  width: 100%;
  padding: 16px;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.notification-card:hover,
.reply-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--divider-color));
}

.notification-card.is-selected,
.reply-card.is-selected {
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
  box-shadow: 0 14px 32px color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.notification-card.is-unread,
.reply-card.is-unread {
  background: color-mix(in srgb, var(--primary-color) 5%, var(--surface-color, var(--card-bg)));
}

.notification-card-header,
.notification-title-row,
.notification-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.notification-title-row {
  justify-content: flex-start;
  min-width: 0;
}

.notification-type {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-elevated);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.notification-title {
  margin: 0;
  min-width: 0;
  font-size: 15px;
  color: var(--text-color);
}

.notification-title--reply {
  font-size: 14px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-elevated);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.status-badge.is-unread {
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  color: var(--primary-color);
}

.status-badge.is-reading {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
  color: #b45309;
}

.notification-preview {
  margin: 10px 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.notification-preview--reply {
  font-size: 13px;
}

.detail-label {
  margin-bottom: 8px;
}

.detail-content {
  color: var(--text-color);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-left: 18px;
  padding-left: 14px;
  border-left: 2px solid color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.reply-entry {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-container,
.error-container,
.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  text-align: center;
}

.error-container {
  color: var(--error-color);
}

.empty-message {
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
  border-top-color: var(--primary-color);
  animation: spin 0.8s linear infinite;
}

.pagination-row {
  justify-content: space-between;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .notification-modal-mask {
    padding: 16px;
  }

  .notification-modal {
    max-height: min(86vh, 720px);
    padding: 18px;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
