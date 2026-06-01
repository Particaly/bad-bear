import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePluginMarketUploads } from './usePluginMarketUploads'
import type { AuthUser } from '../../../types/auth'

const {
  checkPluginUploadHashMock,
  deleteMyPluginUploadMock,
  getMyPluginUploadsMock,
  uploadPluginPackageMock,
  digestMock,
} = vi.hoisted(() => ({
  checkPluginUploadHashMock: vi.fn(),
  deleteMyPluginUploadMock: vi.fn(),
  getMyPluginUploadsMock: vi.fn(),
  uploadPluginPackageMock: vi.fn(),
  digestMock: vi.fn(),
}))

vi.mock('../../../api/pluginMarket', () => ({
  checkPluginUploadHash: checkPluginUploadHashMock,
  deleteMyPluginUpload: deleteMyPluginUploadMock,
  getMyPluginUploads: getMyPluginUploadsMock,
  uploadPluginPackage: uploadPluginPackageMock,
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
  beforeEach(() => {
    checkPluginUploadHashMock.mockReset()
    deleteMyPluginUploadMock.mockReset()
    getMyPluginUploadsMock.mockReset()
    uploadPluginPackageMock.mockReset()
    digestMock.mockReset()
    digestMock.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: digestMock,
        },
      },
    })
  })

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

  it('prechecks the selected package before uploading and uploads when safe', async () => {
    const uploads = createUploadsComposable()
    const file = new File(['plugin'], 'demo-plugin.zpx')
    checkPluginUploadHashMock.mockResolvedValue({ status: 'safe' })
    getMyPluginUploadsMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    uploadPluginPackageMock.mockResolvedValue({ success: true, reviewTaskId: 'review-1' })

    uploads.selectFile(file)
    const result = await uploads.performUpload()

    expect(digestMock).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer))
    expect(checkPluginUploadHashMock).toHaveBeenCalledWith('sha256:010203')
    expect(uploadPluginPackageMock).toHaveBeenCalledWith({ file, fileName: file.name })
    expect(result).toEqual({ success: true, reviewTaskId: 'review-1' })
  })

  it('stops upload when automatic precheck finds a blocked package', async () => {
    const uploads = createUploadsComposable()
    checkPluginUploadHashMock.mockResolvedValue({ status: 'blocked' })

    uploads.selectFile(new File(['plugin'], 'demo-plugin.zpx'))
    const result = await uploads.performUpload()

    expect(checkPluginUploadHashMock).toHaveBeenCalledWith('sha256:010203')
    expect(uploadPluginPackageMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false })
  })
})
