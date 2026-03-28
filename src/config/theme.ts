/**
 * 主题配置和工具函数
 * 从数据库设置中加载并应用主题色
 */

type SettingsGeneral = {
  theme?: 'system' | 'light' | 'dark'
  primaryColor?: string
  customColor?: string
}

export const DEFAULT_PRIMARY_COLOR = '#3b82f6'

export const PRESET_PRIMARY_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  green: '#22c55e',
  emerald: '#10b981',
  orange: '#f97316',
  rose: '#f43f5e',
  red: '#ef4444',
  yellow: '#eab308',
}

function isValidHexColor(value: string | undefined): value is string {
  return !!value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

export function resolvePrimaryThemeColor(
  settings: SettingsGeneral | null | undefined,
): string {
  if (isValidHexColor(settings?.customColor)) {
    return settings.customColor.trim()
  }

  const preset = settings?.primaryColor?.trim().toLowerCase()
  if (preset && PRESET_PRIMARY_COLORS[preset]) {
    return PRESET_PRIMARY_COLORS[preset]
  }

  return DEFAULT_PRIMARY_COLOR
}

/**
 * 将指定颜色应用为主题色
 */
export function applyThemeColor(color: string): void {
  document.documentElement.style.setProperty('--primary-color', color)
}

/**
 * 从数据库加载主题设置并应用主题色
 * 在插件初始化时调用，确保在渲染前应用主题
 */
export async function initializeTheme(): Promise<void> {
  try {
    const settings = (await window.ztools.internal.dbGet?.('settings-general')) as
      | SettingsGeneral
      | null
      | undefined
    const nextPrimaryColor = resolvePrimaryThemeColor(settings)
    applyThemeColor(nextPrimaryColor)
    console.log('[Theme] Primary color initialized:', nextPrimaryColor)
  } catch (error) {
    console.warn('[Theme] Failed to load theme settings, using default:', error)
    applyThemeColor(DEFAULT_PRIMARY_COLOR)
  }
}

/**
 * 重新加载并应用数据库中的主题设置
 * 当设置可能已更新时使用此函数
 */
export async function reloadTheme(): Promise<void> {
  await initializeTheme()
}
