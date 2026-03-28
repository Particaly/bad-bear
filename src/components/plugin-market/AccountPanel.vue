<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  UpdateUsernameRequest,
} from '../../types/auth'
import { reloadTheme } from '../../config/theme'

const props = withDefaults(
  defineProps<{
    currentUser: AuthUser | null
    avatarUrl?: string
    isRestoringSession?: boolean
    isLoggingIn?: boolean
    isRegistering?: boolean
    isUpdatingUsername?: boolean
    isUploadingAvatar?: boolean
  }>(),
  {
    avatarUrl: '',
    isRestoringSession: false,
    isLoggingIn: false,
    isRegistering: false,
    isUpdatingUsername: false,
    isUploadingAvatar: false,
  },
)

const emit = defineEmits<{
  (e: 'login', payload: LoginRequest): void
  (e: 'register', payload: RegisterRequest): void
  (e: 'logout'): void
  (e: 'update-username', payload: UpdateUsernameRequest): void
  (e: 'upload-avatar', file: File): void
}>()

type AuthMode = 'login' | 'register'

const authMode = ref<AuthMode>('login')
const loginAccount = ref('')
const loginPassword = ref('')
const registerAccount = ref('')
const registerUsername = ref('')
const registerPassword = ref('')
const usernameDraft = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const isUsernameModalOpen = ref(false)
const isAvatarModalOpen = ref(false)

const busy = computed(
  () =>
    props.isRestoringSession ||
    props.isLoggingIn ||
    props.isRegistering ||
    props.isUpdatingUsername ||
    props.isUploadingAvatar,
)

const joinedAtText = computed(() => {
  if (!props.currentUser?.createdAt) {
    return '-'
  }

  return new Date(props.currentUser.createdAt).toLocaleString('zh-CN', {
    hour12: false,
  })
})

const avatarFallbackText = computed(() => {
  const source = props.currentUser?.username || props.currentUser?.account || 'U'
  return source.slice(0, 1).toUpperCase()
})

watch(
  () => props.currentUser?.username,
  (value) => {
    usernameDraft.value = value || ''
  },
  { immediate: true },
)

watch(
  () => props.isUpdatingUsername,
  (value, previousValue) => {
    if (previousValue && !value) {
      isUsernameModalOpen.value = false
    }
  },
)

watch(
  () => props.isUploadingAvatar,
  (value, previousValue) => {
    if (previousValue && !value) {
      isAvatarModalOpen.value = false
    }
  },
)

watch(
  () => props.currentUser,
  (user) => {
    // Reload theme when user logs in (sync server-side settings)
    if (user) {
      void reloadTheme()
    }
  },
)

function submitLogin(): void {
  emit('login', {
    account: loginAccount.value.trim(),
    password: loginPassword.value,
  })
}

function submitRegister(): void {
  emit('register', {
    account: registerAccount.value.trim(),
    username: registerUsername.value.trim(),
    password: registerPassword.value,
  })
}

function submitUsernameUpdate(): void {
  emit('update-username', {
    username: usernameDraft.value.trim(),
  })
}

function openUsernameModal(): void {
  usernameDraft.value = props.currentUser?.username || ''
  isUsernameModalOpen.value = true
}

function closeUsernameModal(): void {
  isUsernameModalOpen.value = false
}

function triggerAvatarSelect(): void {
  avatarInput.value?.click()
}

function openAvatarModal(): void {
  isAvatarModalOpen.value = true
}

function closeAvatarModal(): void {
  isAvatarModalOpen.value = false
}

function handleAvatarChange(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]

  if (file) {
    emit('upload-avatar', file)
  }

  if (target) {
    target.value = ''
  }
}
</script>

<template>
  <div class="account-panel">
    <div class="card panel-card panel-hero">
      <div class="panel-hero-copy">
        <h2 class="panel-title">账号与资料</h2>
        <p class="panel-description">登录后可修改用户名、上传头像，并分享已安装插件。</p>
      </div>
    </div>

    <template v-if="currentUser">
      <div class="card panel-card profile-card">
        <div class="profile-header">
          <div class="profile-identity-row">
            <button class="profile-avatar-wrap" type="button" :disabled="busy" @click="openAvatarModal">
              <img v-if="avatarUrl" :src="avatarUrl" alt="头像" class="profile-avatar" />
              <div v-else class="profile-avatar profile-avatar--fallback">{{ avatarFallbackText }}</div>
            </button>

            <div class="profile-main">
              <div class="profile-name-row">
                <h3 class="profile-name">{{ currentUser.username }}</h3>
                <span class="profile-badge">已登录</span>
                <button class="link-btn profile-edit-btn" type="button" :disabled="busy" @click="openUsernameModal">
                  编辑
                </button>
              </div>
              <div class="profile-account">账号：{{ currentUser.account }}</div>
              <div class="profile-meta">注册时间：{{ joinedAtText }}</div>
            </div>
          </div>

          <button class="btn btn-md profile-logout-btn" :disabled="busy" @click="emit('logout')">
            退出登录
          </button>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="isUsernameModalOpen" class="dialog-mask" @click.self="closeUsernameModal">
          <div class="dialog-card card">
            <div class="dialog-header">
              <div>
                <h3 class="dialog-title">修改用户名</h3>
                <p class="dialog-description">输入新的显示名称后保存。</p>
              </div>
              <button class="dialog-close" type="button" :disabled="busy" @click="closeUsernameModal">×</button>
            </div>

            <label class="field-label" for="username-modal-input">用户名</label>
            <input
              id="username-modal-input"
              v-model="usernameDraft"
              class="text-input"
              type="text"
              maxlength="50"
              :disabled="busy"
              placeholder="输入新的显示名称"
            />

            <div class="action-row action-row--end">
              <button class="btn btn-md btn-ghost" type="button" :disabled="busy" @click="closeUsernameModal">取消</button>
              <button class="btn btn-md btn-primary" :disabled="busy" @click="submitUsernameUpdate">
                {{ isUpdatingUsername ? '保存中...' : '保存用户名' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div v-if="isAvatarModalOpen" class="dialog-mask" @click.self="closeAvatarModal">
          <div class="dialog-card card">
            <div class="dialog-header">
              <div>
                <h3 class="dialog-title">上传头像</h3>
                <p class="dialog-description">选择 jpeg/png/gif/webp 文件，大小不超过 5MB。</p>
              </div>
              <button class="dialog-close" type="button" :disabled="busy" @click="closeAvatarModal">×</button>
            </div>

            <div class="dialog-avatar-preview">
              <img v-if="avatarUrl" :src="avatarUrl" alt="头像预览" class="profile-avatar" />
              <div v-else class="profile-avatar profile-avatar--fallback">{{ avatarFallbackText }}</div>
            </div>

            <div class="action-row action-row--end">
              <button class="btn btn-md btn-ghost" type="button" :disabled="busy" @click="closeAvatarModal">取消</button>
              <button class="btn btn-md btn-primary" :disabled="busy" @click="triggerAvatarSelect">
                {{ isUploadingAvatar ? '上传中...' : '选择头像文件' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <template v-else>
      <div class="card panel-card auth-card">
        <div class="auth-tabs" :style="{ '--auth-slider-index': authMode === 'login' ? '0' : '1' }">
          <div class="auth-tab-slider" aria-hidden="true"></div>
          <button
            class="auth-tab"
            :class="{ active: authMode === 'login' }"
            :disabled="busy"
            @click="authMode = 'login'"
          >
            登录
          </button>
          <button
            class="auth-tab"
            :class="{ active: authMode === 'register' }"
            :disabled="busy"
            @click="authMode = 'register'"
          >
            注册
          </button>
        </div>

        <div v-if="isRestoringSession" class="auth-status">正在恢复登录状态...</div>

        <template v-if="authMode === 'login'">
          <label class="field-label" for="login-account">账号</label>
          <input
            id="login-account"
            v-model="loginAccount"
            class="text-input"
            type="text"
            maxlength="50"
            :disabled="busy"
            placeholder="输入注册账号"
          />

          <label class="field-label" for="login-password">密码</label>
          <input
            id="login-password"
            v-model="loginPassword"
            class="text-input"
            type="password"
            maxlength="72"
            :disabled="busy"
            placeholder="输入密码"
            @keydown.enter="submitLogin"
          />

          <div class="action-row action-row--end">
            <button class="btn btn-md btn-primary" :disabled="busy" @click="submitLogin">
              {{ isLoggingIn ? '登录中...' : '登录' }}
            </button>
          </div>
        </template>

        <template v-else>
          <label class="field-label" for="register-account">账号</label>
          <input
            id="register-account"
            v-model="registerAccount"
            class="text-input"
            type="text"
            maxlength="50"
            :disabled="busy"
            placeholder="3-50 字符，仅字母/数字/_/-"
          />

          <label class="field-label" for="register-username">用户名</label>
          <input
            id="register-username"
            v-model="registerUsername"
            class="text-input"
            type="text"
            maxlength="50"
            :disabled="busy"
            placeholder="输入显示名称"
          />

          <label class="field-label" for="register-password">密码</label>
          <input
            id="register-password"
            v-model="registerPassword"
            class="text-input"
            type="password"
            maxlength="72"
            :disabled="busy"
            placeholder="8-72 字符"
            @keydown.enter="submitRegister"
          />

          <div class="action-row action-row--end">
            <button class="btn btn-md btn-primary" :disabled="busy" @click="submitRegister">
              {{ isRegistering ? '注册中...' : '注册并登录' }}
            </button>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.account-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  padding: 18px;
}

.panel-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
}

.panel-description {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.profile-card,
.auth-card,
.section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-identity-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar-wrap {
  display: inline-flex;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.profile-avatar-wrap:disabled {
  cursor: not-allowed;
}

.profile-avatar-wrap:focus-visible,
.profile-edit-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color, #3b82f6) 22%, transparent);
  border-radius: 18px;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  background: var(--surface-elevated);
}

.profile-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 28px;
  font-weight: 700;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-name {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--primary-light-bg);
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 700;
}

.profile-edit-btn {
  padding: 0;
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 700;
}

.profile-edit-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.profile-account,
.profile-meta,
.upload-description,
.auth-status {
  color: var(--text-secondary);
  font-size: 13px;
}

.profile-account {
  margin-top: 6px;
}

.profile-meta {
  margin-top: 4px;
}

.profile-logout-btn {
  width: 100%;
  background: var(--danger-light-bg);
  color: var(--danger-color);
}

.profile-logout-btn:hover:not(:disabled) {
  filter: brightness(0.96);
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  color: var(--text-color);
}

.section-tip {
  color: var(--text-secondary);
  font-size: 12px;
}

.auth-tabs {
  position: relative;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(72px, 1fr));
  width: fit-content;
  padding: 4px;
  border-radius: 999px;
  background: var(--surface-elevated);
  isolation: isolate;
}

.auth-tab-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  border-radius: 999px;
  background: var(--primary-color, #3b82f6);
  transform: translateX(calc(var(--auth-slider-index, 0) * 100%));
  transition:
    transform 0.28s ease,
    background-color 0.2s ease;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary-color, #3b82f6) 24%, transparent);
  z-index: 0;
}

.auth-tab {
  position: relative;
  z-index: 1;
  min-width: 72px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  transition: color 0.2s ease;
}

.auth-tab.active {
  color: var(--text-on-primary);
}

.auth-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color, #3b82f6) 22%, transparent);
}

.field-label {
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
}

.text-input {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  background: var(--bg-color);
  color: var(--text-color);
  outline: none;
}

.text-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.file-input {
  display: none;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-row--end {
  justify-content: flex-end;
}

.link-btn {
  background: transparent;
  border: none;
  cursor: pointer;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
}

.dialog-card {
  width: min(420px, 80%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--divider-color);
  border-radius: 16px;
  background: var(--surface-color, var(--card-bg));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-color);
}

.dialog-description {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.dialog-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
}

.dialog-avatar-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

@media (max-width: 900px) {
  .account-grid {
    grid-template-columns: 1fr;
  }

  .profile-identity-row {
    align-items: flex-start;
  }
}
</style>
