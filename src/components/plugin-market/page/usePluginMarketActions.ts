// 插件操作编排层 - 组合安装目标、市场、已安装和分享操作

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { PluginDetailState, InstalledBusyAction, MarketBusyAction } from './shared'
import type { PluginMarketUiPlugin, ResolvedPluginDownloadTarget } from '../../../types/pluginMarket'
import { canUpgrade as checkCanUpgrade } from './actions/install-target'
import { handleInstall, handleInstallLatest, handleUpgrade, openPluginDownload } from './actions/market-actions'
import { handleOpenFolder, handleOpenPlugin, handleReloadPlugin, handleUninstall } from './actions/installed-actions'
import {
  getShareTitleForPlugin,
  handleSharePlugin,
  isShareDisabledForPlugin,
} from './actions/share-actions'

export function usePluginMarketActions(options: {
  selectedPluginName: Ref<string | null>
  pluginDetailState: Ref<PluginDetailState>
  resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
  canUseInternalPluginApis: Ref<boolean>
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
  requireShopLogin: (actionLabel: string) => boolean
  confirmAction: (params: {
    title?: string
    message: string
    type?: 'info' | 'warning' | 'danger'
    confirmText?: string
    cancelText?: string
  }) => Promise<boolean>
  reloadMarket: () => Promise<void>
  openPluginByName: (name: string) => void
  closePlugin: () => void
  isInternalPlugin: (name: string) => boolean
}) {
  // UI 反馈的忙碌状态跟踪
  const marketBusyPluginName = ref<string | null>(null)
  const marketBusyAction = ref<MarketBusyAction>(null)
  const installedBusyPluginName = ref<string | null>(null)
  const installedBusyAction = ref<InstalledBusyAction>(null)

  // 计算当前选中插件的忙碌状态
  const selectedPluginBusyAction = computed(() => {
    if (!options.selectedPluginName.value) {
      return null
    }

    if (options.selectedPluginName.value === installedBusyPluginName.value) {
      return installedBusyAction.value
    }

    if (options.selectedPluginName.value === marketBusyPluginName.value) {
      return marketBusyAction.value
    }

    return null
  })

  const isShareInProgress = computed(
    () => installedBusyAction.value === 'share' && !!installedBusyPluginName.value,
  )
  const canInstallFromMarket = computed(() => options.canUseInternalPluginApis.value)

  /**
   * 检查插件是否可以基于版本比较进行升级
   */
  function canUpgrade(plugin: PluginMarketUiPlugin): boolean {
    return checkCanUpgrade(plugin)
  }

  /**
   * 检查插件的分享操作是否被禁用
   */
  function isShareDisabled(pluginName: string): boolean {
    return isShareDisabledForPlugin(pluginName, {
      isInternalPlugin: options.isInternalPlugin,
      isShareInProgress: isShareInProgress.value,
      installedBusyPluginName,
    })
  }

  /**
   * 获取插件的分享按钮标题
   */
  function getShareTitle(
    shareParams: {
      pluginName: string
      isInternal?: boolean
      isLoggedIn?: boolean
    },
  ): string {
    return getShareTitleForPlugin({
      pluginName: shareParams.pluginName,
      isInternalPlugin: options.isInternalPlugin,
      isInternal: shareParams.isInternal,
      isShareInProgress: isShareInProgress.value,
      installedBusyPluginName,
      isLoggedIn: shareParams.isLoggedIn,
    })
  }

  /**
   * 处理通过外部浏览器下载插件（后备方案）
   */
  async function openPluginDownloadFallback(
    plugin: PluginMarketUiPlugin,
    downloadParams: { preferLatest?: boolean } = {},
  ): Promise<void> {
    await openPluginDownload(plugin, {
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      resolvedSelectedPluginTarget: options.resolvedSelectedPluginTarget,
      preferLatest: downloadParams.preferLatest,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
    })
  }

  /**
   * 处理从市场安装插件
   */
  async function handleInstallWrapper(
    plugin: PluginMarketUiPlugin,
    installParams: { preferLatest?: boolean } = {},
  ): Promise<void> {
    await handleInstall(plugin, {
      canInstallFromMarket: canInstallFromMarket.value,
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      resolvedSelectedPluginTarget: options.resolvedSelectedPluginTarget,
      marketBusyPluginName,
      marketBusyAction,
      installedBusyPluginName,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
      openPluginByName: options.openPluginByName,
      preferLatest: installParams.preferLatest,
    })
  }

  /**
   * 处理插件安装（始终使用最新版本）
   */
  async function handleInstallLatestWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleInstallLatest(plugin, {
      canInstallFromMarket: canInstallFromMarket.value,
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      resolvedSelectedPluginTarget: options.resolvedSelectedPluginTarget,
      marketBusyPluginName,
      marketBusyAction,
      installedBusyPluginName,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
      openPluginByName: options.openPluginByName,
    })
  }

  /**
   * 处理插件升级
   */
  async function handleUpgradeWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleUpgrade(plugin, {
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      resolvedSelectedPluginTarget: options.resolvedSelectedPluginTarget,
      marketBusyPluginName,
      marketBusyAction,
      installedBusyPluginName,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
      openPluginByName: options.openPluginByName,
      confirmAction: options.confirmAction,
    })
  }

  /**
   * 处理打开已安装的插件
   */
  async function handleOpenPluginWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleOpenPlugin(plugin, {
      notifyError: options.notifyError,
    })
  }

  /**
   * 处理插件卸载
   */
  async function handleUninstallWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleUninstall(plugin, {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      confirmAction: options.confirmAction,
      closePlugin: options.closePlugin,
      reloadMarket: options.reloadMarket,
    })
  }

  /**
   * 处理打开插件文件夹
   */
  async function handleOpenFolderWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleOpenFolder(plugin, {
      notifyError: options.notifyError,
    })
  }

  /**
   * 处理重载已安装的插件
   */
  async function handleReloadPluginWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleReloadPlugin(plugin, {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
      openPluginByName: options.openPluginByName,
    })
  }

  /**
   * 处理插件分享操作
   */
  async function handleSharePluginWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleSharePlugin(plugin, {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      requireShopLogin: options.requireShopLogin,
      isInternalPlugin: options.isInternalPlugin,
    })
  }

  return {
    marketBusyPluginName,
    marketBusyAction,
    installedBusyPluginName,
    installedBusyAction,
    selectedPluginBusyAction,
    canInstallFromMarket,
    canUpgrade,
    isShareDisabledForPlugin: isShareDisabled,
    getShareTitleForPlugin: getShareTitle,
    handleOpenPlugin: handleOpenPluginWrapper,
    handleInstall: handleInstallWrapper,
    handleInstallLatest: handleInstallLatestWrapper,
    handleUpgrade: handleUpgradeWrapper,
    handleUninstall: handleUninstallWrapper,
    handleOpenFolder: handleOpenFolderWrapper,
    handleReloadPlugin: handleReloadPluginWrapper,
    handleSharePlugin: handleSharePluginWrapper,
  }
}
