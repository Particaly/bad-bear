type ThemePayload = {
  isDark: boolean
  windowMaterial: string
  primaryColor?: string
  customColor?: string
}

function applyTheme(theme: ThemePayload): void {
  document.documentElement.setAttribute('data-material', theme.windowMaterial)
  document.documentElement.classList.toggle('dark', theme.isDark)

  const themeClasses = [
    'theme-blue',
    'theme-purple',
    'theme-green',
    'theme-orange',
    'theme-red',
    'theme-pink',
    'theme-custom',
  ]
  document.body.classList.remove(...themeClasses)

  if (theme.primaryColor) {
    document.body.classList.add(`theme-${theme.primaryColor}`)
  }

  if (theme.customColor) {
    document.documentElement.style.setProperty('--primary-color', theme.customColor)
  }
}

function applyOsClass(platform: string): void {
  document.documentElement.classList.remove('os-mac', 'os-windows', 'os-linux')

  if (platform === 'darwin') {
    document.documentElement.classList.add('os-mac')
  } else if (platform === 'win32') {
    document.documentElement.classList.add('os-windows')
  } else {
    document.documentElement.classList.add('os-linux')
  }
}

export function useTheme() {
  applyTheme(window.services.getThemeInfo())
  window.services.onThemeChange((theme) => applyTheme(theme))
  applyOsClass(window.services.getSystemInfo().platform)
}