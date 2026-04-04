import { describe, expect, it } from 'vitest'
import { buildNotificationListQuery, subscribeNotifications } from './notifications'
import { getShopApiRuntimeConfig, saveShopApiRuntimeConfig } from '../config/runtimeConfig'
import { buildPluginPageQuery } from './pluginMarketRemote'
import { appendQuery, buildQueryString } from './query'

describe('query builders', () => {
  it('builds plugin page query with numeric fields', () => {
    expect(buildPluginPageQuery({ page: 2, pageSize: 20 })).toBe('?page=2&pageSize=20')
  })

  it('builds notification list query with status', () => {
    expect(buildNotificationListQuery({ page: 1, pageSize: 10, status: 'UNREAD' })).toBe(
      '?page=1&pageSize=10&status=UNREAD',
    )
  })

  it('skips empty query values', () => {
    expect(buildQueryString({ page: undefined, status: '', enabled: null })).toBe('')
  })

  it('appends query string to path', () => {
    expect(appendQuery('/api/test', { page: 3, pageSize: 5 })).toBe('/api/test?page=3&pageSize=5')
  })
})

describe('notification stream', () => {
  it('subscribes with bearer auth and parses SSE events', async () => {
    const originalFetch = globalThis.fetch
    const originalConfig = getShopApiRuntimeConfig()

    saveShopApiRuntimeConfig({
      baseUrl: 'https://example.com',
      token: 'test-token',
      currentUser: null,
    })

    const encoder = new TextEncoder()
    const frames = [
      'event: connected\n',
      'data: {"message":"Notification stream connected"}\n\n',
      'id: evt-1\n',
      'event: notification.created\n',
      'data: {"id":"n1","type":"COMMENT_REPLY","status":"UNREAD","title":"title","message":"body","metadata":null,"createdAt":"2026-04-04T00:00:00.000Z","readAt":null}\n\n',
      'event: notification.read\n',
      'data: {"id":"n1","status":"READ","readAt":"2026-04-04T00:01:00.000Z"}\n\n',
    ]

    let requestHeaders: Headers | null = null

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers)
      return new Response(
        new ReadableStream({
          start(controller) {
            frames.forEach((frame) => controller.enqueue(encoder.encode(frame)))
            controller.close()
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      )
    }) as typeof fetch

    const events: string[] = []
    try {
      await subscribeNotifications({
        signal: new AbortController().signal,
        onEvent: (event) => {
          events.push(event.type)
        },
      })
    } finally {
      globalThis.fetch = originalFetch
      saveShopApiRuntimeConfig(originalConfig)
    }

    expect(requestHeaders?.get('authorization')).toBe('Bearer test-token')
    expect(requestHeaders?.get('accept')).toBe('text/event-stream')
    expect(events).toEqual(['connected', 'notification.created', 'notification.read'])
  })
})
