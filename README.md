# bad-bear

基于 **Vue 3 + Vite + TypeScript** 的 ZTools 插件，当前核心提供两块能力：
- ZTools 主程序注入/恢复入口
- 插件商店与已安装插件管理界面

## 开发脚本

```bash
npm install
npm run dev
npm run build
npm test
```

- `npm run dev`：本地开发
- `npm run build`：类型检查 + 生产构建
- `npm test`：运行 Vitest 纯函数测试

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
│  │  ├─ pluginMarketPackaging.ts
│  │  ├─ pluginMarketStorefront.ts
│  │  ├─ query.ts
│  │  └─ *.test.ts
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
│  │  └─ runtimeConfig.test.ts
│  └─ types/
└─ vitest.config.ts
```

## 核心模块说明

### 1. App 注入流程

`src/App.vue` 负责顶层状态展示，具体逻辑拆到：
- `src/app/injection.ts`：路径计算、注入、恢复调度
- `src/app/useMarketRiskDialog.ts`：商店风险提示状态

保持原有状态机语义不变：
- `checking`
- `injected`
- `cannot-inject`
- `confirm-inject`
- `injecting`
- `inject-success`
- `restore-pending`
- `inject-error`

### 2. 插件商店页面

`src/components/plugin-market/PluginMarketPage.vue` 现在主要负责组装页面，领域逻辑拆到：
- `page/usePluginMarketRuntime.ts`
- `page/usePluginMarketNotifications.ts`
- `page/usePluginMarketDetail.ts`
- `page/usePluginMarketActions.ts`
- `page/storefront.ts`
- `page/shared.ts`

### 3. 插件详情页

`src/components/plugin-market/PluginDetail.vue` 现在是详情容器，子块拆到：
- `detail/PluginReadmePanel.vue`
- `detail/PluginCommentsSection.vue`
- `detail/PluginVersionDialog.vue`
- `detail/usePluginReadme.ts`
- `detail/formatters.ts`

### 4. API 边界

`src/api/pluginMarket.ts` 作为聚合出口，内部按职责拆分：
- `pluginMarketRemote.ts`：远端 HTTP API
- `pluginMarketHost.ts`：宿主插件操作
- `pluginMarketPackaging.ts`：打包/文件桥接
- `pluginMarketStorefront.ts`：商店数据适配与 storefront 组装
- `query.ts`：统一 query builder

## preload 与类型声明

- preload 实现：`public/preload/services.js`
- 类型声明：`src/env.d.ts`

目前已完成：
- `extractFileFromAsar` 等声明与实现对齐
- 新增 `analyzeImage`、`startHotkeyRecording`、`onHotkeyRecorded` 类型声明
- 新增 `@` 路径别名支持

## 测试覆盖

当前最小测试覆盖了：
- `normalizeShopApiBaseUrl`
- `buildShopApiAssetUrl`
- `compareVersions`
- `formatDateTime`
- query builder
- `resolvePluginInstallPayload`
- 评论树/通知树构建
- 空通知状态默认值

## 维护建议

后续继续演进时，优先遵循：
- 页面容器只保留状态组装与事件转发
- 远端 API / 宿主能力 / 纯 helper 分层
- preload 变更与 `env.d.ts` 同步修改
- 纯函数优先补测试，再做大规模移动
