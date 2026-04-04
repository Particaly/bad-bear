import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  deleteInstalledPlugin,
  installMarketPlugin,
  openInstalledPlugin,
  packageInstalledPlugin,
  readFileAsBlob,
  reloadInstalledPlugin,
  removeTempPluginPackage,
  resolvePluginInstallPayload,
  revealPluginInFinder,
  uploadPluginPackage,
} from '../../../api/pluginMarket'
import type {
  PluginDetailState,
  InstalledBusyAction,
  MarketBusyAction,
} from './shared'
import type {
  PluginDetailResponse,
  PluginMarketPlugin,
  PluginMarketUiPlugin,
  ResolvedPluginDownloadTarget,
} from '../../../types/pluginMarket'
import { compareVersions } from '../utils'
import { getErrorMessage } from './shared'

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

  const isShareInProgress = computed(
    () => installedBusyAction.value === 'share' && !!installedBusyPluginName.value,
  )
  const canInstallFromMarket = computed(() => options.canUseInternalPluginApis.value)

  function isShareDisabledForPlugin(pluginName: string): boolean {
    if (options.isInternalPlugin(pluginName)) {
      return true
    }

    return isShareInProgress.value && installedBusyPluginName.value !== pluginName
  }

  function canUpgrade(plugin: PluginMarketUiPlugin): boolean {
    if (!plugin.installed || !plugin.localVersion || !plugin.version) {
      return false
    }

    return compareVersions(plugin.localVersion, plugin.version) < 0
  }

  function buildLatestPluginDownloadTarget(
    plugin: PluginMarketUiPlugin,
    detail?: PluginDetailResponse | null,
  ): ResolvedPluginDownloadTarget {
    const latestBuild = detail?.versions?.[0] || null
    const payload = latestBuild
      ? resolvePluginInstallPayload(plugin.marketPlugin || plugin, {
          version: latestBuild.version,
          hash: latestBuild.hash,
        })
      : resolvePluginInstallPayload(plugin.marketPlugin || plugin)

    return {
      version: latestBuild?.version || payload.version,
      hash: latestBuild?.hash || null,
      downloadMode: latestBuild ? 'hash' : 'latest',
      downloadUrl: payload.downloadUrl || '',
      build: latestBuild,
      plugin: payload,
    }
  }

  function resolvePluginTargetForAction(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ): ResolvedPluginDownloadTarget | null {
    const isSelectedDetailPlugin = plugin.name === options.selectedPluginName.value
    if (!params.preferLatest && isSelectedDetailPlugin && options.pluginDetailState.value.detail) {
      return options.resolvedSelectedPluginTarget.value
    }

    const detail = isSelectedDetailPlugin ? options.pluginDetailState.value.detail : null
    return buildLatestPluginDownloadTarget(plugin, detail)
  }

  function buildPluginInstallConfirmation(plugin: PluginMarketUiPlugin): {
    title: string
    message: string
    confirmText: string
  } | null {
    const target = resolvePluginTargetForAction(plugin)
    if (!target || !plugin.installed || !plugin.localVersion) {
      return null
    }

    const comparison = compareVersions(plugin.localVersion, target.version)
    const actionLabel = comparison < 0 ? '升级' : comparison > 0 ? '降级' : '重装'
    const title = comparison < 0 ? '确认升级' : comparison > 0 ? '确认安装历史版本' : '确认重装构建'
    const targetLabel = target.build ? `${target.version}（${target.hash}）` : target.version || '最新版本'
    const message = `确定将 ${plugin.title} 从 ${plugin.localVersion || '未知版本'}${actionLabel}到 ${targetLabel}吗？安装过程会先删除旧插件，若新构建安装失败，你将暂时失去该插件。`

    return {
      title,
      message,
      confirmText: actionLabel,
    }
  }

  function requirePluginInstallPayload(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ): PluginMarketPlugin | null {
    const target = resolvePluginTargetForAction(plugin, params)
    const isSelectedDetailPlugin =
      plugin.name === options.selectedPluginName.value && !!options.pluginDetailState.value.detail

    if (!target) {
      options.notifyError('当前插件没有可安装的版本或构建')
      return null
    }

    if (canInstallFromMarket.value) {
      if (isSelectedDetailPlugin && !params.preferLatest && !target.build) {
        options.notifyError('当前插件没有可安装的版本或构建')
        return null
      }
    } else if (!target.downloadUrl) {
      options.notifyError('当前插件没有可下载的文件')
      return null
    }

    return target.plugin
  }

  function requirePluginInstallTargetSummary(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ): string {
    const target = resolvePluginTargetForAction(plugin, params)
    if (!target) {
      return plugin.version || '最新版本'
    }

    if (!target.build) {
      return target.version || '最新版本'
    }

    return params.preferLatest ? target.version || '最新版本' : `${target.version}（${target.hash}）`
  }

  function requirePluginInstallSuccessText(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ): string {
    const targetLabel = requirePluginInstallTargetSummary(plugin, params)
    return `已安装 ${plugin.title} ${targetLabel}`
  }

  function requirePluginUpgradeSuccessText(plugin: PluginMarketUiPlugin): string {
    const target = resolvePluginTargetForAction(plugin)
    if (!target || !plugin.localVersion) {
      return `已安装 ${plugin.title}`
    }

    const comparison = compareVersions(plugin.localVersion, target.version)
    if (comparison < 0) {
      return `已升级 ${plugin.title} 到 ${target.version}`
    }

    if (comparison > 0) {
      return `已安装 ${plugin.title} 历史版本 ${target.version}`
    }

    return `已安装 ${plugin.title} 所选构建`
  }

  function requirePluginUpgradeFailureText(plugin: PluginMarketUiPlugin): string {
    const target = resolvePluginTargetForAction(plugin)
    if (!target || !plugin.localVersion) {
      return '升级失败'
    }

    const comparison = compareVersions(plugin.localVersion, target.version)
    if (comparison < 0) {
      return '升级失败'
    }

    if (comparison > 0) {
      return '安装历史版本失败'
    }

    return '安装所选构建失败'
  }

  async function openPluginDownload(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ): Promise<void> {
    const installPayload = requirePluginInstallPayload(plugin, params)
    if (!installPayload?.downloadUrl) {
      options.notifyError('当前插件没有可下载的文件')
      return
    }

    if (typeof window.ztools?.shellOpenExternal !== 'function') {
      options.notifyError('当前宿主未暴露下载能力')
      return
    }

    window.ztools.shellOpenExternal(installPayload.downloadUrl)
    options.notifySuccess(`已开始下载 ${plugin.title}`)
  }

  async function handleOpenPlugin(plugin: PluginMarketUiPlugin) {
    try {
      const result = await openInstalledPlugin(plugin)
      if (result && result.success === false) {
        throw new Error(result.error || '打开插件失败')
      }
    } catch (error) {
      console.error('[PluginMarket] 打开插件失败:', error)
      options.notifyError(getErrorMessage(error, '打开插件失败'))
    }
  }

  async function handleInstall(
    plugin: PluginMarketUiPlugin,
    params: {
      preferLatest?: boolean
    } = {},
  ) {
    if (!canInstallFromMarket.value) {
      await openPluginDownload(plugin, params)
      return
    }

    if (marketBusyPluginName.value || installedBusyPluginName.value) {
      return
    }

    const installPayload = requirePluginInstallPayload(plugin, params)
    if (!installPayload) {
      return
    }

    marketBusyPluginName.value = plugin.name
    marketBusyAction.value = 'download'

    try {
      const result = await installMarketPlugin(installPayload)
      if (!result.success) {
        throw new Error(result.error || '安装失败')
      }

      options.notifySuccess(requirePluginInstallSuccessText(plugin, params))
      await options.reloadMarket()
      options.openPluginByName(plugin.name)
    } catch (error) {
      console.error('[PluginMarket] 安装失败:', error)
      options.notifyError(getErrorMessage(error, '安装失败'))
    } finally {
      marketBusyPluginName.value = null
      marketBusyAction.value = null
    }
  }

  async function handleInstallLatest(plugin: PluginMarketUiPlugin) {
    await handleInstall(plugin, { preferLatest: true })
  }

  async function handleUpgrade(plugin: PluginMarketUiPlugin) {
    if (marketBusyPluginName.value || installedBusyPluginName.value) {
      return
    }

    if (!plugin.path) {
      options.notifyError('找不到已安装插件路径，无法升级')
      return
    }

    const installPayload = requirePluginInstallPayload(plugin)
    if (!installPayload) {
      return
    }

    const confirmation = buildPluginInstallConfirmation(plugin)
    if (confirmation) {
      const confirmed = await options.confirmAction({
        title: confirmation.title,
        message: confirmation.message,
        type: 'warning',
        confirmText: confirmation.confirmText,
        cancelText: '取消',
      })

      if (!confirmed) {
        return
      }
    }

    marketBusyPluginName.value = plugin.name
    marketBusyAction.value = 'upgrade'

    try {
      const deleteResult = await deleteInstalledPlugin(plugin.path)
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || '删除旧版本失败')
      }

      const installResult = await installMarketPlugin(installPayload)
      if (!installResult.success) {
        throw new Error(installResult.error || '安装新版本失败')
      }

      options.notifySuccess(requirePluginUpgradeSuccessText(plugin))
      await options.reloadMarket()
      options.openPluginByName(plugin.name)
    } catch (error) {
      console.error('[PluginMarket] 升级失败:', error)
      options.notifyError(getErrorMessage(error, requirePluginUpgradeFailureText(plugin)))
      await options.reloadMarket()
    } finally {
      marketBusyPluginName.value = null
      marketBusyAction.value = null
    }
  }

  async function handleUninstall(plugin: PluginMarketUiPlugin) {
    if (!plugin.path) {
      options.notifyError('找不到插件路径，无法卸载')
      return
    }

    if (marketBusyPluginName.value || installedBusyPluginName.value) {
      return
    }

    const confirmed = await options.confirmAction({
      title: '确认卸载',
      message: `确定卸载 ${plugin.title} 吗？`,
      type: 'danger',
      confirmText: '卸载',
      cancelText: '取消',
    })
    if (!confirmed) {
      return
    }

    installedBusyPluginName.value = plugin.name
    installedBusyAction.value = 'uninstall'

    try {
      const result = await deleteInstalledPlugin(plugin.path)
      if (!result.success) {
        throw new Error(result.error || '卸载失败')
      }

      options.notifySuccess(`已卸载 ${plugin.title}`)
      options.closePlugin()
      await options.reloadMarket()
    } catch (error) {
      console.error('[PluginMarket] 卸载失败:', error)
      options.notifyError(getErrorMessage(error, '卸载失败'))
    } finally {
      installedBusyPluginName.value = null
      installedBusyAction.value = null
    }
  }

  async function handleOpenFolder(plugin: PluginMarketUiPlugin) {
    if (!plugin.path) {
      options.notifyError('找不到插件路径，无法打开目录')
      return
    }

    try {
      await revealPluginInFinder(plugin.path)
    } catch (error) {
      console.error('[PluginMarket] 打开插件目录失败:', error)
      options.notifyError(getErrorMessage(error, '打开插件目录失败'))
    }
  }

  async function handleReloadPlugin(plugin: PluginMarketUiPlugin) {
    if (!plugin.path) {
      options.notifyError('找不到插件路径，无法重载')
      return
    }

    if (marketBusyPluginName.value || installedBusyPluginName.value) {
      return
    }

    installedBusyPluginName.value = plugin.name
    installedBusyAction.value = 'reload'

    try {
      const result = await reloadInstalledPlugin(plugin.path)
      if (!result.success) {
        throw new Error(result.error || '重载失败')
      }

      options.notifySuccess(`已重载 ${plugin.title}`)
      await options.reloadMarket()
      options.openPluginByName(plugin.name)
    } catch (error) {
      console.error('[PluginMarket] 重载插件失败:', error)
      options.notifyError(getErrorMessage(error, '重载插件失败'))
    } finally {
      installedBusyPluginName.value = null
      installedBusyAction.value = null
    }
  }

  async function handleSharePlugin(plugin: PluginMarketUiPlugin) {
    if (options.isInternalPlugin(plugin.name)) {
      options.notifyError('内置插件不支持分享')
      return
    }

    if (!plugin.path) {
      options.notifyError('找不到插件路径，无法分享')
      return
    }

    if (!options.requireShopLogin('分享插件')) {
      return
    }

    if (marketBusyPluginName.value || installedBusyPluginName.value) {
      return
    }

    installedBusyPluginName.value = plugin.name
    installedBusyAction.value = 'share'

    let tempPackagePath: string | undefined

    try {
      const packageResult = await packageInstalledPlugin(plugin.path)
      if (!packageResult.success) {
        if (packageResult.error === '已取消') {
          return
        }
        throw new Error(packageResult.error || '插件打包失败')
      }

      if (!packageResult.filePath) {
        throw new Error('插件打包未返回文件路径，无法上传')
      }

      tempPackagePath = packageResult.filePath

      const file = await readFileAsBlob(tempPackagePath)
      const version = plugin.localVersion || plugin.version || '0.0.0'
      const fileName = `${plugin.name}-${version}.zpx`
      const uploadResult = await uploadPluginPackage({
        file,
        fileName,
      })

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '插件上传失败')
      }

      options.notifySuccess(uploadResult.message || `已分享 ${plugin.title}`)
    } catch (error) {
      console.error('[PluginMarket] 分享插件失败:', error)
      options.notifyError(getErrorMessage(error, '分享插件失败'))
    } finally {
      if (tempPackagePath) {
        try {
          await removeTempPluginPackage(tempPackagePath)
        } catch (cleanupError) {
          console.warn('[PluginMarket] 清理临时插件包失败:', cleanupError)
        }
      }

      installedBusyPluginName.value = null
      installedBusyAction.value = null
    }
  }

  return {
    marketBusyPluginName,
    marketBusyAction,
    installedBusyPluginName,
    installedBusyAction,
    selectedPluginBusyAction,
    canInstallFromMarket,
    canUpgrade,
    isShareDisabledForPlugin,
    handleOpenPlugin,
    handleInstall,
    handleInstallLatest,
    handleUpgrade,
    handleUninstall,
    handleOpenFolder,
    handleReloadPlugin,
    handleSharePlugin,
  }
}
