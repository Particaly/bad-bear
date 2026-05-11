import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHOP_API_BASE_URL, saveShopApiRuntimeConfig } from '../config/runtimeConfig'
import { fetchPluginMarket, getPluginRisk, getPluginVersionBuilds, getPublicProviderById } from './pluginMarketRemote'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchPluginMarket', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveShopApiRuntimeConfig({
      baseUrl: DEFAULT_SHOP_API_BASE_URL,
      token: '',
      currentUser: null,
    })
  })

  it('reuses cached plugins and categories when latest response is unchanged', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }

      if (url.endsWith('/api/v1/plugins')) {
        return jsonResponse([
          {
            name: 'demo-plugin',
            version: '1.0.0',
            title: 'Demo Plugin',
            categories: ['tools'],
          },
        ])
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([
          {
            key: 'tools',
            title: '工具',
            list: ['demo-plugin'],
          },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const firstResult = await fetchPluginMarket()
    const secondResult = await fetchPluginMarket()

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)
    expect(secondResult.data).toHaveLength(1)
    expect(secondResult.storefront?.categories.tools?.plugins).toEqual([{ name: 'demo-plugin' }])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://badbear.ydys.cc/api/v1/plugins/latest',
      'https://badbear.ydys.cc/api/v1/plugins',
      'https://badbear.ydys.cc/api/v1/plugins/categories',
      'https://badbear.ydys.cc/api/v1/plugins/latest',
    ])
  })

  it('refreshes plugins and categories when latest response changes', async () => {
    let latestAt = '2026-04-11T11:46:20.849Z'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt })
      }

      if (url.endsWith('/api/v1/plugins')) {
        return jsonResponse([
          {
            name: latestAt === '2026-04-11T11:46:20.849Z' ? 'demo-plugin' : 'demo-plugin-2',
            version: latestAt === '2026-04-11T11:46:20.849Z' ? '1.0.0' : '2.0.0',
            title: latestAt === '2026-04-11T11:46:20.849Z' ? 'Demo Plugin' : 'Demo Plugin 2',
            categories: ['tools'],
          },
        ])
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([
          {
            key: 'tools',
            title: '工具',
            list: [latestAt === '2026-04-11T11:46:20.849Z' ? 'demo-plugin' : 'demo-plugin-2'],
          },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    await fetchPluginMarket()
    latestAt = '2026-04-12T11:46:20.849Z'
    const refreshedResult = await fetchPluginMarket()

    expect(refreshedResult.data?.[0]?.name).toBe('demo-plugin-2')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('uses separate caches for different shop api base urls', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === 'https://badbear.ydys.cc/api/v1/plugins/latest') {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }
      if (url === 'https://badbear.ydys.cc/api/v1/plugins') {
        return jsonResponse([{ name: 'default-plugin', version: '1.0.0', categories: ['tools'] }])
      }
      if (url === 'https://badbear.ydys.cc/api/v1/plugins/categories') {
        return jsonResponse([{ key: 'tools', title: '工具', list: ['default-plugin'] }])
      }

      if (url === 'https://shop.example.com/api/v1/plugins/latest') {
        return jsonResponse({ latestAt: '2026-04-12T11:46:20.849Z' })
      }
      if (url === 'https://shop.example.com/api/v1/plugins') {
        return jsonResponse([{ name: 'other-plugin', version: '2.0.0', categories: ['other'] }])
      }
      if (url === 'https://shop.example.com/api/v1/plugins/categories') {
        return jsonResponse([{ key: 'other', title: '其他', list: ['other-plugin'] }])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const defaultResult = await fetchPluginMarket()
    saveShopApiRuntimeConfig({ baseUrl: 'https://shop.example.com' })
    const otherResult = await fetchPluginMarket()
    const repeatedOtherResult = await fetchPluginMarket()

    expect(defaultResult.data?.[0]?.name).toBe('default-plugin')
    expect(otherResult.data?.[0]?.name).toBe('other-plugin')
    expect(repeatedOtherResult.data?.[0]?.name).toBe('other-plugin')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://badbear.ydys.cc/api/v1/plugins/latest',
      'https://badbear.ydys.cc/api/v1/plugins',
      'https://badbear.ydys.cc/api/v1/plugins/categories',
      'https://shop.example.com/api/v1/plugins/latest',
      'https://shop.example.com/api/v1/plugins',
      'https://shop.example.com/api/v1/plugins/categories',
      'https://shop.example.com/api/v1/plugins/latest',
    ])
  })

  it('falls back to plugin categories when categories request fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }

      if (url.endsWith('/api/v1/plugins')) {
        return jsonResponse([
          {
            name: 'demo-plugin',
            version: '1.0.0',
            title: 'Demo Plugin',
            categories: ['tools'],
          },
        ])
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return new Response('boom', { status: 500 })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await fetchPluginMarket()

    expect(result.storefront?.categories.tools?.title).toBe('Tools')
    expect(result.storefront?.categories.tools?.plugins).toEqual([{ name: 'demo-plugin' }])
  })

  it('requests plugin list directly when latest check fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return new Response('boom', { status: 500 })
      }

      if (url.endsWith('/api/v1/plugins')) {
        return jsonResponse([
          {
            name: 'demo-plugin',
            version: '1.0.0',
            title: 'Demo Plugin',
            categories: ['tools'],
          },
        ])
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([
          {
            key: 'tools',
            title: '工具',
            list: ['demo-plugin'],
          },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await fetchPluginMarket()

    expect(result.data?.[0]?.name).toBe('demo-plugin')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://badbear.ydys.cc/api/v1/plugins/latest',
      'https://badbear.ydys.cc/api/v1/plugins',
      'https://badbear.ydys.cc/api/v1/plugins/categories',
    ])
  })

  it('requests plugin risk for a selected version', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/plugins/demo-plugin/risk?version=2.0.0')) {
        return jsonResponse({
          pluginName: 'demo-plugin',
          version: '2.0.0',
          riskLevel: 'HIGH',
          riskSummary: { summary: '检测到可疑行为' },
          reviewDecision: 'MANUAL_PASS',
          updatedAt: '2026-04-09T12:00:00.000Z',
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const risk = await getPluginRisk('demo-plugin', '2.0.0')

    expect(risk.riskLevel).toBe('HIGH')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://badbear.ydys.cc/api/v1/plugins/demo-plugin/risk?version=2.0.0',
      expect.anything(),
    )
  })

  it('normalizes plugin version builds array responses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/plugins/demo-plugin/2.0.0/versions')) {
        return jsonResponse([
          {
            id: '1',
            version: '2.0.0',
            hash: 'abc123',
            fileSize: 1024,
            downloads: 10,
            createdAt: '2026-04-01T00:00:00Z',
          },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const response = await getPluginVersionBuilds('demo-plugin', '2.0.0')

    expect(response.items).toHaveLength(1)
    expect(response.items[0].hash).toBe('abc123')
  })

  it('fetches public provider details by id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/providers/provider-1')) {
        return jsonResponse({ id: 'provider-1', publicName: 'NPM 官方源' })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const provider = await getPublicProviderById('provider-1')

    expect(provider.publicName).toBe('NPM 官方源')
  })
})

afterAll(() => {
  globalThis.fetch = originalFetch
})
