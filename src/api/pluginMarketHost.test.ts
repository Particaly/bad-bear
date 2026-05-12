import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRunningPlugins,
  reloadInstalledPlugin,
  stopInstalledPlugin,
} from './pluginMarketHost'

describe('pluginMarketHost', () => {
  beforeEach(() => {
    ;(window as any).ztools = {
      internal: {
        getAllPlugins: vi.fn(),
        fetchPluginMarket: vi.fn(),
        getPlugins: vi.fn(),
        installPluginFromMarket: vi.fn(),
        deletePlugin: vi.fn(),
        getPluginReadme: vi.fn(),
      },
      showTip: vi.fn(),
      showToast: vi.fn(),
      shellOpenExternal: vi.fn(),
      getPath: vi.fn(),
      onPluginEnter: vi.fn(),
      onPluginOut: vi.fn(),
    }
  })

  it('returns empty running list when host does not expose getRunningPlugins', async () => {
    await expect(getRunningPlugins()).resolves.toEqual([])
  })

  it('calls reloadPlugin with the plugin path', async () => {
    const reloadPlugin = vi.fn(async () => ({ success: true }))
    window.ztools.internal.reloadPlugin = reloadPlugin

    await expect(reloadInstalledPlugin('C:/plugins/demo')).resolves.toEqual({ success: true })
    expect(reloadPlugin).toHaveBeenCalledWith('C:/plugins/demo')
  })

  it('throws when reloadPlugin is unavailable', async () => {
    await expect(reloadInstalledPlugin('C:/plugins/demo')).rejects.toThrow('当前宿主未暴露 reloadPlugin 能力')
  })

  it('calls killPlugin with the plugin path', async () => {
    const killPlugin = vi.fn(async () => ({ success: true }))
    window.ztools.internal.killPlugin = killPlugin

    await expect(stopInstalledPlugin('C:/plugins/demo')).resolves.toEqual({ success: true })
    expect(killPlugin).toHaveBeenCalledWith('C:/plugins/demo')
  })

  it('throws when killPlugin is unavailable', async () => {
    await expect(stopInstalledPlugin('C:/plugins/demo')).rejects.toThrow('当前宿主未暴露 killPlugin 能力')
  })
})

