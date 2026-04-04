import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  createPluginComment,
  createPluginRating,
  getPluginComments,
  getPluginDetail,
  getPluginRatings,
} from '../../../api/pluginMarket'
import type { AuthUser } from '../../../types/auth'
import type {
  PluginDetailVersion,
  PluginMarketUiPlugin,
  ResolvedPluginDownloadTarget,
} from '../../../types/pluginMarket'
import {
  buildCommentTree,
  buildPluginHashOptions,
  buildPluginVersionOptions,
  buildResolvedPluginDownloadTarget,
  createEmptyPluginDetailState,
  getErrorMessage,
  mergePluginDetailIntoPlugin,
  resolveSelectedHash,
  resolveSelectedVersion,
} from './shared'
import { compareVersions } from '../utils'

export function usePluginMarketDetail(options: {
  selectedPlugin: ComputedRef<PluginMarketUiPlugin | null>
  selectedPluginName: Ref<string | null>
  currentUser: Ref<AuthUser | null>
  canInstallFromMarket: Ref<boolean>
  requireShopLogin: (actionLabel: string) => boolean
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
}) {
  const pluginDetailState = ref(createEmptyPluginDetailState())
  const pluginCommentSubmitSuccessKey = ref(0)

  const pluginCommentTree = computed(() => buildCommentTree(pluginDetailState.value.comments))
  const hasMorePluginComments = computed(
    () => pluginDetailState.value.comments.length < pluginDetailState.value.commentTotal,
  )
  const pluginVersionOptions = computed(() =>
    buildPluginVersionOptions(pluginDetailState.value.detail),
  )
  const selectedVersionHashOptions = computed(() =>
    buildPluginHashOptions(pluginDetailState.value.detail, pluginDetailState.value.selectedVersion),
  )
  const selectedPluginBuild = computed<PluginDetailVersion | null>(() => {
    if (
      !pluginDetailState.value.detail ||
      !pluginDetailState.value.selectedVersion ||
      !pluginDetailState.value.selectedHash
    ) {
      return null
    }

    return (
      pluginDetailState.value.detail.versions.find(
        (item) =>
          item.version === pluginDetailState.value.selectedVersion &&
          item.hash === pluginDetailState.value.selectedHash,
      ) || null
    )
  })
  const resolvedSelectedPluginTarget = computed<ResolvedPluginDownloadTarget | null>(() =>
    buildResolvedPluginDownloadTarget(
      options.selectedPlugin.value,
      pluginDetailState.value.detail,
      pluginDetailState.value.selectedVersion,
      pluginDetailState.value.selectedHash,
    ),
  )
  const mergedSelectedPlugin = computed(() => {
    if (!options.selectedPlugin.value) {
      return null
    }

    return mergePluginDetailIntoPlugin(
      options.selectedPlugin.value,
      pluginDetailState.value.detail,
      resolvedSelectedPluginTarget.value,
    )
  })
  const selectedPluginActionText = computed(() => {
    const plugin = mergedSelectedPlugin.value
    const target = resolvedSelectedPluginTarget.value

    if (!plugin) {
      return options.canInstallFromMarket.value ? '安装插件' : '下载插件文件'
    }

    if (!options.canInstallFromMarket.value) {
      return target?.downloadUrl ? '下载插件文件' : '暂无可下载文件'
    }

    if (!target?.build) {
      return plugin.installed ? '暂无可安装构建' : '暂无可安装版本'
    }

    if (!plugin.installed || !plugin.localVersion) {
      return '安装所选版本'
    }

    const comparison = compareVersions(plugin.localVersion, target.version)
    if (comparison < 0) {
      return '升级到所选版本'
    }

    if (comparison > 0) {
      return '安装历史版本'
    }

    return '安装所选构建'
  })

  async function loadPluginDetail(name: string, requestId: number): Promise<void> {
    const detail = await getPluginDetail(name)
    if (
      pluginDetailState.value.requestId !== requestId ||
      options.selectedPluginName.value !== name
    ) {
      return
    }

    pluginDetailState.value.detail = detail

    const currentSelectedVersion = pluginDetailState.value.selectedVersion
    const currentSelectedHash = pluginDetailState.value.selectedHash
    const hasCurrentVersion =
      !!currentSelectedVersion &&
      detail.versions.some((item) => item.version === currentSelectedVersion)
    const nextSelectedVersion = hasCurrentVersion
      ? currentSelectedVersion
      : resolveSelectedVersion(detail, options.selectedPlugin.value?.localVersion)
    const nextSelectedHash =
      nextSelectedVersion &&
      currentSelectedHash &&
      detail.versions.some(
        (item) =>
          item.version === nextSelectedVersion && item.hash === currentSelectedHash,
      )
        ? currentSelectedHash
        : resolveSelectedHash(detail, nextSelectedVersion)

    pluginDetailState.value.selectedVersion = nextSelectedVersion
    pluginDetailState.value.selectedHash = nextSelectedHash
  }

  async function loadCurrentUserPluginRating(name: string, requestId: number): Promise<void> {
    if (!options.currentUser.value) {
      if (
        pluginDetailState.value.requestId === requestId &&
        options.selectedPluginName.value === name
      ) {
        pluginDetailState.value.currentUserRating = null
      }
      return
    }

    try {
      const response = await getPluginRatings(name, { page: 1, pageSize: 100 })
      if (
        pluginDetailState.value.requestId !== requestId ||
        options.selectedPluginName.value !== name
      ) {
        return
      }

      pluginDetailState.value.currentUserRating =
        response.items.find((item) => item.user.id === options.currentUser.value?.id) || null
    } catch (error) {
      if (
        pluginDetailState.value.requestId !== requestId ||
        options.selectedPluginName.value !== name
      ) {
        return
      }

      console.warn('[PluginMarket] 加载当前用户评分失败:', error)
      pluginDetailState.value.currentUserRating = null
    }
  }

  async function loadPluginComments(
    name: string,
    requestId: number,
    params: { page?: number; append?: boolean } = {},
  ): Promise<void> {
    const page = params.page ?? 1
    const append = params.append ?? false

    if (append) {
      pluginDetailState.value.commentLoadingMore = true
    } else {
      pluginDetailState.value.commentLoading = true
      pluginDetailState.value.commentError = ''
    }

    try {
      const response = await getPluginComments(name, {
        page,
        pageSize: pluginDetailState.value.commentPageSize,
      })

      if (
        pluginDetailState.value.requestId !== requestId ||
        options.selectedPluginName.value !== name
      ) {
        return
      }

      const nextItems = append
        ? [...pluginDetailState.value.comments, ...response.items].filter(
            (item, index, list) =>
              list.findIndex((current) => current.id === item.id) === index,
          )
        : response.items

      pluginDetailState.value.comments = nextItems
      pluginDetailState.value.commentPage = response.page
      pluginDetailState.value.commentPageSize = response.pageSize
      pluginDetailState.value.commentTotal = response.total
      pluginDetailState.value.commentError = ''
    } catch (error) {
      if (
        pluginDetailState.value.requestId !== requestId ||
        options.selectedPluginName.value !== name
      ) {
        return
      }

      pluginDetailState.value.commentError = getErrorMessage(error, '加载评论失败')
    } finally {
      if (
        pluginDetailState.value.requestId !== requestId ||
        options.selectedPluginName.value !== name
      ) {
        return
      }

      pluginDetailState.value.commentLoading = false
      pluginDetailState.value.commentLoadingMore = false
    }
  }

  function resetPluginDetailState(): void {
    pluginDetailState.value = createEmptyPluginDetailState()
  }

  async function reloadSelectedPluginDetail(): Promise<void> {
    if (!options.selectedPlugin.value) {
      resetPluginDetailState()
      return
    }

    const pluginName = options.selectedPlugin.value.name
    const requestId = pluginDetailState.value.requestId + 1
    const previousSelectedVersion = pluginDetailState.value.selectedVersion
    const previousSelectedHash = pluginDetailState.value.selectedHash
    pluginDetailState.value = {
      ...createEmptyPluginDetailState(),
      requestId,
      commentLoading: true,
      selectedVersion: previousSelectedVersion,
      selectedHash: previousSelectedHash,
    }

    try {
      await Promise.all([
        loadPluginDetail(pluginName, requestId),
        loadCurrentUserPluginRating(pluginName, requestId),
        loadPluginComments(pluginName, requestId),
      ])
    } catch (error) {
      console.error('[PluginMarket] 加载插件详情交互数据失败:', error)
    }
  }

  async function handleLoadMorePluginComments(): Promise<void> {
    if (
      !options.selectedPlugin.value ||
      pluginDetailState.value.commentLoadingMore ||
      !hasMorePluginComments.value
    ) {
      return
    }

    await loadPluginComments(
      options.selectedPlugin.value.name,
      pluginDetailState.value.requestId,
      {
        page: pluginDetailState.value.commentPage + 1,
        append: true,
      },
    )
  }

  async function handleSubmitPluginRating(score: number): Promise<void> {
    if (!options.selectedPlugin.value || pluginDetailState.value.ratingSubmitting) {
      return
    }

    if (!options.requireShopLogin('评分')) {
      return
    }

    pluginDetailState.value.ratingSubmitting = true

    try {
      await createPluginRating(options.selectedPlugin.value.name, { score })
      options.notifySuccess('评分成功')
      await Promise.all([
        loadPluginDetail(options.selectedPlugin.value.name, pluginDetailState.value.requestId),
        loadCurrentUserPluginRating(
          options.selectedPlugin.value.name,
          pluginDetailState.value.requestId,
        ),
      ])
    } catch (error) {
      console.error('[PluginMarket] 提交评分失败:', error)
      options.notifyError(getErrorMessage(error, '提交评分失败'))
    } finally {
      pluginDetailState.value.ratingSubmitting = false
    }
  }

  async function handleSubmitPluginComment(payload: {
    content: string
    parentId?: string
  }): Promise<void> {
    if (!options.selectedPlugin.value || pluginDetailState.value.commentSubmitting) {
      return
    }

    if (!options.requireShopLogin(payload.parentId ? '回复评论' : '发表评论')) {
      return
    }

    pluginDetailState.value.commentSubmitting = true

    try {
      await createPluginComment(options.selectedPlugin.value.name, payload)
      options.notifySuccess(payload.parentId ? '回复成功' : '评论成功')
      pluginCommentSubmitSuccessKey.value += 1
      await loadPluginComments(
        options.selectedPlugin.value.name,
        pluginDetailState.value.requestId,
      )
    } catch (error) {
      console.error('[PluginMarket] 提交评论失败:', error)
      options.notifyError(getErrorMessage(error, '提交评论失败'))
    } finally {
      pluginDetailState.value.commentSubmitting = false
    }
  }

  function selectPluginDetailVersion(version: string | number): void {
    const normalizedVersion = typeof version === 'number' ? String(version) : version
    pluginDetailState.value.selectedVersion = normalizedVersion
    pluginDetailState.value.selectedHash = resolveSelectedHash(
      pluginDetailState.value.detail,
      normalizedVersion,
    )
  }

  function selectPluginDetailHash(hash: string | number): void {
    pluginDetailState.value.selectedHash = typeof hash === 'number' ? String(hash) : hash
  }

  return {
    pluginDetailState,
    pluginCommentSubmitSuccessKey,
    pluginCommentTree,
    hasMorePluginComments,
    pluginVersionOptions,
    selectedVersionHashOptions,
    selectedPluginBuild,
    resolvedSelectedPluginTarget,
    mergedSelectedPlugin,
    selectedPluginActionText,
    resetPluginDetailState,
    reloadSelectedPluginDetail,
    handleLoadMorePluginComments,
    handleSubmitPluginRating,
    handleSubmitPluginComment,
    selectPluginDetailVersion,
    selectPluginDetailHash,
  }
}
