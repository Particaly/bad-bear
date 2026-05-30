import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHOP_API_BASE_URL, saveShopApiRuntimeConfig } from '../config/runtimeConfig'
import { fetchPluginMarket, getPluginRisk, streamPluginMarket, checkPluginUpdates } from './pluginMarketRemote'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sseResponse(frames: string[], options: { splitIndex?: number } = {}): Response {
  const encoder = new TextEncoder()
  const payload = frames.join('')
  const chunks =
    typeof options.splitIndex === 'number'
      ? [payload.slice(0, options.splitIndex), payload.slice(options.splitIndex)]
      : [payload]

  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => {
          if (chunk) {
            controller.enqueue(encoder.encode(chunk))
          }
        })
        controller.close()
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  )
}

/**
 * 根据平台构造一次性插件列表 SSE，便于测试缓存、分片解析和逐步快照行为。
 */
function buildPluginStreamFrames(pluginName: string, platform = 'win32'): string[] {
  return [
    `event: plugins.start\ndata: {"platform":"${platform}","total":1}\n\n`,
    `event: plugins.item\ndata: {"name":"${pluginName}","version":"1.0.0","title":"${pluginName}","categories":["tools"],"platform":["${platform}"]}\n\n`,
    `event: plugins.end\ndata: {"platform":"${platform}","total":1,"sent":1}\n\n`,
  ]
}

describe('plugin market stream', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveShopApiRuntimeConfig({
      baseUrl: DEFAULT_SHOP_API_BASE_URL,
      token: '',
      currentUser: null,
    })
  })

  it('reuses cached plugins and categories when latest response is unchanged', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
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

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        expect(new Headers(init?.headers).get('accept')).toBe('text/event-stream')
        return sseResponse(buildPluginStreamFrames('demo-plugin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const firstResult = await fetchPluginMarket('win32')
    const secondResult = await fetchPluginMarket('win32')

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)
    expect(secondResult.data?.[0]?.name).toBe('demo-plugin')
    expect(secondResult.data?.[0]?.platform).toEqual(['win32'])
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://badbear.ydys.cc/api/v1/plugins/latest',
      'https://badbear.ydys.cc/api/v1/plugins/categories',
      'https://badbear.ydys.cc/api/v1/plugins/stream?platform=win32',
      'https://badbear.ydys.cc/api/v1/plugins/latest',
    ])
  })

  it('emits progressive snapshots before the stream completes', async () => {
    const snapshots: Array<{ complete: boolean; names: string[]; categoryTitles: string[] }> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-12T11:46:20.849Z' })
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

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('demo-plugin'), { splitIndex: 70 })
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await streamPluginMarket({
      platform: 'win32',
      onSnapshot: (snapshot) => {
        snapshots.push({
          complete: snapshot.complete,
          names: (snapshot.data || []).map((plugin) => plugin.name),
          categoryTitles: Object.values(snapshot.storefront?.categories || {}).map((category) => category.title),
        })
      },
    })

    expect(result.success).toBe(true)
    expect(snapshots.length).toBeGreaterThanOrEqual(2)
    expect(snapshots.some((snapshot) => !snapshot.complete && snapshot.names.includes('demo-plugin'))).toBe(true)
    expect(snapshots[snapshots.length - 1]).toEqual({
      complete: true,
      names: ['demo-plugin'],
      categoryTitles: ['工具'],
    })
  })

  it('uses fallback categories before real categories arrive', async () => {
    let resolveCategories: ((value: Response) => void) | null = null
    const categoriesPromise = new Promise<Response>((resolve) => {
      resolveCategories = resolve
    })
    const snapshots: Array<{ complete: boolean; categoryTitles: string[] }> = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-12T11:46:20.849Z' })
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return categoriesPromise
      }

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('demo-plugin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const streamPromise = streamPluginMarket({
      platform: 'win32',
      onSnapshot: (snapshot) => {
        snapshots.push({
          complete: snapshot.complete,
          categoryTitles: Object.values(snapshot.storefront?.categories || {}).map((category) => category.title),
        })
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    resolveCategories?.(
      jsonResponse([
        {
          key: 'tools',
          title: '工具',
          list: ['demo-plugin'],
        },
      ]),
    )

    const result = await streamPromise

    expect(result.storefront?.categories.tools?.title).toBe('工具')
    expect(snapshots.some((snapshot) => snapshot.categoryTitles.includes('Tools'))).toBe(true)
    expect(snapshots[snapshots.length - 1].categoryTitles).toEqual(['工具'])
  })

  it('falls back to plugin categories when categories request fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return new Response('boom', { status: 500 })
      }

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('demo-plugin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await fetchPluginMarket('win32')

    expect(result.storefront?.categories.tools?.title).toBe('Tools')
    expect(result.storefront?.categories.tools?.plugins).toEqual([{ name: 'demo-plugin' }])
  })

  it('requests stream directly when latest check fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return new Response('boom', { status: 500 })
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

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('demo-plugin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await fetchPluginMarket('win32')

    expect(result.data?.[0]?.name).toBe('demo-plugin')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://badbear.ydys.cc/api/v1/plugins/latest',
      'https://badbear.ydys.cc/api/v1/plugins/categories',
      'https://badbear.ydys.cc/api/v1/plugins/stream?platform=win32',
    ])
  })

  it('uses separate caches for different platforms', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }
      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([{ key: 'tools', title: '工具', list: ['shared-plugin'] }])
      }
      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('windows-plugin', 'win32'))
      }
      if (url.endsWith('/api/v1/plugins/stream?platform=darwin')) {
        return sseResponse(buildPluginStreamFrames('mac-plugin', 'darwin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const windowsResult = await fetchPluginMarket('win32')
    const macResult = await fetchPluginMarket('darwin')
    const repeatedWindowsResult = await fetchPluginMarket('win32')

    expect(windowsResult.data?.[0]?.name).toBe('windows-plugin')
    expect(macResult.data?.[0]?.name).toBe('mac-plugin')
    expect(repeatedWindowsResult.data?.[0]?.name).toBe('windows-plugin')
  })

  it('does not cache incomplete streams', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }
      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([{ key: 'tools', title: '工具', list: ['demo-plugin'] }])
      }
      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse([
          'event: plugins.start\n',
          'data: {"platform":"win32","total":1}\n\n',
          'event: plugins.item\n',
          'data: {"name":"demo-plugin","version":"1.0.0","categories":["tools"],"platform":["win32"]}\n\n',
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    await expect(streamPluginMarket({ platform: 'win32' })).rejects.toThrow('插件商店流提前结束')
    await expect(streamPluginMarket({ platform: 'win32' })).rejects.toThrow('插件商店流提前结束')
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/plugins/stream?platform=win32')),
    ).toHaveLength(2)
  })

  it('shows categories with zero plugins in storefront navigation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/plugins/latest')) {
        return jsonResponse({ latestAt: '2026-04-11T11:46:20.849Z' })
      }

      if (url.endsWith('/api/v1/plugins/categories')) {
        return jsonResponse([
          { key: 'tools', title: '工具', list: ['demo-plugin'] },
          { key: 'empty', title: '空分类', list: [] },
        ])
      }

      if (url.endsWith('/api/v1/plugins/stream?platform=win32')) {
        return sseResponse(buildPluginStreamFrames('demo-plugin'))
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const result = await fetchPluginMarket('win32')
    const navigationSection = result.storefront?.sections.find((section) => section.type === 'navigation')

    expect(navigationSection?.type).toBe('navigation')
    expect(navigationSection?.categories).toEqual([
      expect.objectContaining({ key: 'tools', title: '工具', pluginCount: 1 }),
      expect.objectContaining({ key: 'empty', title: '空分类', pluginCount: 0 }),
    ])
  })

  it('posts installed plugin hashes to check updates', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/v1/plugins/check-updates')) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          plugins: [
            {
              name: 'demo-plugin',
              hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          ],
        })
        return jsonResponse([
          {
            name: 'demo-plugin',
            latestHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ])
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    globalThis.fetch = fetchMock as typeof fetch

    const updates = await checkPluginUpdates([
      {
        name: 'demo-plugin',
        hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ])

    expect(updates).toEqual([
      {
        name: 'demo-plugin',
        latestHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
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
})

afterAll(() => {
  globalThis.fetch = originalFetch
})
