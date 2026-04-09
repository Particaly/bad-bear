import { HttpClientError, requestFormData, requestJson } from './httpClient'
import { appendQuery } from './query'
import {
  adaptPlugin,
  buildStorefront,
  deriveFallbackCategories,
} from './pluginMarketStorefront'
import type {
  CreatePluginCommentRequest,
  CreatePluginRatingRequest,
  MyPluginUploadsQuery,
  MyPluginUploadsResponse,
  PluginCommentRecord,
  PluginCommentsPage,
  PluginDetailResponse,
  PluginHashCheckResponse,
  PluginMarketCategoryDto,
  PluginMarketFetchResponse,
  PluginMarketPluginDto,
  PluginPageQuery,
  PluginRatingRecord,
  PluginRatingsPage,
  PluginUploadAcceptedResponse,
  PluginUploadPayload,
  PluginUploadResponse,
} from '../types/pluginMarket'

export function buildPluginPageQuery(query?: PluginPageQuery): string {
  return appendQuery('', {
    page: query?.page,
    pageSize: query?.pageSize,
  })
}

export async function fetchPluginMarket(): Promise<PluginMarketFetchResponse> {
  const pluginResponse = await requestJson<PluginMarketPluginDto[]>({
    path: '/api/v1/plugins',
  })
  const plugins = (Array.isArray(pluginResponse) ? pluginResponse : [])
    .filter(
      (plugin): plugin is PluginMarketPluginDto =>
        !!plugin && typeof plugin.name === 'string' && typeof plugin.version === 'string',
    )
    .map(adaptPlugin)

  let categoryDtos: PluginMarketCategoryDto[] = []

  try {
    const categoryResponse = await requestJson<PluginMarketCategoryDto[]>({
      path: '/api/v1/plugins/categories',
    })
    categoryDtos = Array.isArray(categoryResponse) ? categoryResponse : []
  } catch (error) {
    console.warn('[PluginMarket] 加载插件分类失败，回退到插件自带分类:', error)
  }

  if (categoryDtos.length === 0) {
    categoryDtos = deriveFallbackCategories(plugins)
  }

  return {
    success: true,
    data: plugins,
    storefront: buildStorefront(plugins, categoryDtos),
  }
}

export function getPluginDetail(name: string): Promise<PluginDetailResponse> {
  const pluginName = encodeURIComponent(name)
  return requestJson<PluginDetailResponse>({
    path: `/api/v1/plugins/${pluginName}`,
  })
}

export function getPluginRatings(
  name: string,
  query?: PluginPageQuery,
): Promise<PluginRatingsPage> {
  const pluginName = encodeURIComponent(name)
  return requestJson<PluginRatingsPage>({
    path: appendQuery(`/api/v1/plugins/${pluginName}/ratings`, {
      page: query?.page,
      pageSize: query?.pageSize,
    }),
  })
}

export function createPluginRating(
  name: string,
  payload: CreatePluginRatingRequest,
): Promise<PluginRatingRecord> {
  const pluginName = encodeURIComponent(name)
  return requestJson<PluginRatingRecord, CreatePluginRatingRequest>({
    path: `/api/v1/plugins/${pluginName}/ratings`,
    method: 'POST',
    body: payload,
  })
}

export function getPluginComments(
  name: string,
  query?: PluginPageQuery,
): Promise<PluginCommentsPage> {
  const pluginName = encodeURIComponent(name)
  return requestJson<PluginCommentsPage>({
    path: appendQuery(`/api/v1/plugins/${pluginName}/comments`, {
      page: query?.page,
      pageSize: query?.pageSize,
    }),
  })
}

export function checkPluginUploadHash(hash: string): Promise<PluginHashCheckResponse> {
  return requestJson<PluginHashCheckResponse, { hash: string }>({
    path: '/api/v1/plugins/check-hash',
    method: 'POST',
    body: { hash },
  })
}

export function getMyPluginUploads(query?: MyPluginUploadsQuery): Promise<MyPluginUploadsResponse> {
  return requestJson<MyPluginUploadsResponse>({
    path: appendQuery('/api/v1/plugins/me/uploads', {
      page: query?.page,
      pageSize: query?.pageSize,
      keyword: query?.keyword?.trim() || undefined,
    }),
  })
}

export function deleteMyPluginUpload(id: string): Promise<{ message?: string } | null> {
  return requestJson<{ message?: string } | null>({
    path: `/api/v1/plugins/me/uploads/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}

export function createPluginComment(
  name: string,
  payload: CreatePluginCommentRequest,
): Promise<PluginCommentRecord> {
  const pluginName = encodeURIComponent(name)
  return requestJson<PluginCommentRecord, CreatePluginCommentRequest>({
    path: `/api/v1/plugins/${pluginName}/comments`,
    method: 'POST',
    body: payload,
  })
}

export async function uploadPluginPackage(
  payload: PluginUploadPayload,
): Promise<PluginUploadResponse> {
  const fileName = payload.fileName || 'plugin.zpx'
  const formData = new FormData()
  formData.append('file', payload.file, fileName)

  console.log('[PluginMarket] uploadPluginPackage 请求准备完成:', {
    fileName,
    fileSize: payload.file.size,
    fileType: payload.file.type,
  })

  try {
    const data = await requestFormData<PluginUploadAcceptedResponse>({
      path: '/api/v1/plugins/upload',
      method: 'POST',
      body: formData,
    })

    console.log('[PluginMarket] uploadPluginPackage 请求成功:', data)

    return {
      success: true,
      message: typeof data?.message === 'string' ? data.message : '上传成功',
      reviewTaskId: typeof data?.reviewTaskId === 'string' ? data.reviewTaskId : undefined,
      data,
    }
  } catch (error) {
    console.error('[PluginMarket] uploadPluginPackage 请求失败:', error)
    if (error instanceof HttpClientError) {
      console.error('[PluginMarket] uploadPluginPackage 响应详情:', {
        status: error.status,
        data: error.data,
      })
      return {
        success: false,
        error: error.message,
        data: error.data,
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败',
    }
  }
}
