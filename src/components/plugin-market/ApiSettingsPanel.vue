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

.panel-title {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
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
  justify-content: flex-end;
}
</style>
