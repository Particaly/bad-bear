import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePluginMarketUploads } from './usePluginMarketUploads'
import type { AuthUser } from '../../../types/auth'

vi.mock('../../../api/pluginMarket', () => ({
  checkPluginUploadHash: vi.fn(),
  deleteMyPluginUpload: vi.fn(),
  getMyPluginUploads: vi.fn(),
  uploadPluginPackage: vi.fn(),
}))

function createUploadsComposable() {
  return usePluginMarketUploads({
    authToken: ref(''),
    currentUser: ref<AuthUser | null>(null),
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    confirmAction: vi.fn(async () => true),
    reloadMarket: vi.fn(async () => {}),
  })
}

describe('usePluginMarketUploads', () => {
  it('accepts .zpx and .zip plugin packages', () => {
    const uploads = createUploadsComposable()

    uploads.selectFile(new File(['plugin'], 'demo-plugin.zpx'))
    expect(uploads.validationError.value).toBe('')

    uploads.selectFile(new File(['plugin'], 'demo-plugin.zip'))
    expect(uploads.validationError.value).toBe('')
  })

  it('rejects unsupported package extensions', () => {
    const uploads = createUploadsComposable()

    uploads.selectFile(new File(['plugin'], 'demo-plugin.rar'))

    expect(uploads.validationError.value).toBe('仅支持 .zpx 或 .zip 格式的插件包')
  })
})
