import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { handleStopPlugin } from './installed-actions'
import type { PluginMarketUiPlugin } from '../../../../types/pluginMarket'

const { stopInstalledPluginMock } = vi.hoisted(() => ({
  stopInstalledPluginMock: vi.fn(),
}))

vi.mock('../../../../api/pluginMarket', () => ({
  stopInstalledPlugin: stopInstalledPluginMock,
  deleteInstalledPlugin: vi.fn(),
  openInstalledPlugin: vi.fn(),
  revealPluginInFinder: vi.fn(),
}))

function createPlugin(overrides: Partial<PluginMarketUiPlugin> = {}): PluginMarketUiPlugin {
  return {
    name: 'demo-plugin',
    title: 'Demo Plugin',
    description: 'desc',
    version: '1.0.0',
    categories: [],
    installed: true,
    path: 'C:/plugins/demo-plugin',
    ...overrides,
  }
}

describe('installed plugin actions', () => {
  beforeEach(() => {
    stopInstalledPluginMock.mockReset()
  })

  it('stops a running plugin and refreshes the market', async () => {
    stopInstalledPluginMock.mockResolvedValueOnce({ success: true })
    const marketBusyPluginName = ref<string | null>(null)
    const installedBusyPluginName = ref<string | null>(null)
    const installedBusyAction = ref<'stop' | 'uninstall' | null>(null)
    const notifyError = vi.fn()
    const notifySuccess = vi.fn()
    const reloadMarket = vi.fn(async () => {})

    await handleStopPlugin(createPlugin(), {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError,
      notifySuccess,
      reloadMarket,
    })

    expect(stopInstalledPluginMock).toHaveBeenCalledWith('C:/plugins/demo-plugin')
    expect(notifySuccess).toHaveBeenCalledWith('已停止 Demo Plugin 运行')
    expect(reloadMarket).toHaveBeenCalled()
    expect(installedBusyPluginName.value).toBeNull()
    expect(installedBusyAction.value).toBeNull()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reports an error when stop fails and clears busy state', async () => {
    stopInstalledPluginMock.mockResolvedValueOnce({ success: false, error: 'boom' })
    const marketBusyPluginName = ref<string | null>(null)
    const installedBusyPluginName = ref<string | null>(null)
    const installedBusyAction = ref<'stop' | 'uninstall' | null>(null)
    const notifyError = vi.fn()
    const notifySuccess = vi.fn()
    const reloadMarket = vi.fn(async () => {})

    await handleStopPlugin(createPlugin(), {
      marketBusyPluginName,
      installedBusyPluginName,
      installedBusyAction,
      notifyError,
      notifySuccess,
      reloadMarket,
    })

    expect(notifyError).toHaveBeenCalledWith('boom')
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(reloadMarket).not.toHaveBeenCalled()
    expect(installedBusyPluginName.value).toBeNull()
    expect(installedBusyAction.value).toBeNull()
  })
})

