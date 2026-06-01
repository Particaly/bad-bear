# bad-bear

基于 **Vue 3 + Vite + TypeScript** 的 ZTools 插件，当前核心提供两块能力：
- ZTools 主程序注入/恢复入口
- 插件商店与已安装插件管理界面

## 开发脚本

```bash
npm install
npm run dev
npm run build
```

- `npm run dev`：本地开发
- `npm run build`：类型检查 + 生产构建

## 当前目录结构

```text
.
├─ public/
│  ├─ plugin.json
│  └─ preload/
│     ├─ services.js
│     ├─ package.json
│     ├─ swap-asar.*
│     └─ restore-asar.*
├─ src/
│  ├─ App.vue
│  ├─ main.ts
│  ├─ main.css
│  ├─ env.d.ts
│  ├─ app/
│  │  ├─ index.ts
│  │  ├─ injection.ts
│  │  └─ useMarketRiskDialog.ts
│  ├─ api/
│  │  ├─ auth.ts
│  │  ├─ httpClient.ts
│  │  ├─ notifications.ts
│  │  ├─ pluginMarket.ts
│  │  ├─ pluginMarketRemote.ts
│  │  ├─ pluginMarketHost.ts
│  │  ├─ pluginMarketStorefront.ts
│  │  ├─ query.ts
│  ├─ components/
│  │  ├─ index.ts
│  │  ├─ common/
│  │  └─ plugin-market/
│  │     ├─ PluginMarketPage.vue
│  │     ├─ PluginDetail.vue
│  │     ├─ detail/
│  │     └─ page/
│  ├─ composables/
│  │  ├─ index.ts
│  │  └─ useColorScheme.ts
│  ├─ config/
│  │  ├─ pluginMarket.ts
│  │  ├─ runtimeConfig.ts
│  │  ├─ theme.ts
│  └─ types/
```