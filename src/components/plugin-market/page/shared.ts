import { resolvePluginInstallPayload } from '../../../api/pluginMarket'
import type { LoginRequest, RegisterRequest } from '../../../types/auth'
import type {
  InstalledPlugin,
  InstalledViewPlugin,
  Platform,
  PluginCommentRecord,
  PluginCommentTreeNode,
  PluginDetailResponse,
  PluginDetailVersion,
  PluginHashOption,
  PluginMarketPlugin,
  PluginMarketUiPlugin,
  PluginRatingRecord,
  PluginVersionOption,
  ResolvedPluginDownloadTarget,
} from '../../../types/pluginMarket'
import type {
  NotificationFilter,
  NotificationRecord,
  NotificationTreeNode,
} from '../../../types/notification'
import { compareVersions } from '../utils'

export type ActiveNav = 'store' | 'installed' | 'notifications' | 'account' | 'settings'
export type MarketBusyAction = 'download' | 'upgrade' | null
export type InstalledBusyAction = 'reload' | 'share' | 'uninstall' | null

export const ACCOUNT_PATTERN = /^[A-Za-z0-9_-]{3,50}$/
export const USERNAME_MIN_LENGTH = 2
export const USERNAME_MAX_LENGTH = 50
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])
export const PLUGIN_COMMENTS_PAGE_SIZE = 20
export const NOTIFICATIONS_PAGE_SIZE = 20
export const NOTIFICATION_POLLING_INTERVAL = 30000

export interface PluginDetailState {
  detail: PluginDetailResponse | null
  selectedVersion: string | null
  selectedHash: string | null
  comments: PluginCommentRecord[]
  currentUserRating: PluginRatingRecord | null
  commentPage: number
  commentPageSize: number
  commentTotal: number
  commentLoading: boolean
  commentLoadingMore: boolean
  commentSubmitting: boolean
  ratingSubmitting: boolean
  commentError: string
  requestId: number
}

export interface NotificationState {
  items: NotificationRecord[]
  filter: NotificationFilter
  page: number
  pageSize: number
  total: number
  loading: boolean
  error: string
  selectedId: string | null
  selectedItem: NotificationRecord | null
  initialized: boolean
  markingAllRead: boolean
  requestId: number
}

export function createEmptyPluginDetailState(): PluginDetailState {
  return {
    detail: null,
    selectedVersion: null,
    selectedHash: null,
    comments: [],
    currentUserRating: null,
    commentPage: 1,
    commentPageSize: PLUGIN_COMMENTS_PAGE_SIZE,
    commentTotal: 0,
    commentLoading: false,
    commentLoadingMore: false,
    commentSubmitting: false,
    ratingSubmitting: false,
    commentError: '',
    requestId: 0,
  }
}

export function createEmptyNotificationState(): NotificationState {
  return {
    items: [],
    filter: 'ALL',
    page: 1,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
    selectedId: null,
    selectedItem: null,
    initialized: false,
    markingAllRead: false,
    requestId: 0,
  }
}

export function isPluginVisibleOnPlatform(
  plugin: PluginMarketPlugin,
  platform: Platform,
): boolean {
  if (!Array.isArray(plugin.platform) || plugin.platform.length === 0) {
    return true
  }

  return plugin.platform.includes(platform)
}

export function toInstalledMap(installedPlugins: InstalledPlugin[]): Map<string, InstalledPlugin> {
  return new Map(installedPlugins.map((plugin) => [plugin.name, plugin]))
}

export function toUiPlugin(
  plugin: PluginMarketPlugin,
  installedMap: Map<string, InstalledPlugin>,
  runningPluginSet: Set<string>,
): PluginMarketUiPlugin {
  const installedPlugin = installedMap.get(plugin.name)
  const localVersion = installedPlugin?.version

  return {
    ...plugin,
    title: plugin.title || installedPlugin?.title || plugin.name,
    description: plugin.description || installedPlugin?.description || '',
    logo: plugin.logo || installedPlugin?.logo,
    author: plugin.author || installedPlugin?.author,
    homepage: plugin.homepage || installedPlugin?.homepage,
    size: typeof plugin.size === 'number' ? plugin.size : installedPlugin?.size,
    features: plugin.features || installedPlugin?.features,
    installed: !!installedPlugin,
    path: installedPlugin?.path,
    localVersion,
    latestVersion: plugin.version || localVersion || '',
    marketPlugin: plugin,
    hasUpdate:
      !!installedPlugin &&
      !!localVersion &&
      !!plugin.version &&
      compareVersions(localVersion, plugin.version) < 0,
    isRunning: !!installedPlugin?.path && runningPluginSet.has(installedPlugin.path),
    isDevelopment: installedPlugin?.isDevelopment ?? false,
  }
}

export function buildInstalledViewPlugins(
  installedPlugins: InstalledPlugin[],
  marketPluginMap: Map<string, PluginMarketPlugin>,
  runningPluginSet: Set<string>,
): InstalledViewPlugin[] {
  return installedPlugins
    .map((plugin): InstalledViewPlugin => {
      const marketPlugin = marketPluginMap.get(plugin.name)
      const latestVersion = marketPlugin?.version || plugin.version || ''

      return {
        ...marketPlugin,
        ...plugin,
        title: marketPlugin?.title || plugin.title || plugin.name,
        description: marketPlugin?.description || plugin.description || '',
        logo: marketPlugin?.logo || plugin.logo,
        author: marketPlugin?.author || plugin.author,
        homepage: marketPlugin?.homepage || plugin.homepage,
        size: typeof marketPlugin?.size === 'number' ? marketPlugin.size : plugin.size,
        features: marketPlugin?.features || plugin.features,
        version: latestVersion,
        installed: true,
        path: plugin.path,
        localVersion: plugin.version,
        latestVersion,
        marketPlugin,
        hasUpdate:
          !!marketPlugin?.version && compareVersions(plugin.version, marketPlugin.version) < 0,
        isRunning: runningPluginSet.has(plugin.path),
        isDevelopment: !!plugin.isDevelopment,
      }
    })
    .sort((left, right) => {
      const leftTime =
        typeof left.installedAt === 'string' ? new Date(left.installedAt).getTime() : 0
      const rightTime =
        typeof right.installedAt === 'string' ? new Date(right.installedAt).getTime() : 0
      return rightTime - leftTime
    })
}

export function resolvePluginList(
  items: Array<{ name: string }> | undefined,
  pluginMap: Map<string, PluginMarketUiPlugin>,
): PluginMarketUiPlugin[] {
  if (!items?.length) {
    return []
  }

  return items
    .map((item) => pluginMap.get(item.name))
    .filter((plugin): plugin is PluginMarketUiPlugin => !!plugin)
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export function flattenCommentRecords(
  items: PluginCommentRecord[],
  parentId: string | null = null,
): PluginCommentRecord[] {
  return items.flatMap((item) => {
    const { replies = [], ...comment } = item
    return [
      {
        ...comment,
        parentId: comment.parentId ?? parentId,
      },
      ...flattenCommentRecords(replies, item.id),
    ]
  })
}

export function buildCommentTree(items: PluginCommentRecord[]): PluginCommentTreeNode[] {
  const flattenedItems: PluginCommentRecord[] = []
  const seen = new Set<string>()

  flattenCommentRecords(items).forEach((item) => {
    if (seen.has(item.id)) {
      return
    }

    seen.add(item.id)
    flattenedItems.push(item)
  })

  const nodeMap = new Map<string, PluginCommentTreeNode>()
  const roots: PluginCommentTreeNode[] = []

  flattenedItems.forEach((item) => {
    nodeMap.set(item.id, {
      ...item,
      replies: [],
    })
  })

  flattenedItems.forEach((item) => {
    const node = nodeMap.get(item.id)
    if (!node) {
      return
    }

    if (item.parentId) {
      const parent = nodeMap.get(item.parentId)
      if (parent) {
        parent.replies.push(node)
        return
      }
    }

    roots.push(node)
  })

  return roots
}

export function resolveNotificationParentId(item: NotificationRecord): string | null {
  if (typeof item.parentId === 'string' && item.parentId.trim()) {
    return item.parentId.trim()
  }

  if (item.metadata && typeof item.metadata === 'object') {
    const parentId = (item.metadata as Record<string, unknown>).parentId
    if (typeof parentId === 'string' && parentId.trim()) {
      return parentId.trim()
    }
  }

  return null
}

export function findNotificationRootId(
  itemId: string,
  parentMap: Map<string, string | null>,
  nodeMap: Map<string, NotificationTreeNode>,
): string | null {
  let currentId = itemId
  const visited = new Set<string>([itemId])

  while (true) {
    const parentId = parentMap.get(currentId)
    if (!parentId) {
      return currentId
    }

    if (visited.has(parentId)) {
      return itemId
    }

    if (!nodeMap.has(parentId)) {
      return currentId
    }

    visited.add(parentId)
    currentId = parentId
  }
}

export function buildNotificationTree(items: NotificationRecord[]): NotificationTreeNode[] {
  const nodeMap = new Map<string, NotificationTreeNode>()
  const parentMap = new Map<string, string | null>()
  const roots: NotificationTreeNode[] = []

  items.forEach((item) => {
    nodeMap.set(item.id, {
      ...item,
      replies: [],
      depth: 0,
    })
    parentMap.set(item.id, resolveNotificationParentId(item))
  })

  items.forEach((item) => {
    const node = nodeMap.get(item.id)
    if (!node) {
      return
    }

    const rootId = findNotificationRootId(item.id, parentMap, nodeMap)
    if (!rootId || rootId === item.id) {
      roots.push(node)
      return
    }

    const rootNode = nodeMap.get(rootId)
    if (!rootNode) {
      roots.push(node)
      return
    }

    node.depth = 1
    rootNode.replies.push(node)
  })

  roots.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
  roots.forEach((root) => {
    root.replies.sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt))
  })

  return roots
}

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

export function buildPluginVersionOptions(
  detail: PluginDetailResponse | null,
): PluginVersionOption[] {
  if (!detail?.versions?.length) {
    return []
  }

  const options: PluginVersionOption[] = []
  const versionCounts = new Map<string, number>()

  detail.versions.forEach((item) => {
    versionCounts.set(item.version, (versionCounts.get(item.version) || 0) + 1)
  })

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

export function resolveSelectedVersion(
  detail: PluginDetailResponse | null,
  localVersion?: string | null,
): string | null {
  if (!detail?.versions?.length) {
    return null
  }

  if (localVersion && detail.versions.some((item) => item.version === localVersion)) {
    return localVersion
  }

  return detail.versions[0]?.version || null
}

export function resolveSelectedHash(
  detail: PluginDetailResponse | null,
  version: string | null,
): string | null {
  if (!detail?.versions?.length || !version) {
    return null
  }

  return detail.versions.find((item) => item.version === version)?.hash || null
}

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

export function validateUsername(username: string): void {
  const trimmed = username.trim()
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    throw new Error(`用户名长度需为 ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} 个字符`)
  }
}

export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 个字符`)
  }
}

export function validateRegisterPayload(payload: RegisterRequest): void {
  if (!ACCOUNT_PATTERN.test(payload.account)) {
    throw new Error('账号需为 3-50 位字母、数字、下划线或连字符')
  }

  validateUsername(payload.username)
  validatePassword(payload.password)
}

export function validateLoginPayload(payload: LoginRequest): void {
  if (!payload.account.trim()) {
    throw new Error('请输入账号')
  }

  if (!payload.password) {
    throw new Error('请输入密码')
  }
}

export function validateAvatarFile(file: File): void {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('头像仅支持 jpeg/png/gif/webp 格式')
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('头像大小不能超过 5MB')
  }
}
