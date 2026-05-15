import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { handleOpenPlugin, handleStopPlugin } from './installed-actions'
import type { PluginMarketUiPlugin } from '../../../../types/pluginMarket'
import { useMarketRiskDialog } from '../../../../app/useMarketRiskDialog'

const { stopInstalledPluginMock, openInstalledPluginMock } = vi.hoisted(() => ({
  stopInstalledPluginMock: vi.fn(),
  openInstalledPluginMock: vi.fn(),
}))

vi.mock('../../../../api/pluginMarket', () => ({
  stopInstalledPlugin: stopInstalledPluginMock,
  deleteInstalledPlugin: vi.fn(),
  openInstalledPlugin: openInstalledPluginMock,
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
    openInstalledPluginMock.mockReset()
    window.localStorage.clear()
  })

  it('opens a plugin after the market risk dialog allows it', async () => {
    openInstalledPluginMock.mockResolvedValueOnce({ success: true })
    const notifyError = vi.fn()
    const confirmOpenPluginRisk = vi.fn(async () => true)

    await handleOpenPlugin(createPlugin(), {
      notifyError,
      confirmOpenPluginRisk,
    })

    expect(confirmOpenPluginRisk).toHaveBeenCalledTimes(1)
    expect(openInstalledPluginMock).toHaveBeenCalledTimes(1)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('does not open a plugin when the market risk dialog is dismissed directly', async () => {
    const notifyError = vi.fn()
    const confirmOpenPluginRisk = vi.fn(async () => false)

    await handleOpenPlugin(createPlugin(), {
      notifyError,
      confirmOpenPluginRisk,
    })

    expect(confirmOpenPluginRisk).toHaveBeenCalledTimes(1)
    expect(openInstalledPluginMock).not.toHaveBeenCalled()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('requires all risk checklist items before continuing', async () => {
    const {
      marketRiskDialogState,
      canSubmitMarketRiskDialog,
      confirmOpenPluginRisk,
      updateMarketRiskChecklistItem,
      handleMarketRiskCancel,
    } = useMarketRiskDialog()
    const plugin = createPlugin({
      marketPlugin: { name: 'demo-plugin', version: '1.0.0' } as PluginMarketUiPlugin['marketPlugin'],
    })

    const firstConfirmation = confirmOpenPluginRisk(plugin)

    expect(marketRiskDialogState.value.visible).toBe(true)
    expect(canSubmitMarketRiskDialog.value).toBe(false)

    for (const item of marketRiskDialogState.value.items) {
      updateMarketRiskChecklistItem(item.key, true)
    }

    expect(canSubmitMarketRiskDialog.value).toBe(true)

    handleMarketRiskCancel()

    await expect(firstConfirmation).resolves.toBe(true)
  })

  it('skips repeated risk confirmation in the same session after acknowledging once', async () => {
    const {
      marketRiskDialogState,
      confirmOpenPluginRisk,
      updateMarketRiskChecklistItem,
      handleMarketRiskCancel,
    } = useMarketRiskDialog()
    const plugin = createPlugin({
      marketPlugin: { name: 'demo-plugin', version: '1.0.0' } as PluginMarketUiPlugin['marketPlugin'],
    })
    const firstConfirmation = confirmOpenPluginRisk(plugin)

    for (const item of marketRiskDialogState.value.items) {
      updateMarketRiskChecklistItem(item.key, true)
    }

    handleMarketRiskCancel()

    await expect(firstConfirmation).resolves.toBe(true)
    await expect(confirmOpenPluginRisk(plugin)).resolves.toBe(true)
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

