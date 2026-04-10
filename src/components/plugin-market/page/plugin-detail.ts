// 插件详情版本/哈希解析和合并逻辑

import type {
  PluginDetailResponse,
  PluginDetailVersion,
  PluginHashOption,
  PluginMarketPlugin,
  PluginMarketUiPlugin,
  PluginVersionOption,
  ResolvedPluginDownloadTarget,
} from '../../../types/pluginMarket'
import { resolvePluginInstallPayload } from '../../../api/pluginMarket'

/**
 * 将详情响应数据合并到基础插件模型中
 * 详情数据（评分、下载量、大小）在可用时优先
 */
export function mergePluginDetailIntoPlugin(
  plugin: PluginMarketUiPlugin,
  detail: PluginDetailResponse | null,
  resolvedDownloadTarget?: ResolvedPluginDownloadTarget | null,
): PluginMarketUiPlugin {
  if (!detail && !resolvedDownloadTarget) {
    return plugin
  }

  const latestBuild = detail?.versions?.[0] || null
  const resolvedVersion = resolvedDownloadTarget?.version || plugin.version

  return {
    ...plugin,
    version: resolvedVersion,
    downloadUrl: resolvedDownloadTarget?.downloadUrl || plugin.downloadUrl,
    size: typeof plugin.size === 'number' ? plugin.size : latestBuild?.fileSize,
    totalDownloads: detail?.totalDownloads ?? plugin.totalDownloads,
    avgRating: detail?.avgRating ?? plugin.avgRating,
    ratingCount: detail?.ratingCount ?? plugin.ratingCount,
  }
}

/**
 * 从可用版本构建版本下拉选项
 * 当某个版本有多个构建时，标签中会显示构建数量
 */
export function buildPluginVersionOptions(
  detail: PluginDetailResponse | null,
): PluginVersionOption[] {
  if (!detail?.versions?.length) {
    return []
  }

  const options: PluginVersionOption[] = []
  const versionCounts = new Map<string, number>()

  // 统计每个版本的构建数量
  detail.versions.forEach((item) => {
    versionCounts.set(item.version, (versionCounts.get(item.version) || 0) + 1)
  })

  // 构建版本选项
  detail.versions.forEach((item) => {
    if (options.some((option) => option.value === item.version)) {
      return
    }

    const buildCount = versionCounts.get(item.version) || 1
    options.push({
      label: buildCount > 1 ? `${item.version}（${buildCount} 个构建）` : item.version,
      value: item.version,
      buildCount,
    })
  })

  return options
}

/**
 * 为特定版本构建哈希（构建）下拉选项
 * 第一个/最新的构建会被标记为"最新构建"
 */
export function buildPluginHashOptions(
  detail: PluginDetailResponse | null,
  version: string | null,
): PluginHashOption[] {
  if (!detail?.versions?.length || !version) {
    return []
  }

  return detail.versions
    .filter((item) => item.version === version)
    .map((item, index) => ({
      label: index === 0 ? `${item.hash}（最新构建）` : item.hash,
      value: item.hash,
      hash: item.hash,
      fileSize: item.fileSize,
      downloads: item.downloads,
      createdAt: item.createdAt,
    }))
}

/**
 * 解析默认应该选择的版本
 * 优先选择已安装在详情版本中的本地版本，否则回退到最新版本
 */
export function resolveSelectedVersion(
  detail: PluginDetailResponse | null,
  localVersion?: string | null,
): string | null {
  if (!detail?.versions?.length) {
    return null
  }

  // 如果本地版本存在于详情版本中，则选择本地版本
  if (localVersion && detail.versions.some((item) => item.version === localVersion)) {
    return localVersion
  }

  return detail.versions[0]?.version || null
}

/**
 * 解析给定版本应该选择的哈希
 * 返回该版本第一个（最新）构建的哈希
 */
export function resolveSelectedHash(
  detail: PluginDetailResponse | null,
  version: string | null,
): string | null {
  if (!detail?.versions?.length || !version) {
    return null
  }

  return detail.versions.find((item) => item.version === version)?.hash || null
}

/**
 * 构建完整的安装下载目标
 * 处理三种下载模式：
 * - 'latest': 使用插件的默认下载 URL
 * - 'version': 使用特定版本（该版本的最新构建）
 * - 'hash': 使用特定构建哈希
 */
export function buildResolvedPluginDownloadTarget(
  plugin: PluginMarketUiPlugin | null,
  detail: PluginDetailResponse | null,
  selectedVersion: string | null,
  selectedHash: string | null,
): ResolvedPluginDownloadTarget | null {
  if (!plugin) {
    return null
  }

  const marketPlugin = plugin.marketPlugin || plugin
  // 如果没有详情版本或未选择版本，则使用最新模式
  if (!detail?.versions?.length || !selectedVersion) {
    return {
      version: plugin.version,
      hash: null,
      downloadMode: 'latest',
      downloadUrl: resolvePluginInstallPayload(marketPlugin).downloadUrl || '',
      build: null,
      plugin: resolvePluginInstallPayload(marketPlugin),
    }
  }

  // 查找匹配的构建
  const build = detail.versions.find(
    (item) => item.version === selectedVersion && (!selectedHash || item.hash === selectedHash),
  )

  const downloadMode = build ? 'hash' : 'version'
  const payload = resolvePluginInstallPayload(marketPlugin, {
    version: selectedVersion,
    hash: build?.hash || null,
  })

  return {
    version: selectedVersion,
    hash: build?.hash || null,
    downloadMode,
    downloadUrl: payload.downloadUrl || '',
    build: build || null,
    plugin: payload,
  }
}
