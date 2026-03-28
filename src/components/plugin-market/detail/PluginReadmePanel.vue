<script setup lang="ts">
import { toRef } from 'vue'
import type { PluginMarketUiPlugin } from '../../../types/pluginMarket'
import { usePluginReadme } from './usePluginReadme'

const props = defineProps<{
  plugin: PluginMarketUiPlugin
}>()

const { readmeLoading, readmeError, renderedMarkdown } = usePluginReadme(toRef(props, 'plugin'))
</script>

<template>
  <div class="readme-panel">
    <div v-if="readmeLoading" class="loading-container">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="readmeError" class="error-container">
      <span>{{ readmeError }}</span>
    </div>
    <div v-else-if="renderedMarkdown" class="markdown-content" v-html="renderedMarkdown"></div>
    <div v-else class="empty-message">该插件暂无详情说明</div>
  </div>
</template>

<style scoped>
.readme-panel {
  min-height: 200px;
}

.loading-container,
.error-container,
.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  padding: 20px;
  text-align: center;
}

.error-container {
  color: var(--danger-color);
}

.empty-message {
  color: var(--text-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: var(--primary-color);
  border-right-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.markdown-content {
  color: var(--text-color);
  line-height: 1.7;
  word-break: break-word;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin-top: 24px;
  margin-bottom: 12px;
  color: var(--text-color);
}

.markdown-content :deep(p),
.markdown-content :deep(ul),
.markdown-content :deep(ol),
.markdown-content :deep(pre) {
  margin: 12px 0;
}

.markdown-content :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-elevated);
}

.markdown-content :deep(pre) {
  padding: 12px;
  border-radius: 12px;
  overflow: auto;
  background: var(--surface-elevated);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
