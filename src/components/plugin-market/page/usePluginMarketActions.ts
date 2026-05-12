// 插件操作编排层 - 组合安装目标、市场和已安装操作

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { PluginDetailState, InstalledBusyAction, MarketBusyAction } from './shared'
import type { PluginMarketUiPlugin, ResolvedPluginDownloadTarget } from '../../../types/pluginMarket'
import { canUpgrade as checkCanUpgrade } from './actions/install-target'
import { handleInstall, handleInstallLatest, handleUpgrade } from './actions/market-actions'
import { handleOpenFolder, handleOpenPlugin, handleStopPlugin, handleUninstall } from './actions/installed-actions'

export function usePluginMarketActions(options: {
  selectedPluginName: Ref<string | null>
  pluginDetailState: Ref<PluginDetailState>
  currentPluginDownloadTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
  canUseInternalPluginApis: Ref<boolean>
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
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
}) {
  const marketBusyPluginName = ref<string | null>(null)
  const marketBusyAction = ref<MarketBusyAction>(null)
  const installedBusyPluginName = ref<string | null>(null)
  const installedBusyAction = ref<InstalledBusyAction>(null)

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

  const canInstallFromMarket = computed(() => options.canUseInternalPluginApis.value)

  function canUpgrade(plugin: PluginMarketUiPlugin): boolean {
    return checkCanUpgrade(plugin)
  }

  async function handleInstallWrapper(
    plugin: PluginMarketUiPlugin,
    installParams: { preferLatest?: boolean } = {},
  ): Promise<void> {
    await handleInstall(plugin, {
      canInstallFromMarket: canInstallFromMarket.value,
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      currentPluginDownloadTarget: options.currentPluginDownloadTarget,
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

  async function handleInstallLatestWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleInstallLatest(plugin, {
      canInstallFromMarket: canInstallFromMarket.value,
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      currentPluginDownloadTarget: options.currentPluginDownloadTarget,
      marketBusyPluginName,
      marketBusyAction,
      installedBusyPluginName,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
      openPluginByName: options.openPluginByName,
    })
  }

  async function handleUpgradeWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleUpgrade(plugin, {
      selectedPluginName: options.selectedPluginName.value,
      pluginDetailState: options.pluginDetailState.value,
      currentPluginDownloadTarget: options.currentPluginDownloadTarget,
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

  async function handleOpenPluginWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleOpenPlugin(plugin, {
      notifyError: options.notifyError,
    })
  }

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

  async function handleStopPluginWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleStopPlugin(plugin, {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError: options.notifyError,
      notifySuccess: options.notifySuccess,
      reloadMarket: options.reloadMarket,
    })
  }

  async function handleOpenFolderWrapper(plugin: PluginMarketUiPlugin): Promise<void> {
    await handleOpenFolder(plugin, {
      notifyError: options.notifyError,
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
    handleOpenPlugin: handleOpenPluginWrapper,
    handleInstall: handleInstallWrapper,
    handleInstallLatest: handleInstallLatestWrapper,
    handleUpgrade: handleUpgradeWrapper,
    handleUninstall: handleUninstallWrapper,
    handleStopPlugin: handleStopPluginWrapper,
    handleOpenFolder: handleOpenFolderWrapper,
  }
}
