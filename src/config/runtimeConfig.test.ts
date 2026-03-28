import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildShopApiAssetUrl,
  DEFAULT_SHOP_API_BASE_URL,
  normalizeShopApiBaseUrl,
  saveShopApiRuntimeConfig,
} from './runtimeConfig'

describe('runtimeConfig', () => {
  beforeEach(() => {
    saveShopApiRuntimeConfig({
      baseUrl: DEFAULT_SHOP_API_BASE_URL,
      token: '',
      currentUser: null,
    })
  })

  it('normalizes base url and trims trailing slash', () => {
    expect(normalizeShopApiBaseUrl(' example.com/api/ ')).toBe('http://example.com/api')
  })

  it('rejects unsupported protocols', () => {
    expect(() => normalizeShopApiBaseUrl('ftp://example.com')).toThrow('API 地址仅支持 http 或 https')
  })

  it('builds asset url from runtime base url', () => {
    saveShopApiRuntimeConfig({ baseUrl: 'https://shop.example.com/' })
    expect(buildShopApiAssetUrl('/assets/logo.png')).toBe('https://shop.example.com/assets/logo.png')
  })

  it('keeps absolute asset url unchanged', () => {
    expect(buildShopApiAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })
})
