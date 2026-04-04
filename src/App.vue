<template>
  <div class="container">
    <PluginMarketPage class="market-page" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import PluginMarketPage from './components/plugin-market/PluginMarketPage.vue'
import { initializeTheme } from './config/theme'

onMounted(() => {
  void initializeTheme()

  window.ztools.onPluginEnter(() => {})
  window.ztools.onPluginOut(() => {})
})
</script>

<style scoped>
.container {
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
