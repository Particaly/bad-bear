import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCaptcha, pollGithubDeviceLogin, startGithubDeviceLogin } from './auth'
import { DEFAULT_SHOP_API_BASE_URL, saveShopApiRuntimeConfig } from '../config/runtimeConfig'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('auth api', () => {
  beforeEach(() => {
    saveShopApiRuntimeConfig({
      baseUrl: DEFAULT_SHOP_API_BASE_URL,
      token: '',
      currentUser: null,
    })
    globalThis.fetch = originalFetch
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('requests captcha with encoded bgColor query', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => jsonResponse({ image: 'captcha-image', key: 'captcha-key' }))
    globalThis.fetch = fetchMock as typeof fetch

    await getCaptcha('#fff 000')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe('https://badbear.ydys.cc/api/v1/auth/captcha?bgColor=%23fff%20000')
    expect(init?.method ?? 'GET').toBe('GET')
  })

  it('starts GitHub device login with POST', async () => {
    const fetchMock = vi.fn<FetchMock>(async () =>
      jsonResponse({
        deviceSessionId: 'session-1',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://github.com/login/device',
        verificationUriComplete: 'https://github.com/login/device?user_code=ABCD-EFGH',
        expiresAt: '2026-05-12T01:23:45.000Z',
        expiresIn: 900,
        interval: 5,
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    await startGithubDeviceLogin()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe('https://badbear.ydys.cc/api/v1/auth/github/device/start')
    expect(init?.method).toBe('POST')
  })

  it('polls GitHub device login with JSON body', async () => {
    const fetchMock = vi.fn<FetchMock>(async () =>
      jsonResponse({
        status: 'pending',
        retryAfterSeconds: 5,
        expiresAt: '2026-05-12T01:23:45.000Z',
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    await pollGithubDeviceLogin({ deviceSessionId: 'session-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe('https://badbear.ydys.cc/api/v1/auth/github/device/poll')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
    expect(init?.body).toBe(JSON.stringify({ deviceSessionId: 'session-1' }))
  })
})

