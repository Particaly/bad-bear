import { HttpClientError, requestFormData, requestJson } from './httpClient'
import { appendQuery } from './query'
import { getShopApiRuntimeConfig } from '../config/runtimeConfig'
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
  PluginMarketPlugin,
  PluginMarketPluginDto,
  PluginPageQuery,
  PluginRatingRecord,
  PluginRatingsPage,
  PluginUploadAcceptedResponse,
  PluginUploadPayload,
  PluginUploadResponse,
} from '../types/pluginMarket'

const PLUGIN_MARKET_CACHE_KEY = 'bad-bear.plugin-market.cache.v1'

interface PluginMarketLatestResponse {
  latestAt: string
}

interface PluginMarketCacheRecord {
  version: 1
  latestSignature: string
  plugins: PluginMarketPluginDto[]
  categories: PluginMarketCategoryDto[]
}

function getPluginMarketCacheStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function isPluginMarketCacheRecord(value: unknown): value is PluginMarketCacheRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    candidate.version === 1 &&
    typeof candidate.latestSignature === 'string' &&
    Array.isArray(candidate.plugins) &&
    Array.isArray(candidate.categories)
  )
}

function buildPluginMarketCacheKey(): string {
  const { baseUrl } = getShopApiRuntimeConfig()
  return `${PLUGIN_MARKET_CACHE_KEY}:${baseUrl}`
}

function readPluginMarketCache(): PluginMarketCacheRecord | null {
  const storage = getPluginMarketCacheStorage()
  if (!storage) {
    return null
  }

  const rawValue = storage.getItem(buildPluginMarketCacheKey())
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    return isPluginMarketCacheRecord(parsed) ? parsed : null
  } catch {
    storage.removeItem(buildPluginMarketCacheKey())
    return null
  }
}

function writePluginMarketCache(record: PluginMarketCacheRecord): void {
  const storage = getPluginMarketCacheStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(buildPluginMarketCacheKey(), JSON.stringify(record))
  } catch (error) {
    console.warn('[PluginMarket] 缓存插件商店数据失败:', error)
  }
}

function buildPluginMarketLatestSignature(value: PluginMarketLatestResponse): string {
  return value.latestAt
}

function isPluginMarketLatestResponse(value: unknown): value is PluginMarketLatestResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  return typeof (value as Record<string, unknown>).latestAt === 'string'
}

function normalizePluginDtos(pluginResponse: PluginMarketPluginDto[]): PluginMarketPluginDto[] {
  return (Array.isArray(pluginResponse) ? pluginResponse : []).filter(
    (plugin): plugin is PluginMarketPluginDto =>
      !!plugin && typeof plugin.name === 'string' && typeof plugin.version === 'string',
  )
}

function buildPluginMarketResponse(
  pluginDtos: PluginMarketPluginDto[],
  categoryDtos: PluginMarketCategoryDto[],
): PluginMarketFetchResponse {
  const plugins: PluginMarketPlugin[] = pluginDtos.map(adaptPlugin)
  const resolvedCategoryDtos = categoryDtos.length > 0 ? categoryDtos : deriveFallbackCategories(plugins)

  return {
    success: true,
    data: plugins,
    storefront: buildStorefront(plugins, resolvedCategoryDtos),
  }
}

async function fetchPluginCategoryDtos(
  plugins: PluginMarketPlugin[],
): Promise<PluginMarketCategoryDto[]> {
  let categoryDtos: PluginMarketCategoryDto[] = []

  try {
    const categoryResponse = await requestJson<PluginMarketCategoryDto[]>({
      path: '/api/v1/plugins/categories',
    })
    categoryDtos = Array.isArray(categoryResponse) ? categoryResponse : []
  } catch (error) {
    console.warn('[PluginMarket] 加载插件分类失败，回退到插件自带分类:', error)
  }

  return categoryDtos.length > 0 ? categoryDtos : deriveFallbackCategories(plugins)
}

export function buildPluginPageQuery(query?: PluginPageQuery): string {
  return appendQuery('', {
    page: query?.page,
    pageSize: query?.pageSize,
  })
}

export async function fetchPluginMarket(): Promise<PluginMarketFetchResponse> {
  const cachedMarket = readPluginMarketCache()

  let latestSignature: string | null = null
  try {
    const latestResponse = await requestJson<PluginMarketLatestResponse>({
      path: '/api/v1/plugins/latest',
    })
    if (!isPluginMarketLatestResponse(latestResponse)) {
      throw new Error('插件商店 latest 响应格式无效')
    }

    latestSignature = buildPluginMarketLatestSignature(latestResponse)

    if (cachedMarket && cachedMarket.latestSignature === latestSignature) {
      return buildPluginMarketResponse(cachedMarket.plugins, cachedMarket.categories)
    }
  } catch (error) {
    console.warn('[PluginMarket] 检查商店更新失败，将直接拉取插件列表:', error)
  }

  const pluginResponse = await requestJson<PluginMarketPluginDto[]>({
    path: '/api/v1/plugins',
  })
  const pluginDtos = normalizePluginDtos(pluginResponse)
  const plugins = pluginDtos.map(adaptPlugin)
  const categoryDtos = await fetchPluginCategoryDtos(plugins)

  if (latestSignature !== null) {
    writePluginMarketCache({
      version: 1,
      latestSignature,
      plugins: pluginDtos,
      categories: categoryDtos,
    })
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
