import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleInstall, handleUpgrade } from './market-actions'
import { createEmptyPluginDetailState, type InstalledBusyAction, type MarketBusyAction, type PluginDetailState } from '../shared'
import type { PluginMarketUiPlugin } from '../../../../types/pluginMarket'

const HASH_A = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HASH_B = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const {
  deleteInstalledPluginMock,
  installMarketPluginMock,
  upsertMarketInstalledPluginHashMock,
} = vi.hoisted(() => ({
  deleteInstalledPluginMock: vi.fn(),
  installMarketPluginMock: vi.fn(),
  upsertMarketInstalledPluginHashMock: vi.fn(),
}))

vi.mock('../../../../api/pluginMarket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../api/pluginMarket')>()),
  deleteInstalledPlugin: deleteInstalledPluginMock,
  installMarketPlugin: installMarketPluginMock,
  upsertMarketInstalledPluginHash: upsertMarketInstalledPluginHashMock,
}))

function createPlugin(overrides: Partial<PluginMarketUiPlugin> = {}): PluginMarketUiPlugin {
  return {
    name: 'demo-plugin',
    version: '1.0.0',
    title: 'Demo Plugin',
    description: 'desc',
    installed: false,
    categories: [],
    hash: HASH_A,
    ...overrides,
  }
}

function createParams(overrides: Partial<{
  canInstallFromMarket: boolean
  selectedPluginName: string | null
  pluginDetailState: PluginDetailState
}> = {}) {
  return {
    canInstallFromMarket: overrides.canInstallFromMarket ?? true,
    selectedPluginName: overrides.selectedPluginName ?? null,
    pluginDetailState: overrides.pluginDetailState ?? createEmptyPluginDetailState(),
    currentPluginDownloadTarget: computed(() => null),
    marketBusyPluginName: ref<string | null>(null),
    marketBusyAction: ref<MarketBusyAction>(null),
    installedBusyPluginName: ref<string | null>(null),
    installedBusyAction: ref<InstalledBusyAction>(null),
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    reloadMarket: vi.fn(async () => {}),
    openPluginByName: vi.fn(),
    confirmAction: vi.fn(async () => true),
  }
}

describe('market plugin actions', () => {
  beforeEach(() => {
    deleteInstalledPluginMock.mockReset()
    installMarketPluginMock.mockReset()
    upsertMarketInstalledPluginHashMock.mockReset()
  })

  it('records the store hash after a successful install', async () => {
    installMarketPluginMock.mockResolvedValueOnce({ success: true })
    const params = createParams()

    await handleInstall(createPlugin(), params)

    expect(installMarketPluginMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'demo-plugin',
      hash: HASH_A,
    }))
    expect(upsertMarketInstalledPluginHashMock).toHaveBeenCalledWith('demo-plugin', HASH_A)
    expect(params.reloadMarket).toHaveBeenCalledTimes(1)
    expect(params.openPluginByName).toHaveBeenCalledWith('demo-plugin')
    expect(params.notifyError).not.toHaveBeenCalled()
  })

  it('does not record a hash when install fails', async () => {
    installMarketPluginMock.mockResolvedValueOnce({ success: false, error: 'boom' })
    const params = createParams()

    await handleInstall(createPlugin(), params)

    expect(upsertMarketInstalledPluginHashMock).not.toHaveBeenCalled()
    expect(params.notifyError).toHaveBeenCalledWith('boom')
    expect(params.reloadMarket).not.toHaveBeenCalled()
  })

  it('records the latest update hash after a successful upgrade', async () => {
    deleteInstalledPluginMock.mockResolvedValueOnce({ success: true })
    installMarketPluginMock.mockResolvedValueOnce({ success: true })
    const params = createParams()
    const plugin = createPlugin({
      installed: true,
      path: 'C:/plugins/demo-plugin',
      localVersion: '1.0.0',
      latestHash: HASH_B,
      hasUpdate: true,
    })

    await handleUpgrade(plugin, params)

    expect(deleteInstalledPluginMock).toHaveBeenCalledWith('C:/plugins/demo-plugin')
    expect(installMarketPluginMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'demo-plugin',
      hash: HASH_B,
    }))
    expect(upsertMarketInstalledPluginHashMock).toHaveBeenCalledWith('demo-plugin', HASH_B)
    expect(params.reloadMarket).toHaveBeenCalledTimes(1)
    expect(params.openPluginByName).toHaveBeenCalledWith('demo-plugin')
    expect(params.notifyError).not.toHaveBeenCalled()
  })

  it('does not overwrite the registry when upgrade install fails', async () => {
    deleteInstalledPluginMock.mockResolvedValueOnce({ success: true })
    installMarketPluginMock.mockResolvedValueOnce({ success: false, error: 'install failed' })
    const params = createParams()
    const plugin = createPlugin({
      installed: true,
      path: 'C:/plugins/demo-plugin',
      localVersion: '1.0.0',
      latestHash: HASH_B,
      hasUpdate: true,
    })

    await handleUpgrade(plugin, params)

    expect(upsertMarketInstalledPluginHashMock).not.toHaveBeenCalled()
    expect(params.notifyError).toHaveBeenCalledWith('install failed')
    expect(params.reloadMarket).toHaveBeenCalledTimes(1)
  })
})
