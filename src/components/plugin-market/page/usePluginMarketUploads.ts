import { computed, ref, type Ref } from 'vue'
import {
  checkPluginUploadHash,
  deleteMyPluginUpload,
  getMyPluginUploads,
  uploadPluginPackage,
} from '../../../api/pluginMarket'
import type {
  MyPluginUploadRecord,
  MyPluginUploadsQuery,
  MyPluginUploadsResponse,
  PluginHashCheckResponse,
} from '../../../types/pluginMarket'
import type { AuthUser } from '../../../types/auth'
import { getErrorMessage } from './shared'

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024
const UPLOADS_PAGE_SIZE = 20

type HashCheckState = Pick<PluginHashCheckResponse, 'status' | 'pluginName' | 'version'> | null

export function usePluginMarketUploads(options: {
  authToken: Ref<string>
  currentUser: Ref<AuthUser | null>
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
  confirmAction: (params: {
    title?: string
    message: string
    type?: 'info' | 'warning' | 'danger'
    confirmText?: string
    cancelText?: string
  }) => Promise<boolean>
  reloadMarket: () => Promise<void>
}) {
  const selectedFile = ref<File | null>(null)
  const validationError = ref('')
  const computedHash = ref('')
  const hashCheckResult = ref<HashCheckState>(null)
  const isHashing = ref(false)
  const isCheckingHash = ref(false)
  const isUploading = ref(false)

  const uploads = ref<MyPluginUploadRecord[]>([])
  const uploadsTotal = ref(0)
  const uploadsPage = ref(1)
  const uploadsLoading = ref(false)
  const uploadsError = ref('')
  const deletingIds = ref<Set<string>>(new Set())

  const uploadSupported = ref(true)

  const canUpload = computed(
    () =>
      !!selectedFile.value &&
      !validationError.value &&
      !isHashing.value &&
      !isCheckingHash.value &&
      !isUploading.value &&
      hashCheckResult.value?.status === 'safe',
  )

  function validateFile(file: File): string {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.zpx')) {
      return '仅支持 .zpx 格式的插件包'
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return '文件大小不能超过 50MB'
    }
    return ''
  }

  function selectFile(file: File | null): void {
    selectedFile.value = file
    validationError.value = file ? validateFile(file) : ''
    computedHash.value = ''
    hashCheckResult.value = null
  }

  async function computeHashAndPrecheck(): Promise<void> {
    const file = selectedFile.value
    if (!file || validationError.value) return

    hashCheckResult.value = null
    computedHash.value = ''

    // Try browser crypto for SHA-256
    isHashing.value = true
    try {
      const buffer = await file.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(digest))
      const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      computedHash.value = `sha256:${hex}`
    } catch {
      // Hash computation failed - skip precheck, allow upload anyway
      isHashing.value = false
      hashCheckResult.value = { status: 'safe' }
      return
    }
    isHashing.value = false

    // Call precheck API
    isCheckingHash.value = true
    try {
      const response = await checkPluginUploadHash(computedHash.value)
      hashCheckResult.value = {
        status: response.status,
        pluginName: response.pluginName,
        version: response.version,
      }
    } catch {
      // Precheck failed - allow upload, backend remains authoritative
      hashCheckResult.value = { status: 'safe' }
    } finally {
      isCheckingHash.value = false
    }
  }

  async function performUpload(): Promise<{ success: boolean; reviewTaskId?: string }> {
    const file = selectedFile.value
    if (!file || !canUpload.value) return { success: false }

    isUploading.value = true
    try {
      const result = await uploadPluginPackage({
        file,
        fileName: file.name,
      })

      if (!result.success) {
        options.notifyError(result.error || '上传失败')
        return { success: false }
      }

      options.notifySuccess(result.message || '插件上传成功，正在后台处理中')
      selectFile(null)
      await loadUploads()
      return { success: true, reviewTaskId: result.reviewTaskId }
    } catch (error) {
      options.notifyError(getErrorMessage(error, '上传失败'))
      return { success: false }
    } finally {
      isUploading.value = false
    }
  }

  async function loadUploads(query?: MyPluginUploadsQuery): Promise<void> {
    if (!options.authToken.value || !options.currentUser.value) {
      uploads.value = []
      uploadsTotal.value = 0
      uploadsPage.value = 1
      uploadsError.value = ''
      return
    }

    uploadsLoading.value = true
    uploadsError.value = ''

    try {
      const response: MyPluginUploadsResponse = await getMyPluginUploads({
        page: query?.page ?? uploadsPage.value,
        pageSize: UPLOADS_PAGE_SIZE,
        keyword: query?.keyword,
      })
      uploads.value = response.items
      uploadsTotal.value = response.total
      uploadsPage.value = response.page
      uploadSupported.value = true
    } catch (error) {
      uploadsError.value = getErrorMessage(error, '加载上传记录失败')
      uploads.value = []
      uploadsTotal.value = 0
    } finally {
      uploadsLoading.value = false
    }
  }

  async function handleDeleteUpload(record: MyPluginUploadRecord): Promise<void> {
    if (deletingIds.value.has(record.id)) return
    if (record.status === 'PENDING' || record.status === 'RUNNING') {
      options.notifyError('正在处理的记录不可删除')
      return
    }

    const confirmed = await options.confirmAction({
      title: '确认删除',
      message: `确定删除 ${record.originalName} 的上传记录吗？${
        record.status === 'PUBLISHED' ? '该记录已发布，删除后对应插件版本也会同步删除。' : ''
      }`,
      type: 'danger',
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!confirmed) return

    deletingIds.value = new Set([...deletingIds.value, record.id])
    try {
      await deleteMyPluginUpload(record.id)
      options.notifySuccess('已删除上传记录')
      await Promise.all([loadUploads(), options.reloadMarket()])
    } catch (error) {
      options.notifyError(getErrorMessage(error, '删除上传记录失败'))
    } finally {
      const next = new Set(deletingIds.value)
      next.delete(record.id)
      deletingIds.value = next
    }
  }

  function resetState(): void {
    selectedFile.value = null
    validationError.value = ''
    computedHash.value = ''
    hashCheckResult.value = null
    isHashing.value = false
    isCheckingHash.value = false
    isUploading.value = false
    uploads.value = []
    uploadsTotal.value = 0
    uploadsPage.value = 1
    uploadsLoading.value = false
    uploadsError.value = ''
    deletingIds.value = new Set()
  }

  return {
    selectedFile,
    validationError,
    computedHash,
    hashCheckResult,
    isHashing,
    isCheckingHash,
    isUploading,
    canUpload,
    uploads,
    uploadsTotal,
    uploadsPage,
    uploadsLoading,
    uploadsError,
    deletingIds,
    uploadSupported,
    selectFile,
    computeHashAndPrecheck,
    performUpload,
    loadUploads,
    handleDeleteUpload,
    resetState,
  }
}
