// 已安装插件操作：打开、卸载、重载、打开文件夹

import type { Ref } from 'vue'
import {
  deleteInstalledPlugin,
  openInstalledPlugin,
  reloadInstalledPlugin,
  revealPluginInFinder,
} from '../../../../api/pluginMarket'
import type { InstalledBusyAction } from '../shared'
import type { PluginMarketUiPlugin } from '../../../../types/pluginMarket'
import { getErrorMessage } from '../shared'

/**
 * 处理打开已安装的插件
 */
export async function handleOpenPlugin(
  plugin: PluginMarketUiPlugin,
  params: {
    notifyError: (message: string) => void
  },
): Promise<void> {
  try {
    const result = await openInstalledPlugin(plugin)
    if (result && result.success === false) {
      throw new Error(result.error || '打开插件失败')
    }
  } catch (error) {
    console.error('[PluginMarket] 打开插件失败:', error)
    params.notifyError(getErrorMessage(error, '打开插件失败'))
  }
}

/**
 * 处理插件卸载（带确认对话框）
 */
export async function handleUninstall(
  plugin: PluginMarketUiPlugin,
  params: {
    marketBusyPluginName: Ref<string | null>
    installedBusyPluginName: Ref<string | null>
    installedBusyAction: Ref<InstalledBusyAction>
    notifyError: (message: string) => void
    notifySuccess: (message: string) => void
    confirmAction: (options: {
      title?: string
      message: string
      type?: 'info' | 'warning' | 'danger'
      confirmText?: string
      cancelText?: string
    }) => Promise<boolean>
    closePlugin: () => void
    reloadMarket: () => Promise<void>
  },
): Promise<void> {
  if (!plugin.path) {
    params.notifyError('找不到插件路径，无法卸载')
    return
  }

  // 检查是否有其他操作正在进行
  if (params.marketBusyPluginName.value || params.installedBusyPluginName.value) {
    return
  }

  // 显示确认对话框
  const confirmed = await params.confirmAction({
    title: '确认卸载',
    message: `确定卸载 ${plugin.title} 吗？`,
    type: 'danger',
    confirmText: '卸载',
    cancelText: '取消',
  })
  if (!confirmed) {
    return
  }

  params.installedBusyPluginName.value = plugin.name
  params.installedBusyAction.value = 'uninstall'

  try {
    const result = await deleteInstalledPlugin(plugin.path)
    if (!result.success) {
      throw new Error(result.error || '卸载失败')
    }

    params.notifySuccess(`已卸载 ${plugin.title}`)
    params.closePlugin()
    await params.reloadMarket()
  } catch (error) {
    console.error('[PluginMarket] 卸载失败:', error)
    params.notifyError(getErrorMessage(error, '卸载失败'))
  } finally {
    params.installedBusyPluginName.value = null
    params.installedBusyAction.value = null
  }
}

/**
 * 处理在 Finder/Explorer 中打开插件文件夹
 */
export async function handleOpenFolder(
  plugin: PluginMarketUiPlugin,
  params: {
    notifyError: (message: string) => void
  },
): Promise<void> {
  if (!plugin.path) {
    params.notifyError('找不到插件路径，无法打开目录')
    return
  }

  try {
    await revealPluginInFinder(plugin.path)
  } catch (error) {
    console.error('[PluginMarket] 打开插件目录失败:', error)
    params.notifyError(getErrorMessage(error, '打开插件目录失败'))
  }
}

/**
 * 处理重载已安装的插件
 */
export async function handleReloadPlugin(
  plugin: PluginMarketUiPlugin,
  params: {
    marketBusyPluginName: Ref<string | null>
    installedBusyPluginName: Ref<string | null>
    installedBusyAction: Ref<InstalledBusyAction>
    notifyError: (message: string) => void
    notifySuccess: (message: string) => void
    reloadMarket: () => Promise<void>
    openPluginByName: (name: string) => void
  },
): Promise<void> {
  if (!plugin.path) {
    params.notifyError('找不到插件路径，无法重载')
    return
  }

  // 检查是否有其他操作正在进行
  if (params.marketBusyPluginName.value || params.installedBusyPluginName.value) {
    return
  }

  params.installedBusyPluginName.value = plugin.name
  params.installedBusyAction.value = 'reload'

  try {
    const result = await reloadInstalledPlugin(plugin.path)
    if (!result.success) {
      throw new Error(result.error || '重载失败')
    }

    params.notifySuccess(`已重载 ${plugin.title}`)
    await params.reloadMarket()
    params.openPluginByName(plugin.name)
  } catch (error) {
    console.error('[PluginMarket] 重载插件失败:', error)
    params.notifyError(getErrorMessage(error, '重载插件失败'))
  } finally {
    params.installedBusyPluginName.value = null
    params.installedBusyAction.value = null
  }
}
