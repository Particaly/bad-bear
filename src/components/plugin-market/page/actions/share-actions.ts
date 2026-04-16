// 分享操作：检查权限、打包、上传插件到市场

import type { Ref } from 'vue'
import {
  packageInstalledPlugin,
  readFileAsBlob,
  removeTempPluginPackage,
  uploadPluginPackage,
} from '../../../../api/pluginMarket'
import type { InstalledBusyAction } from '../shared'
import type { PluginMarketUiPlugin } from '../../../../types/pluginMarket'
import { getErrorMessage } from '../shared'

/**
 * 检查插件的分享操作是否被禁用
 * 内置插件始终不可分享
 */
export function isShareDisabledForPlugin(
  pluginName: string,
  params: {
    isInternalPlugin?: (name: string) => boolean
    isInternal?: boolean
    isShareInProgress: boolean
    installedBusyPluginName: Ref<string | null>
  },
): boolean {
  // 内置插件不可分享
  if (params.isInternalPlugin && params.isInternalPlugin(pluginName)) {
    return true
  }

  if (params.isInternal) {
    return true
  }

  // 正在分享其他插件时禁用
  return params.isShareInProgress && params.installedBusyPluginName.value !== pluginName
}

/**
 * 根据各种状态获取插件的分享按钮标题
 */
export function getShareTitleForPlugin(params: {
  pluginName: string
  isInternalPlugin?: (name: string) => boolean
  isInternal?: boolean
  isShareInProgress: boolean
  installedBusyPluginName: Ref<string | null>
  isLoggedIn?: boolean
}): string {
  const {
    pluginName,
    isInternalPlugin,
    isInternal,
    isShareInProgress,
    installedBusyPluginName,
    isLoggedIn,
  } = params

  // 内置插件不可分享
  if ((isInternalPlugin && isInternalPlugin(pluginName)) || isInternal) {
    return '内置插件，不可分享'
  }

  // 未登录
  if (isLoggedIn === false) {
    return '请先登录后再分享插件'
  }

  // 正在分享其他插件
  if (
    isShareDisabledForPlugin(pluginName, {
      isInternalPlugin,
      isInternal,
      isShareInProgress,
      installedBusyPluginName,
    })
  ) {
    return '正在分享其他插件，请稍后'
  }

  return '分享插件'
}

/**
 * 处理插件分享操作：打包、上传、清理
 * 需要登录
 */
export async function handleSharePlugin(
  plugin: PluginMarketUiPlugin,
  params: {
    marketBusyPluginName: Ref<string | null>
    installedBusyPluginName: Ref<string | null>
    installedBusyAction: Ref<InstalledBusyAction>
    notifyError: (message: string) => void
    notifySuccess: (message: string) => void
    requireShopLogin: (actionLabel: string) => boolean
    isInternalPlugin: (name: string) => boolean
  },
): Promise<void> {
  // 内置插件不支持分享
  if (params.isInternalPlugin(plugin.name)) {
    params.notifyError('内置插件不支持分享')
    return
  }

  if (!plugin.path) {
    params.notifyError('找不到插件路径，无法分享')
    return
  }

  // 检查登录状态
  if (!params.requireShopLogin('分享插件')) {
    return
  }

  // 检查是否有其他操作正在进行
  if (params.marketBusyPluginName.value || params.installedBusyPluginName.value) {
    return
  }

  params.installedBusyPluginName.value = plugin.name
  params.installedBusyAction.value = 'share'

  let tempPackagePath: string | undefined

  try {
    // 打包插件
    const packageResult = await packageInstalledPlugin(plugin.path)
    if (!packageResult.success) {
      if (packageResult.error === '已取消') {
        return
      }
      throw new Error(packageResult.error || '插件打包失败')
    }

    if (!packageResult.filePath) {
      throw new Error('插件打包未返回文件路径，无法上传')
    }

    tempPackagePath = packageResult.filePath

    // 读取文件并上传
    const file = await readFileAsBlob(tempPackagePath)
    const version = plugin.localVersion || plugin.version || '0.0.0'
    const fileName = `${plugin.name}-${version}.zpx`
    const uploadResult = await uploadPluginPackage({
      file,
      fileName,
    })

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || '插件上传失败')
    }

    params.notifySuccess(uploadResult.message || `已分享 ${plugin.title}`)
  } catch (error) {
    console.error('[PluginMarket] 分享插件失败:', error)
    params.notifyError(getErrorMessage(error, '分享插件失败'))
  } finally {
    // 清理临时插件包文件
    if (tempPackagePath) {
      try {
        await removeTempPluginPackage(tempPackagePath)
      } catch (cleanupError) {
        console.warn('[PluginMarket] 清理临时插件包失败:', cleanupError)
      }
    }

    params.installedBusyPluginName.value = null
    params.installedBusyAction.value = null
  }
}
