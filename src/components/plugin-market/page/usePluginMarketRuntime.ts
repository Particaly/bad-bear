import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import {
  getCurrentUser,
  getGithubBindingStatus,
  login,
  pollGithubDeviceBind,
  pollGithubDeviceLogin,
  register,
  startGithubDeviceBind,
  startGithubDeviceLogin,
  updateMyUsername,
  uploadMyAvatar,
} from '../../../api/auth'
import { HttpClientError } from '../../../api/httpClient'
import {
  buildShopApiAssetUrl,
  clearShopApiAuth,
  loadShopApiRuntimeConfig,
  normalizeShopApiBaseUrl,
  saveShopApiRuntimeConfig,
  subscribeShopApiRuntimeConfig,
} from '../../../config/runtimeConfig'
import type {
  AuthUser,
  GitHubBindingState,
  GitHubBindingStatus,
  GitHubDeviceFlowState,
  GitHubDeviceStartResponse,
  LoginRequest,
  RegisterRequest,
  UpdateUsernameRequest,
} from '../../../types/auth'
import type { ShopApiRuntimeConfig } from '../../../types/runtimeConfig'
import type { ActiveNav } from './shared'
import {
  getErrorMessage,
  validateAvatarFile,
  validateLoginPayload,
  validateRegisterPayload,
  validateUsername,
} from './shared'

function createEmptyGithubBindingState(): GitHubBindingState {
  return {
    loading: false,
    loaded: false,
    supported: true,
    bound: false,
    provider: null,
    login: null,
    errorMessage: '',
  }
}

function createEmptyGithubDeviceFlowState(): GitHubDeviceFlowState {
  return {
    purpose: null,
    phase: 'idle',
    deviceSessionId: '',
    userCode: '',
    verificationUri: '',
    verificationUriComplete: '',
    expiresAt: '',
    interval: 5,
    retryAfterSeconds: 5,
    errorMessage: '',
  }
}

function toGithubBindingState(binding: GitHubBindingStatus): GitHubBindingState {
  return {
    loading: false,
    loaded: true,
    supported: true,
    bound: !!binding.bound,
    provider: binding.provider || null,
    login: binding.login || null,
    errorMessage: '',
  }
}

function isExpiredAt(expiresAt: string): boolean {
  const expiresTime = new Date(expiresAt).getTime()
  return Number.isFinite(expiresTime) && Date.now() >= expiresTime
}

export function usePluginMarketRuntime(options: {
  activeNav: Ref<ActiveNav>
  selectedPluginName: Ref<string | null>
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
  onAuthChanged: () => Promise<void>
  onReloadMarket: () => Promise<void>
  onReloadSelectedPluginDetail: () => Promise<void>
}) {
  const shopApiBaseUrl = ref('http://localhost:3000')
  const authToken = ref('')
  const currentUser = ref<AuthUser | null>(null)
  const runtimeConfigLoaded = ref(false)
  const isRestoringSession = ref(false)
  const isLoggingIn = ref(false)
  const isRegistering = ref(false)
  const isUpdatingUsername = ref(false)
  const isUploadingAvatar = ref(false)
  const githubBinding = ref<GitHubBindingState>(createEmptyGithubBindingState())
  const githubDeviceFlow = ref<GitHubDeviceFlowState>(createEmptyGithubDeviceFlowState())
  const isGithubDeviceFlowBusy = computed(
    () => githubDeviceFlow.value.phase === 'starting' || githubDeviceFlow.value.phase === 'polling',
  )
  const currentUserAvatarUrl = computed(() =>
    buildShopApiAssetUrl(currentUser.value?.avatarUrl, shopApiBaseUrl.value),
  )

  let unsubscribeRuntimeConfig: (() => void) | null = null
  let githubDeviceFlowTimer: number | null = null
  let githubDeviceFlowPolling = false

  function clearGithubDeviceFlowTimer(): void {
    if (githubDeviceFlowTimer !== null) {
      window.clearTimeout(githubDeviceFlowTimer)
      githubDeviceFlowTimer = null
    }
  }

  function resetGithubBindingState(): void {
    githubBinding.value = createEmptyGithubBindingState()
  }

  function resetGithubDeviceFlowState(): void {
    clearGithubDeviceFlowTimer()
    githubDeviceFlowPolling = false
    githubDeviceFlow.value = createEmptyGithubDeviceFlowState()
  }

  function setGithubDeviceFlowError(message: string): void {
    clearGithubDeviceFlowTimer()
    githubDeviceFlowPolling = false
    githubDeviceFlow.value = {
      ...githubDeviceFlow.value,
      phase: 'error',
      errorMessage: message,
    }
  }

  function setGithubDeviceFlowExpired(): void {
    clearGithubDeviceFlowTimer()
    githubDeviceFlowPolling = false
    githubDeviceFlow.value = {
      ...githubDeviceFlow.value,
      phase: 'expired',
      errorMessage: 'GitHub 授权已过期，请重新发起',
    }
  }

  function getGithubVerificationUrl(): string {
    return githubDeviceFlow.value.verificationUriComplete || githubDeviceFlow.value.verificationUri
  }

  function openGithubVerificationPage(params: { notifyOnUnsupported?: boolean } = {}): void {
    const verificationUrl = getGithubVerificationUrl()
    if (!verificationUrl) {
      options.notifyError('未获取到 GitHub 授权地址')
      return
    }

    if (typeof window.ztools?.shellOpenExternal === 'function') {
      window.ztools.shellOpenExternal(verificationUrl)
      return
    }

    if (params.notifyOnUnsupported) {
      options.notifyError('当前环境不支持自动打开浏览器，请手动访问下方授权地址')
    }
  }

  function applyGithubDeviceFlowStart(
    purpose: 'login' | 'bind',
    response: GitHubDeviceStartResponse,
  ): void {
    githubDeviceFlow.value = {
      purpose,
      phase: 'polling',
      deviceSessionId: response.deviceSessionId,
      userCode: response.userCode,
      verificationUri: response.verificationUri,
      verificationUriComplete: response.verificationUriComplete || response.verificationUri,
      expiresAt: response.expiresAt,
      interval: response.interval,
      retryAfterSeconds: response.interval,
      errorMessage: '',
    }
  }

  function scheduleGithubDeviceFlowPoll(delaySeconds: number): void {
    clearGithubDeviceFlowTimer()

    if (
      githubDeviceFlow.value.phase !== 'polling' ||
      !githubDeviceFlow.value.deviceSessionId ||
      !githubDeviceFlow.value.purpose
    ) {
      return
    }

    githubDeviceFlowTimer = window.setTimeout(() => {
      void pollActiveGithubDeviceFlow()
    }, Math.max(1, delaySeconds) * 1000)
  }

  async function refreshGithubBindingStatus(params: { silent?: boolean } = {}): Promise<void> {
    if (!authToken.value || !currentUser.value) {
      resetGithubBindingState()
      return
    }

    githubBinding.value = {
      ...githubBinding.value,
      loading: true,
      errorMessage: '',
    }

    try {
      const binding = await getGithubBindingStatus()
      githubBinding.value = toGithubBindingState(binding)
    } catch (error) {
      const message = getErrorMessage(error, '获取 GitHub 绑定状态失败')
      if (error instanceof HttpClientError && (error.status === 403 || error.status === 404)) {
        githubBinding.value = {
          loading: false,
          loaded: true,
          supported: false,
          bound: false,
          provider: null,
          login: null,
          errorMessage: message,
        }
        if (!params.silent) {
          options.notifyError(message)
        }
        return
      }

      githubBinding.value = {
        ...githubBinding.value,
        loading: false,
        loaded: true,
        supported: true,
        bound: false,
        provider: null,
        login: null,
        errorMessage: message,
      }

      if (!params.silent) {
        options.notifyError(message)
      }
    }
  }

  async function pollActiveGithubDeviceFlow(): Promise<void> {
    if (githubDeviceFlowPolling) {
      return
    }

    const deviceFlowState = githubDeviceFlow.value
    if (
      deviceFlowState.phase !== 'polling' ||
      !deviceFlowState.deviceSessionId ||
      !deviceFlowState.purpose
    ) {
      return
    }

    if (isExpiredAt(deviceFlowState.expiresAt)) {
      setGithubDeviceFlowExpired()
      return
    }

    githubDeviceFlowPolling = true

    try {
      if (deviceFlowState.purpose === 'login') {
        const response = await pollGithubDeviceLogin({
          deviceSessionId: deviceFlowState.deviceSessionId,
        })

        if (response.status === 'pending') {
          githubDeviceFlow.value = {
            ...githubDeviceFlow.value,
            phase: 'polling',
            retryAfterSeconds: response.retryAfterSeconds,
            expiresAt: response.expiresAt,
            errorMessage: '',
          }

          if (isExpiredAt(response.expiresAt)) {
            setGithubDeviceFlowExpired()
            return
          }

          scheduleGithubDeviceFlowPoll(response.retryAfterSeconds)
          return
        }

        saveShopApiRuntimeConfig({
          token: response.token,
          currentUser: response.user,
        })
        await refreshGithubBindingStatus({ silent: true })
        resetGithubDeviceFlowState()
        options.notifySuccess(`GitHub 登录成功，欢迎 ${response.user.username}`)
        return
      }

      const response = await pollGithubDeviceBind({
        deviceSessionId: deviceFlowState.deviceSessionId,
      })

      if (response.status === 'pending') {
        githubDeviceFlow.value = {
          ...githubDeviceFlow.value,
          phase: 'polling',
          retryAfterSeconds: response.retryAfterSeconds,
          expiresAt: response.expiresAt,
          errorMessage: '',
        }

        if (isExpiredAt(response.expiresAt)) {
          setGithubDeviceFlowExpired()
          return
        }

        scheduleGithubDeviceFlowPoll(response.retryAfterSeconds)
        return
      }

      githubBinding.value = toGithubBindingState(response.binding)
      resetGithubDeviceFlowState()
      options.notifySuccess('GitHub 已绑定')
    } catch (error) {
      setGithubDeviceFlowError(
        getErrorMessage(
          error,
          deviceFlowState.purpose === 'login' ? 'GitHub 登录失败' : 'GitHub 绑定失败',
        ),
      )
    } finally {
      githubDeviceFlowPolling = false
    }
  }

  function applyRuntimeConfigState(config: ShopApiRuntimeConfig): void {
    const previousToken = authToken.value
    const previousUserId = currentUser.value?.id || null

    shopApiBaseUrl.value = config.baseUrl
    authToken.value = config.token
    currentUser.value = config.currentUser ? { ...config.currentUser } : null

    const nextUserId = currentUser.value?.id || null
    const authChanged = previousToken !== authToken.value || previousUserId !== nextUserId

    if (!authToken.value || !currentUser.value) {
      resetGithubBindingState()
      resetGithubDeviceFlowState()
    } else if (authChanged) {
      void refreshGithubBindingStatus({ silent: true })
    }

    if (authChanged) {
      void options.onAuthChanged()
    }
  }

  async function refreshCurrentUser(params: { silent?: boolean } = {}): Promise<void> {
    if (!authToken.value) {
      return
    }

    try {
      const response = await getCurrentUser()
      saveShopApiRuntimeConfig({ currentUser: response.user })
      await refreshGithubBindingStatus({ silent: true })
    } catch (error) {
      if (!params.silent) {
        options.notifyError(getErrorMessage(error, '获取当前用户失败'))
      }
    }
  }

  function requireShopLogin(actionLabel: string): boolean {
    if (authToken.value && currentUser.value) {
      return true
    }

    options.activeNav.value = 'account'
    options.notifyError(`请先登录后再${actionLabel}`)
    return false
  }

  async function ensureGithubBound(actionLabel: string): Promise<boolean> {
    if (!authToken.value || !currentUser.value) {
      return false
    }

    if (githubBinding.value.loading || !githubBinding.value.loaded) {
      await refreshGithubBindingStatus({ silent: true })
    }

    if (githubBinding.value.bound) {
      return true
    }

    options.activeNav.value = 'account'

    if (!githubBinding.value.supported && githubBinding.value.errorMessage) {
      options.notifyError(githubBinding.value.errorMessage)
      return false
    }

    if (githubBinding.value.errorMessage) {
      options.notifyError(githubBinding.value.errorMessage)
      return false
    }

    options.notifyError(`请先绑定 GitHub 后再${actionLabel}`)
    return false
  }

  function handleLogin(payload: LoginRequest): Promise<void> {
    try {
      validateLoginPayload(payload)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '登录参数不合法'))
      return Promise.resolve()
    }

    isLoggingIn.value = true

    return login(payload)
      .then((response) => {
        saveShopApiRuntimeConfig({
          token: response.token,
          currentUser: response.user,
        })
        options.notifySuccess(`欢迎回来，${response.user.username}`)
      })
      .catch((error) => {
        options.notifyError(getErrorMessage(error, '登录失败'))
      })
      .finally(() => {
        isLoggingIn.value = false
      })
  }

  async function handleRegister(payload: RegisterRequest): Promise<void> {
    try {
      validateRegisterPayload(payload)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '注册参数不合法'))
      return
    }

    isRegistering.value = true

    try {
      const response = await register(payload)
      saveShopApiRuntimeConfig({
        token: response.token,
        currentUser: response.user,
      })
      options.notifySuccess(`注册成功，欢迎 ${response.user.username}`)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '注册失败'))
    } finally {
      isRegistering.value = false
    }
  }

  async function startGithubDeviceFlow(purpose: 'login' | 'bind'): Promise<void> {
    if (githubDeviceFlow.value.phase === 'starting' || githubDeviceFlow.value.phase === 'polling') {
      return
    }

    githubDeviceFlow.value = {
      ...createEmptyGithubDeviceFlowState(),
      purpose,
      phase: 'starting',
    }

    try {
      const response =
        purpose === 'login' ? await startGithubDeviceLogin() : await startGithubDeviceBind()
      applyGithubDeviceFlowStart(purpose, response)
      openGithubVerificationPage()
      scheduleGithubDeviceFlowPoll(response.interval)
    } catch (error) {
      const message = getErrorMessage(
        error,
        purpose === 'login' ? '发起 GitHub 登录失败' : '发起 GitHub 绑定失败',
      )

      if (purpose === 'bind' && error instanceof HttpClientError && (error.status === 403 || error.status === 404)) {
        githubBinding.value = {
          loading: false,
          loaded: true,
          supported: false,
          bound: false,
          provider: null,
          login: null,
          errorMessage: message,
        }
      }

      setGithubDeviceFlowError(message)
      options.notifyError(message)
    }
  }

  async function handleGithubLogin(): Promise<void> {
    await startGithubDeviceFlow('login')
  }

  async function handleGithubBind(): Promise<void> {
    if (!requireShopLogin('绑定 GitHub')) {
      return
    }

    await startGithubDeviceFlow('bind')
  }

  function handleCancelGithubDeviceFlow(): void {
    resetGithubDeviceFlowState()
  }

  function handleOpenGithubVerificationPage(): void {
    openGithubVerificationPage({ notifyOnUnsupported: true })
  }

  function handleLogout(): void {
    resetGithubBindingState()
    resetGithubDeviceFlowState()
    clearShopApiAuth()
    options.notifySuccess('已退出登录')
  }

  async function handleUpdateUsername(payload: UpdateUsernameRequest): Promise<void> {
    try {
      validateUsername(payload.username)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '用户名不合法'))
      return
    }

    isUpdatingUsername.value = true

    try {
      const response = await updateMyUsername({ username: payload.username.trim() })
      saveShopApiRuntimeConfig({ currentUser: response.user })
      options.notifySuccess('用户名已更新')
    } catch (error) {
      options.notifyError(getErrorMessage(error, '修改用户名失败'))
    } finally {
      isUpdatingUsername.value = false
    }
  }

  async function handleUploadAvatar(file: File): Promise<void> {
    try {
      validateAvatarFile(file)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '头像文件不合法'))
      return
    }

    isUploadingAvatar.value = true

    try {
      const response = await uploadMyAvatar(file)
      saveShopApiRuntimeConfig({ currentUser: response.user })
      options.notifySuccess('头像已更新')
    } catch (error) {
      options.notifyError(getErrorMessage(error, '上传头像失败'))
    } finally {
      isUploadingAvatar.value = false
    }
  }

  async function handleSaveBaseUrl(baseUrl: string): Promise<void> {
    try {
      const normalizedBaseUrl = normalizeShopApiBaseUrl(baseUrl)
      saveShopApiRuntimeConfig({ baseUrl: normalizedBaseUrl })
      await options.onReloadMarket()

      if (options.selectedPluginName.value) {
        await options.onReloadSelectedPluginDetail()
      }

      options.notifySuccess(`已保存 API 地址：${normalizedBaseUrl}`)
    } catch (error) {
      options.notifyError(getErrorMessage(error, '保存 API 地址失败'))
    }
  }

  onMounted(() => {
    unsubscribeRuntimeConfig = subscribeShopApiRuntimeConfig(applyRuntimeConfigState)
    const runtimeConfig = loadShopApiRuntimeConfig()
    runtimeConfigLoaded.value = true

    if (runtimeConfig.token) {
      isRestoringSession.value = true
      void refreshCurrentUser({ silent: true }).finally(() => {
        isRestoringSession.value = false
      })
    }
  })

  onUnmounted(() => {
    resetGithubDeviceFlowState()
    unsubscribeRuntimeConfig?.()
  })

  return {
    shopApiBaseUrl,
    authToken,
    currentUser,
    runtimeConfigLoaded,
    isRestoringSession,
    isLoggingIn,
    isRegistering,
    isUpdatingUsername,
    isUploadingAvatar,
    githubBinding,
    githubDeviceFlow,
    isGithubDeviceFlowBusy,
    currentUserAvatarUrl,
    refreshCurrentUser,
    refreshGithubBindingStatus,
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
    handleUploadAvatar,
    handleSaveBaseUrl,
  }
}
