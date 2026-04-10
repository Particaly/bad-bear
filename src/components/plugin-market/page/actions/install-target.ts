// 安装目标解析和确认辅助函数

import type { ComputedRef } from 'vue'
import { resolvePluginInstallPayload } from '../../../../api/pluginMarket'
import type {
  PluginDetailResponse,
  PluginMarketPlugin,
  PluginMarketUiPlugin,
  ResolvedPluginDownloadTarget,
} from '../../../../types/pluginMarket'
import { compareVersions } from '../../utils'

/**
 * 构建插件的最新下载目标
 * 如果有详情版本则使用详情版本，否则回退到最新版本
 */
export function buildLatestPluginDownloadTarget(
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

/**
 * 解析插件操作的下载目标
 * 优先选择选中的详情目标（如果可用），否则构建最新目标
 */
export function resolvePluginTargetForAction(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
    preferLatest?: boolean
  },
): ResolvedPluginDownloadTarget | null {
  const isSelectedDetailPlugin = plugin.name === params.selectedPluginName
  // 如果不强制最新且是当前选中的详情插件，则使用选中的目标
  if (!params.preferLatest && isSelectedDetailPlugin && params.pluginDetailState.detail) {
    return params.resolvedSelectedPluginTarget.value
  }

  const detail = isSelectedDetailPlugin ? params.pluginDetailState.detail : null
  return buildLatestPluginDownloadTarget(plugin, detail)
}

/**
 * 检查插件是否可以基于版本比较进行升级
 */
export function canUpgrade(plugin: PluginMarketUiPlugin): boolean {
  if (!plugin.installed || !plugin.localVersion || !plugin.version) {
    return false
  }

  return compareVersions(plugin.localVersion, plugin.version) < 0
}

/**
 * 构建升级/降级/重装场景的安装确认对话框内容
 */
export function buildPluginInstallConfirmation(
  plugin: PluginMarketUiPlugin,
  target: ResolvedPluginDownloadTarget | null,
): {
  title: string
  message: string
  confirmText: string
} | null {
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

/**
 * 获取插件操作的有效安装载荷
 * 如果插件无法安装则返回 null
 */
export function requirePluginInstallPayload(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
    canInstallFromMarket: boolean
    preferLatest?: boolean
    notifyError: (message: string) => void
  },
): PluginMarketPlugin | null {
  const target = resolvePluginTargetForAction(plugin, params)
  const isSelectedDetailPlugin =
    plugin.name === params.selectedPluginName && !!params.pluginDetailState.detail

  if (!target) {
    params.notifyError('当前插件没有可安装的版本或构建')
    return null
  }

  if (params.canInstallFromMarket) {
    // 如果可以从市场安装，检查是否有构建信息
    if (isSelectedDetailPlugin && !params.preferLatest && !target.build) {
      params.notifyError('当前插件没有可安装的版本或构建')
      return null
    }
  } else if (!target.downloadUrl) {
    params.notifyError('当前插件没有可下载的文件')
    return null
  }

  return target.plugin
}

/**
 * 获取安装目标版本的可读摘要
 */
export function requirePluginInstallTargetSummary(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
    preferLatest?: boolean
  },
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

/**
 * 获取插件安装成功后的消息文本
 */
export function requirePluginInstallSuccessText(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
    preferLatest?: boolean
  },
): string {
  const targetLabel = requirePluginInstallTargetSummary(plugin, params)
  return `已安装 ${plugin.title} ${targetLabel}`
}

/**
 * 获取插件升级/降级/重装成功后的消息文本
 */
export function requirePluginUpgradeSuccessText(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
  },
): string {
  const target = resolvePluginTargetForAction(plugin, params)
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

/**
 * 获取插件升级操作的失败消息文本
 */
export function requirePluginUpgradeFailureText(
  plugin: PluginMarketUiPlugin,
  params: {
    selectedPluginName: string | null
    pluginDetailState: { detail: PluginDetailResponse | null }
    resolvedSelectedPluginTarget: ComputedRef<ResolvedPluginDownloadTarget | null>
  },
): string {
  const target = resolvePluginTargetForAction(plugin, params)
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
