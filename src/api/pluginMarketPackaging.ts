import type { PluginPackageResult } from '../types/pluginMarket'

export async function packageInstalledPlugin(pluginPath: string): Promise<PluginPackageResult> {
  const packagePluginToTempZpx = window.services.packagePluginToTempZpx
  if (!packagePluginToTempZpx) {
    throw new Error('当前 preload 未暴露 packagePluginToTempZpx 能力')
  }

  try {
    const filePath = await packagePluginToTempZpx(pluginPath)
    return {
      success: true,
      filePath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '插件打包失败',
    }
  }
}

export async function removeTempPluginPackage(filePath: string): Promise<void> {
  window.services.removeFile(filePath)
}

export async function readFileAsBlob(filePath: string): Promise<Blob> {
  const content = window.services.readBinaryFile(filePath)
  if (!content.byteLength) {
    throw new Error('读取插件包文件失败')
  }

  const normalizedContent = Uint8Array.from(content)
  return new Blob([normalizedContent], { type: 'application/octet-stream' })
}
