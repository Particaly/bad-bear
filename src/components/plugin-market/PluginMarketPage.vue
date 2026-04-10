<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  fetchPluginMarket,
  getCurrentPlatform,
  getInstalledPlugins,
  getRunningPlugins,
} from '../../api/pluginMarket'
import { useToast } from '../common/Toast'
import type {
  CategoryInfo,
  CategoryLayoutSection,
  InstalledPlugin,
  InstalledViewPlugin,
  PluginMarketFetchResponse,
  PluginMarketSectionModel,
  PluginMarketUiPlugin,
  StorefrontCategorySummary,
} from '../../types/pluginMarket'
import AccountPanel from './AccountPanel.vue'
import ApiSettingsPanel from './ApiSettingsPanel.vue'
import CategoryCard from './CategoryCard.vue'
import CategoryDetail from './CategoryDetail.vue'
import InstalledPluginCard from './InstalledPluginCard.vue'
import NotificationPanel from './NotificationPanel.vue'
import PluginCard from './PluginCard.vue'
import PluginDetail from './PluginDetail.vue'
import PluginUploadPanel from './PluginUploadPanel.vue'
import RefreshButton from './RefreshButton.vue'
import { shuffleArray, weightedSearch } from './utils'
import type { ActiveNav } from './page/shared'
import { isPluginHostPermissionDeniedError } from './page/shared'
import { usePluginMarketActions } from './page/usePluginMarketActions'
import { usePluginMarketDetail } from './page/usePluginMarketDetail'
import { usePluginMarketNavigation } from './page/usePluginMarketNavigation'
import { usePluginMarketNotifications } from './page/usePluginMarketNotifications'
import { usePluginMarketSelection } from './page/usePluginMarketSelection'
import { usePluginMarketUploads } from './page/usePluginMarketUploads'
import { usePluginMarketRuntime } from './page/usePluginMarketRuntime'
import { useStoreSubInput } from './page/useStoreSubInput'
import { buildMarketViewState } from './page/storefront'

const activeNav = ref<ActiveNav>('store')
const isLoading = ref(true)
const loadError = ref('')
const canUseInternalPluginApis = ref(true)
const plugins = ref<PluginMarketUiPlugin[]>([])
const installedPlugins = ref<InstalledPlugin[]>([])
const installedViewPlugins = ref<InstalledViewPlugin[]>([])
const runningPluginPaths = ref<string[]>([])
const storefrontSections = ref<PluginMarketSectionModel[]>([])
const storefrontCategories = ref<Record<string, CategoryInfo>>({})
const categoryLayouts = ref<Record<string, CategoryLayoutSection[]>>({})
const selectedCategoryKey = ref<string | null>(null)
const selectedPluginName = ref<string | null>(null)
const searchQuery = ref('')
let reloadSelectedPluginDetailRef: () => Promise<void> = async () => {}
let refreshNotificationsAfterAuthChangeRef: () => Promise<void> = async () => {}

function isInternalPlugin(_name: string): boolean {
  return false
}

const {
  success: showSuccessToast,
  error: showErrorToast,
  confirm,
} = useToast()

function notifyError(message: string) {
  showErrorToast(message)
}

function notifySuccess(message: string) {
  showSuccessToast(message)
}

async function confirmAction(options: {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
}): Promise<boolean> {
  return confirm(options)
}

function openPluginByName(name: string) {
  selectedPluginName.value = name
}

// Sub-input composable for market search
const {
  syncStoreSubInput,
  focusSubInput,
  clearSearchQuery,
  unregisterSubInput,
} = useStoreSubInput({
  isStoreNav: computed(() => activeNav.value === 'store'),
  searchQuery,
})

// Selection state composable
const {
  isStoreNav,
  isInstalledNav,
  isListNav,
  isSearchMode,
  showScrollableContent,
  selectedCategory,
  selectedPlugin,
} = usePluginMarketSelection({
  activeNav,
  selectedCategoryKey,
  selectedPluginName,
  searchQuery,
  plugins,
  installedViewPlugins,
  storefrontCategories,
})

async function reloadMarket() {
  isLoading.value = true
  loadError.value = ''

  const marketTask = fetchPluginMarket().catch((): PluginMarketFetchResponse => ({
    success: false,
    error: '无法连接到商店服务器',
    data: [],
    storefront: undefined,
  }))
  const runningTask = getRunningPlugins().catch((): string[] => [])
  const installedTask = getInstalledPlugins()
    .then((items) => {
      canUseInternalPluginApis.value = true
      return items
    })
    .catch((error) => {
      if (isPluginHostPermissionDeniedError(error)) {
        canUseInternalPluginApis.value = false
        return []
      }

      throw error
    })

  try {
    const [marketResponse, nextInstalledPlugins, nextRunningPluginPaths] = await Promise.all([
      marketTask,
      installedTask,
      runningTask,
    ])

    const marketResult = marketResponse
    const currentPlatform = getCurrentPlatform()
    const viewState = buildMarketViewState(
      marketResult,
      nextInstalledPlugins,
      nextRunningPluginPaths,
      currentPlatform,
    )

    plugins.value = viewState.uiPlugins
    installedPlugins.value = nextInstalledPlugins
    installedViewPlugins.value = viewState.installedViewPlugins
    runningPluginPaths.value = nextRunningPluginPaths
    storefrontCategories.value = viewState.storefrontCategories
    storefrontSections.value = viewState.storefrontSections
    categoryLayouts.value = viewState.categoryLayouts


    if (!marketResult.success && viewState.uiPlugins.length === 0) {
      loadError.value = '无法连接到商店服务器'
    }

    if (selectedCategoryKey.value && !viewState.storefrontCategories[selectedCategoryKey.value]) {
      selectedCategoryKey.value = null
    }

    const hasSelectedPlugin = selectedPluginName.value
      ? viewState.uiPlugins.some((plugin) => plugin.name === selectedPluginName.value) ||
        viewState.installedViewPlugins.some((plugin) => plugin.name === selectedPluginName.value)
      : false

    if (selectedPluginName.value && !hasSelectedPlugin) {
      selectedPluginName.value = null
    }
  } catch (error) {
    console.error('[PluginMarket] 加载失败:', error)
    loadError.value = '无法连接到商店服务器'
    plugins.value = []
    installedPlugins.value = []
    installedViewPlugins.value = []
    runningPluginPaths.value = []
    storefrontSections.value = []
    storefrontCategories.value = {}
    categoryLayouts.value = {}
  } finally {
    isLoading.value = false
  }
}

const runtime = usePluginMarketRuntime({
  activeNav,
  selectedPluginName,
  notifyError,
  notifySuccess,
  onAuthChanged: () => Promise.all([
    refreshNotificationsAfterAuthChangeRef(),
    uploadLoadRecords(),
  ]).then(() => {}),
  onReloadMarket: () => reloadMarket(),
  onReloadSelectedPluginDetail: () => reloadSelectedPluginDetailRef(),
})

const {
  shopApiBaseUrl,
  authToken,
  currentUser,
  runtimeConfigLoaded,
  isRestoringSession,
  isLoggingIn,
  isRegistering,
  isUpdatingUsername,
  isUpdatingPassword,
  isUploadingAvatar,
  githubBinding,
  githubDeviceFlow,
  isGithubDeviceFlowBusy,
  currentUserAvatarUrl,
  refreshCurrentUser,
  requireShopLogin,
  ensureGithubBound,
  handleLogin,
  handleRegister,
  handleGithubLogin,
  handleGithubBind,
  handleOpenGithubVerificationPage,
  handleCancelGithubDeviceFlow,
  handleLogout,
  handleUpdateUsername,
  handleUpdatePassword,
  handleUploadAvatar,
  handleSaveBaseUrl,
} = runtime

const pluginMap = computed(() => new Map(plugins.value.map((plugin) => [plugin.name, plugin])))
const installedPluginMap = computed(
  () => new Map(installedViewPlugins.value.map((plugin) => [plugin.name, plugin])),
)
const canInstallFromMarket = computed(() => canUseInternalPluginApis.value)

const hasStorefront = computed(() => storefrontSections.value.length > 0)
const filteredPlugins = computed(() =>
  weightedSearch(plugins.value, searchQuery.value, [
    { value: (plugin) => plugin.title || plugin.name || '', weight: 10 },
    { value: (plugin) => plugin.description || '', weight: 5 },
  ]),
)

function closePlugin() {
  selectedPluginName.value = null
}

const detail = usePluginMarketDetail({
  selectedPlugin,
  selectedPluginName,
  currentUser,
  canInstallFromMarket,
  requireShopLogin,
  notifyError,
  notifySuccess,
})

const {
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
} = detail

reloadSelectedPluginDetailRef = reloadSelectedPluginDetail

const actions = usePluginMarketActions({
  selectedPluginName,
  pluginDetailState,
  resolvedSelectedPluginTarget,
  canUseInternalPluginApis,
  notifyError,
  notifySuccess,
  requireShopLogin,
  ensureGithubBound,
  confirmAction,
  reloadMarket: () => reloadMarket(),
  openPluginByName,
  closePlugin,
  isInternalPlugin,
})

const {
  marketBusyPluginName,
  installedBusyPluginName,
  selectedPluginBusyAction,
  canUpgrade,
  isShareDisabledForPlugin,
  getShareTitleForPlugin: buildShareTitle,
  handleOpenPlugin,
  handleInstall,
  handleInstallLatest,
  handleUpgrade,
  handleUninstall,
  handleOpenFolder,
  handleReloadPlugin,
  handleSharePlugin,
} = actions

const notifications = usePluginMarketNotifications({
  activeNav,
  authToken,
  currentUser,
  goToAccount: () => {
    activeNav.value = 'account'
  },
  notifyError,
  notifySuccess,
})

const {
  notificationState,
  unreadNotificationTotal,
  readingNotificationIds,
  notificationTree,
  handleRefreshNotifications,
  handleNotificationFilterChange,
  handleNotificationPageChange,
  openNotification,
  closeNotificationDetail,
  handleMarkAllNotificationsRead,
  handleGoToNotificationLogin,
  refreshNotificationsAfterAuthChange,
  syncNotificationStream,
} = notifications

refreshNotificationsAfterAuthChangeRef = refreshNotificationsAfterAuthChange

const uploads = usePluginMarketUploads({
  authToken,
  currentUser,
  notifyError,
  notifySuccess,
  confirmAction,
  reloadMarket: () => reloadMarket(),
})

const {
  selectedFile: uploadSelectedFile,
  validationError: uploadValidationError,
  hashCheckResult: uploadHashCheckResult,
  isHashing: uploadIsHashing,
  isCheckingHash: uploadIsCheckingHash,
  isUploading: uploadIsUploading,
  canUpload: uploadCanUpload,
  uploads: uploadRecords,
  uploadsTotal: uploadRecordsTotal,
  uploadsPage: uploadRecordsPage,
  uploadsLoading: uploadRecordsLoading,
  uploadsError: uploadRecordsError,
  deletingIds: uploadDeletingIds,
  selectFile: uploadSelectFile,
  computeHashAndPrecheck: uploadPrecheck,
  performUpload: uploadPerformUpload,
  loadUploads: uploadLoadRecords,
  handleDeleteUpload: uploadHandleDelete,
  resetState: uploadResetState,
} = uploads

function handleUploadSelectFile(file: File): void {
  uploadSelectFile(file)
}

function handleUploadClearFile(): void {
  uploadSelectFile(null)
}

function handleUploadOpenPlugin(name: string): void {
  activeNav.value = 'store'
  selectedPluginName.value = name
}

// Navigation composable
const {
  handleNavClick: navClick,
  openCategory: navOpenCategory,
  closeCategory: navCloseCategory,
  openPlugin: navOpenPlugin,
  closePlugin: navClosePlugin,
} = usePluginMarketNavigation({
  activeNav,
  selectedCategoryKey,
  selectedPluginName,
  canUseInternalPluginApis,
  clearSearchQuery,
  refreshNavData: (nav) => {
    if (nav === 'store' || nav === 'installed') {
      if (isLoading.value) {
        return Promise.resolve()
      }
      return reloadMarket()
    }

    if (nav === 'notifications') {
      return handleRefreshNotifications()
    }

    if (nav === 'upload' && authToken.value && currentUser.value) {
      return uploadLoadRecords()
    }

    if (nav === 'account' && authToken.value && currentUser.value) {
      return refreshCurrentUser({ silent: true })
    }

    return Promise.resolve()
  },
})

function handleNavClick(nav: ActiveNav): void {
  navClick(nav)
}

function openCategory(category: StorefrontCategorySummary) {
  navOpenCategory(category.key)
}

function closeCategory() {
  navCloseCategory()
}

function openPlugin(plugin: PluginMarketUiPlugin) {
  navOpenPlugin(plugin.name)
}

const notificationBadgeText = computed(() => {
  if (!currentUser.value) {
    return '登录'
  }

  if (unreadNotificationTotal.value > 99) {
    return '99+'
  }

  return String(unreadNotificationTotal.value)
})

function isShareUnavailableForPlugin(pluginName: string): boolean {
  if (isShareDisabledForPlugin(pluginName)) {
    return true
  }

  if (!currentUser.value) {
    return true
  }

  return !githubBinding.value.bound
}

function getShareTitleForPlugin(pluginName: string): string {
  return buildShareTitle({
    pluginName,
    isInternal: isInternalPlugin(pluginName),
    isLoggedIn: !!currentUser.value,
    githubBound: githubBinding.value.bound,
    githubBindingLoading: githubBinding.value.loading,
    githubBindingError: githubBinding.value.errorMessage,
    githubBindingSupported: githubBinding.value.supported,
  })
}

function handleBannerClick(item: { image: string; url?: string }) {
  if (item.url && typeof window.ztools?.shellOpenExternal === 'function') {
    window.ztools.shellOpenExternal(item.url)
  }
}

function shuffleRandomSection(section: PluginMarketSectionModel): void {
  if (section.type !== 'random') {
    return
  }

  const usedNames = new Set<string>()

  for (const currentSection of storefrontSections.value) {
    if (
      currentSection === section ||
      currentSection.type === 'banner' ||
      currentSection.type === 'navigation'
    ) {
      continue
    }

    for (const plugin of currentSection.plugins || []) {
      usedNames.add(plugin.name)
    }
  }

  const available = plugins.value.filter((plugin) => !usedNames.has(plugin.name))
  section.plugins = shuffleArray(available).slice(0, section.plugins.length)
}

function getCategoryLayout(categoryKey: string): CategoryLayoutSection[] {
  return categoryLayouts.value[categoryKey] || categoryLayouts.value.default || []
}

function handleKeydown(event: KeyboardEvent) {
  const isFindShortcut =
    event.key.toLowerCase() === 'f' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey

  if (isStoreNav.value && isFindShortcut) {
    event.preventDefault()
    event.stopPropagation()
    focusSubInput(true)
    return
  }

  if (event.key !== 'Escape') {
    return
  }

  if (selectedPluginName.value) {
    event.stopPropagation()
    closePlugin()
    return
  }

  if (selectedCategory.value) {
    event.stopPropagation()
    closeCategory()
  }
}

watch(
  () => selectedPlugin.value?.name,
  (pluginName) => {
    if (!pluginName) {
      resetPluginDetailState()
      return
    }

    void reloadSelectedPluginDetail()
  },
)

watch(canUseInternalPluginApis, (enabled) => {
  if (!enabled && activeNav.value === 'installed') {
    activeNav.value = 'store'
    selectedPluginName.value = null
  }
})

watch(searchQuery, (query) => {
  if (!query.trim()) {
    return
  }

  selectedCategoryKey.value = null
})

watch(activeNav, (nav) => {
  if (nav === 'installed') {
    selectedCategoryKey.value = null
    clearSearchQuery()

    if (!canUseInternalPluginApis.value) {
      return
    }

    if (selectedPluginName.value && !installedPluginMap.value.has(selectedPluginName.value)) {
      selectedPluginName.value = null
    }
  } else if (nav === 'store') {
    if (selectedPluginName.value && !pluginMap.value.has(selectedPluginName.value)) {
      selectedPluginName.value = null
    }
  } else {
    selectedCategoryKey.value = null
    selectedPluginName.value = null
    clearSearchQuery()
  }

  syncStoreSubInput()
  syncNotificationStream()

  // Refresh data for the current nav tab
  if (nav === 'store' || nav === 'installed') {
    if (!isLoading.value) {
      void reloadMarket()
    }
  } else if (nav === 'notifications') {
    void handleRefreshNotifications()
  } else if (nav === 'upload' && authToken.value && currentUser.value) {
    void uploadLoadRecords()
  } else if (nav === 'account' && authToken.value && currentUser.value) {
    void refreshCurrentUser({ silent: true })
  }
})

onMounted(() => {
  syncNotificationStream()
  syncStoreSubInput()
  void reloadMarket()
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  unregisterSubInput()
  window.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <div class="plugin-market">
    <aside class="side-nav card">
      <div class="side-nav-header">
        <div class="side-nav-title">邪恶的熊</div>
        <div class="side-nav-subtitle">你需要有独当一面的能力<br>才能避免引火烧身</div>
      </div>

      <button
        class="side-nav-item"
        :class="{ active: activeNav === 'store' }"
        @click="handleNavClick('store')"
      >
        <span class="side-nav-item-label">商店</span>
        <span class="side-nav-count">{{ plugins.length }}</span>
      </button>
      <button
        v-if="canUseInternalPluginApis"
        class="side-nav-item"
        :class="{ active: activeNav === 'installed' }"
        @click="handleNavClick('installed')"
      >
        <span class="side-nav-item-label">已安装</span>
        <span class="side-nav-count">{{ installedViewPlugins.length }}</span>
      </button>
      <button
        class="side-nav-item"
        :class="{ active: activeNav === 'notifications' }"
        @click="handleNavClick('notifications')"
      >
        <span class="side-nav-item-label">通知</span>
        <span class="side-nav-count">{{ notificationBadgeText }}</span>
      </button>
      <button
        class="side-nav-item"
        :class="{ active: activeNav === 'upload' }"
        @click="handleNavClick('upload')"
      >
        <span class="side-nav-item-label">上传</span>
      </button>
      <button
        class="side-nav-item"
        :class="{ active: activeNav === 'account' }"
        @click="handleNavClick('account')"
      >
        <span class="side-nav-item-label">账户</span>
        <span class="side-nav-count">{{ currentUser ? currentUser.username : '未登录' }}</span>
      </button>
      <button
        class="side-nav-item"
        :class="{ active: activeNav === 'settings' }"
        @click="handleNavClick('settings')"
      >
        <span class="side-nav-item-label">设置</span>
      </button>

      <div class="side-nav-footer">
        <div v-if="currentUser" class="side-nav-user">
          <img v-if="currentUserAvatarUrl" :src="currentUserAvatarUrl" alt="头像" class="side-nav-avatar" />
          <div v-else class="side-nav-avatar side-nav-avatar--fallback">
            {{ (currentUser.username || currentUser.account).slice(0, 1).toUpperCase() }}
          </div>
          <div class="side-nav-user-copy">
            <div class="side-nav-user-name">{{ currentUser.username }}</div>
            <div class="side-nav-user-account">{{ currentUser.account }}</div>
          </div>
        </div>
        <div v-else class="side-nav-guest">更多功能登录后可用</div>
      </div>
    </aside>

    <div class="content-shell">
      <div class="content-body">
        <Transition name="list-slide">
          <div v-show="showScrollableContent" class="scrollable-content">
            <div v-if="isLoading" class="loading-state">
              <div class="loading-spinner"></div>
              <span>加载中...</span>
            </div>

            <template v-else-if="activeNav === 'store'">
              <template v-if="isSearchMode">
                <div v-if="filteredPlugins.length === 0" class="empty-state">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
                    <path
                      d="M16 16L20 20"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span>未找到匹配的插件</span>
                </div>
                <div v-else class="market-grid">
                  <PluginCard
                    v-for="plugin in filteredPlugins"
                    :key="plugin.name"
                    :plugin="plugin"
                    :installing-plugin="marketBusyPluginName"
                    :can-upgrade="canUpgrade(plugin)"
                    :can-install-from-market="canInstallFromMarket"
                    @click="openPlugin(plugin)"
                    @open="handleOpenPlugin(plugin)"
                    @download="handleInstall(plugin)"
                    @upgrade="handleUpgrade(plugin)"
                  />
                </div>
              </template>

              <template v-else-if="hasStorefront">
                <div class="storefront">
                  <template v-for="section in storefrontSections" :key="section.key">
                    <div v-if="section.type === 'banner'" class="storefront-banner">
                      <div
                        v-for="(item, idx) in section.items"
                        :key="idx"
                        class="banner-item"
                        :class="{ clickable: !!item.url }"
                        :style="section.height ? { height: `${section.height}px` } : undefined"
                        @click="handleBannerClick(item)"
                      >
                        <img :src="item.image" alt="" class="banner-image" draggable="false" />
                      </div>
                    </div>

                    <div v-else-if="section.type === 'navigation'" class="storefront-section">
                      <div v-if="section.title" class="section-header">
                        <span class="section-title">{{ section.title }}</span>
                      </div>
                      <div class="navigation-grid">
                        <CategoryCard
                          v-for="cat in section.categories"
                          :key="cat.key"
                          :title="cat.title"
                          :description="cat.description"
                          :icon="cat.icon"
                          :show-description="cat.showDescription"
                          :plugin-count="cat.pluginCount"
                          @click="openCategory(cat)"
                        />
                      </div>
                    </div>

                    <div
                      v-else-if="section.type === 'fixed' || section.type === 'random'"
                      class="storefront-section"
                    >
                      <div v-if="section.title || section.type === 'random'" class="section-header">
                        <span v-if="section.title" class="section-title">{{ section.title }}</span>
                        <RefreshButton
                          v-if="section.type === 'random'"
                          @click="shuffleRandomSection(section)"
                        />
                      </div>
                      <div class="market-grid">
                        <PluginCard
                          v-for="plugin in section.plugins"
                          :key="plugin.name"
                          :plugin="plugin"
                          :installing-plugin="marketBusyPluginName"
                          :can-upgrade="canUpgrade(plugin)"
                          :can-install-from-market="canInstallFromMarket"
                          @click="openPlugin(plugin)"
                          @open="handleOpenPlugin(plugin)"
                          @download="handleInstall(plugin)"
                          @upgrade="handleUpgrade(plugin)"
                        />
                      </div>
                    </div>
                  </template>
                </div>
              </template>

              <template v-else>
                <div v-if="plugins.length === 0 && !loadError" class="empty-state">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
                    <path
                      d="M16 16L20 20"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span>暂无插件</span>
                </div>
                <div v-else-if="loadError" class="empty-state">
                  <span>{{ loadError }}</span>
                  <button class="btn btn-md retry-btn" @click="reloadMarket">重试</button>
                </div>
                <div v-else class="market-grid">
                  <PluginCard
                    v-for="plugin in plugins"
                    :key="plugin.name"
                    :plugin="plugin"
                    :installing-plugin="marketBusyPluginName"
                    :can-upgrade="canUpgrade(plugin)"
                    :can-install-from-market="canInstallFromMarket"
                    @click="openPlugin(plugin)"
                    @open="handleOpenPlugin(plugin)"
                    @download="handleInstall(plugin)"
                    @upgrade="handleUpgrade(plugin)"
                  />
                </div>
              </template>
            </template>

            <template v-else>
              <div v-if="installedViewPlugins.length === 0" class="empty-state">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
                  <path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span>暂无已安装插件</span>
              </div>
              <div v-else class="installed-list">
                <InstalledPluginCard
                  v-for="plugin in installedViewPlugins"
                  :key="plugin.path"
                  :plugin="plugin"
                  :is-busy="installedBusyPluginName === plugin.name"
                  :share-disabled="isShareUnavailableForPlugin(plugin.name)"
                  :share-title="getShareTitleForPlugin(plugin.name)"
                  :is-internal="isInternalPlugin(plugin.name)"
                  @click="openPlugin(plugin)"
                  @open="handleOpenPlugin(plugin)"
                  @open-folder="handleOpenFolder(plugin)"
                  @reload="handleReloadPlugin(plugin)"
                  @share="handleSharePlugin(plugin)"
                  @uninstall="handleUninstall(plugin)"
                />
              </div>
            </template>
          </div>
        </Transition>

        <div v-if="activeNav === 'account'" class="panel-view scrollable-panel account-scroll">
          <AccountPanel
            :current-user="currentUser"
            :avatar-url="currentUserAvatarUrl"
            :is-restoring-session="runtimeConfigLoaded && isRestoringSession"
            :is-logging-in="isLoggingIn"
            :is-registering="isRegistering"
            :is-updating-username="isUpdatingUsername"
            :is-updating-password="isUpdatingPassword"
            :is-uploading-avatar="isUploadingAvatar"
            :github-binding="githubBinding"
            :github-device-flow="githubDeviceFlow"
            :is-github-device-flow-busy="isGithubDeviceFlowBusy"
            @login="handleLogin"
            @register="handleRegister"
            @github-login="handleGithubLogin"
            @github-bind="handleGithubBind"
            @github-open-verification="handleOpenGithubVerificationPage"
            @github-cancel-device-flow="handleCancelGithubDeviceFlow"
            @logout="handleLogout"
            @update-username="handleUpdateUsername"
            @update-password="handleUpdatePassword"
            @upload-avatar="handleUploadAvatar"
          />
        </div>

        <div v-else-if="activeNav === 'upload'" class="panel-view scrollable-panel">
          <PluginUploadPanel
            :current-user="currentUser"
            :github-binding="githubBinding"
            :selected-file="uploadSelectedFile"
            :validation-error="uploadValidationError"
            :hash-check-result="uploadHashCheckResult"
            :is-hashing="uploadIsHashing"
            :is-checking-hash="uploadIsCheckingHash"
            :is-uploading="uploadIsUploading"
            :can-upload="uploadCanUpload"
            :uploads="uploadRecords"
            :uploads-total="uploadRecordsTotal"
            :uploads-page="uploadRecordsPage"
            :uploads-loading="uploadRecordsLoading"
            :uploads-error="uploadRecordsError"
            :deleting-ids="uploadDeletingIds"
            @select-file="handleUploadSelectFile"
            @clear-file="handleUploadClearFile"
            @precheck="uploadPrecheck"
            @upload="uploadPerformUpload"
            @refresh-uploads="uploadLoadRecords"
            @delete-upload="uploadHandleDelete"
            @open-plugin="handleUploadOpenPlugin"
          />
        </div>

        <div v-else-if="activeNav === 'notifications'" class="panel-view scrollable-panel">
          <NotificationPanel
            :items="notificationTree"
            :loading="notificationState.loading"
            :error="notificationState.error"
            :filter="notificationState.filter"
            :page="notificationState.page"
            :page-size="notificationState.pageSize"
            :total="notificationState.total"
            :unread-total="unreadNotificationTotal"
            :selected-id="notificationState.selectedId"
            :selected-item="notificationState.selectedItem"
            :reading-ids="readingNotificationIds"
            :marking-all-read="notificationState.markingAllRead"
            :current-user="currentUser"
            @change-filter="handleNotificationFilterChange"
            @change-page="handleNotificationPageChange"
            @open-item="openNotification"
            @close-detail="closeNotificationDetail"
            @mark-all-read="handleMarkAllNotificationsRead"
            @go-login="handleGoToNotificationLogin"
            @refresh="handleRefreshNotifications"
          />
        </div>

        <div v-else-if="activeNav === 'settings'" class="panel-view scrollable-panel">
          <ApiSettingsPanel
            :base-url="shopApiBaseUrl"
            @save="handleSaveBaseUrl"
          />
        </div>

        <Transition name="slide">
          <div
            v-if="selectedCategory"
            class="category-panel-container"
            :class="{ 'shifted-left': !!selectedPlugin }"
          >
            <CategoryDetail
              :category="selectedCategory"
              :layout="getCategoryLayout(selectedCategory.key)"
              :installing-plugin-name="marketBusyPluginName"
              :plugin-map="pluginMap"
              :can-upgrade="canUpgrade"
              :can-install-from-market="canInstallFromMarket"
              @back="closeCategory"
              @click-plugin="openPlugin"
              @open-plugin="handleOpenPlugin"
              @download-plugin="handleInstall"
              @upgrade-plugin="handleUpgrade"
            />
          </div>
        </Transition>

        <Transition name="slide">
          <PluginDetail
            v-if="mergedSelectedPlugin"
            :plugin="mergedSelectedPlugin"
            :busy-action="selectedPluginBusyAction"
            :share-disabled="isShareUnavailableForPlugin(mergedSelectedPlugin.name)"
            :share-title="getShareTitleForPlugin(mergedSelectedPlugin.name)"
            :is-running="!!mergedSelectedPlugin.isRunning"
            :is-logged-in="!!currentUser"
            :is-internal="isInternalPlugin(mergedSelectedPlugin.name)"
            :can-install-from-market="canInstallFromMarket"
            :avg-rating="pluginDetailState.detail?.avgRating"
            :rating-count="pluginDetailState.detail?.ratingCount"
            :current-user-rating="pluginDetailState.currentUserRating?.score"
            :comments="pluginCommentTree"
            :comments-loading="pluginDetailState.commentLoading"
            :comments-loading-more="pluginDetailState.commentLoadingMore"
            :comments-error="pluginDetailState.commentError"
            :has-more-comments="hasMorePluginComments"
            :rating-submitting="pluginDetailState.ratingSubmitting"
            :comment-submitting="pluginDetailState.commentSubmitting"
            :current-user-avatar-url="currentUserAvatarUrl"
            :comment-submit-success-key="pluginCommentSubmitSuccessKey"
            :version-options="pluginVersionOptions"
            :hash-options="selectedVersionHashOptions"
            :selected-version="pluginDetailState.selectedVersion"
            :selected-hash="pluginDetailState.selectedHash"
            :selected-build="selectedPluginBuild"
            :install-action-text="selectedPluginActionText"
            @back="closePlugin"
            @open="handleOpenPlugin(mergedSelectedPlugin)"
            @download="handleInstall(mergedSelectedPlugin)"
            @install-latest="handleInstallLatest(mergedSelectedPlugin)"
            @upgrade="handleUpgrade(mergedSelectedPlugin)"
            @uninstall="handleUninstall(mergedSelectedPlugin)"
            @share="handleSharePlugin(mergedSelectedPlugin)"
            @open-folder="handleOpenFolder(mergedSelectedPlugin)"
            @reload="handleReloadPlugin(mergedSelectedPlugin)"
            @submit-rating="handleSubmitPluginRating"
            @submit-comment="handleSubmitPluginComment"
            @load-more-comments="handleLoadMorePluginComments"
            @select-version="selectPluginDetailVersion"
            @select-hash="selectPluginDetailHash"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-market {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg-color);
}

.side-nav {
  width: 220px;
  min-width: 220px;
  height: 100%;
  padding: 18px 14px;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-left: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface-color);
}

.side-nav-header {
  padding: 6px 8px 14px;
}

.side-nav-title {
  color: var(--text-color);
  font-size: 18px;
  font-weight: 700;
}

.side-nav-subtitle {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.side-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 12px;
  border-radius: 12px;
  color: var(--text-secondary);
  text-align: left;
}

.side-nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.side-nav-item.active {
  background: var(--primary-color);
  color: var(--text-on-primary);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--primary-color) 24%, transparent);
}

.side-nav-item-label {
  font-size: 14px;
  font-weight: 700;
}

.side-nav-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  max-width: 120px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 16%, transparent);
  font-size: 11px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-nav-footer {
  margin-top: auto;
  padding: 12px 8px 4px;
}

.side-nav-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.side-nav-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--surface-elevated);
}

.side-nav-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 16px;
  font-weight: 700;
}

.side-nav-user-copy {
  min-width: 0;
}

.side-nav-user-name,
.side-nav-user-account,
.side-nav-guest {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-nav-user-name {
  color: var(--text-color);
  font-size: 13px;
  font-weight: 700;
}

.side-nav-user-account,
.side-nav-guest {
  color: var(--text-secondary);
  font-size: 11px;
}

.content-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.content-body {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scrollable-content,
.scrollable-panel {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  background: var(--bg-color);
}

.panel-view {
  position: absolute;
  inset: 0;
}

.account-scroll {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  margin-bottom: 20px;
}

.content-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
}

.content-title {
  margin: 0;
  color: var(--text-color);
  font-size: 22px;
}

.content-description {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.retry-btn {
  flex-shrink: 0;
}

/* 列表滑动动画 - 已禁用 */
.list-slide-enter-active,
.list-slide-leave-active {
  transition: none !important;
}

.list-slide-enter-from,
.list-slide-enter-to,
.list-slide-leave-from,
.list-slide-leave-to {
  transform: translateX(0) !important;
  opacity: 1 !important;
}

.slide-enter-active {
  transition:
    transform 0.2s ease-out,
    opacity 0.15s ease;
}

.slide-leave-active {
  transition:
    transform 0.2s ease-in,
    opacity 0.15s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.storefront {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.storefront-banner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.banner-item {
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.banner-item.clickable {
  cursor: pointer;
}

.banner-item.clickable:hover {
  opacity: 0.92;
}

.banner-image {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 12px;
  object-fit: cover;
}

.storefront-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.category-panel-container {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--bg-color);
  transition: transform 0.2s ease-out;
}

.category-panel-container.shifted-left {
  transform: translateX(-100%);
}

.navigation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.installed-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 240px;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--divider-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-state span {
  font-size: 13px;
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 240px;
  gap: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.empty-state svg {
  opacity: 0.4;
}

.empty-state span {
  font-size: 13px;
}

.retry-btn {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-on-primary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .side-nav {
    width: 200px;
    min-width: 200px;
    padding: 16px 12px;
  }

  .content-hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
