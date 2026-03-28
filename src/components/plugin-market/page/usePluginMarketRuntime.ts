import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import {
  getCurrentUser,
  login,
  register,
  updateMyUsername,
  uploadMyAvatar,
} from '../../../api/auth'
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
  const currentUserAvatarUrl = computed(() =>
    buildShopApiAssetUrl(currentUser.value?.avatarUrl, shopApiBaseUrl.value),
  )

  let unsubscribeRuntimeConfig: (() => void) | null = null

  function applyRuntimeConfigState(config: ShopApiRuntimeConfig): void {
    const previousToken = authToken.value
    const previousUserId = currentUser.value?.id || null

    shopApiBaseUrl.value = config.baseUrl
    authToken.value = config.token
    currentUser.value = config.currentUser ? { ...config.currentUser } : null

    const nextUserId = currentUser.value?.id || null
    if (previousToken !== authToken.value || previousUserId !== nextUserId) {
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

  function handleLogout(): void {
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
    currentUserAvatarUrl,
    refreshCurrentUser,
    requireShopLogin,
    handleLogin,
    handleRegister,
    handleLogout,
    handleUpdateUsername,
    handleUploadAvatar,
    handleSaveBaseUrl,
  }
}
