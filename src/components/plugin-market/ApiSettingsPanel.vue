<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  baseUrl: string
}>()

const emit = defineEmits<{
  (e: 'save', value: string): void
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
</script>

<template>
  <div class="settings-panel">
    <div class="panel-card panel-hero">
      <div class="panel-hero-copy">
        <h2 class="panel-title">设置</h2>
      </div>
    </div>

    <div class="panel-card section-card settings-card">
      <div class="field-group">
        <label class="field-label" for="shop-api-base-url">商店后端地址</label>
        <input
          id="shop-api-base-url"
          v-model="draftBaseUrl"
          class="text-input"
          type="text"
          placeholder="通常来说你不需要改这个"
          @keydown.enter="submit"
        />
      </div>
      <div class="action-row">
        <button class="btn btn-primary" @click="submit">保存地址</button>
      </div>
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
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--card-bg);
  backdrop-filter: blur(40px) saturate(180%);
}

.panel-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 74px;
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

.section-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card {
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

.action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>
