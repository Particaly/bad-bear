<template>
  <div class="main-container">
    <PluginMarketPage class="market-page" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import PluginMarketPage from './components/plugin-market/PluginMarketPage.vue'
import { useTheme } from './config/theme'

onMounted(() => {
  void useTheme()

  window.ztools.onPluginEnter(() => {})
  window.ztools.onPluginOut(() => {})
})
</script>

<style scoped>
.main-container {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 100%;
  padding: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.market-page {
  flex: 1;
  min-height: 0;
}
</style>
