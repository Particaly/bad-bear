import { requestJson } from './httpClient'
import type {
  MarkAllNotificationsReadResponse,
  NotificationListQuery,
  NotificationListResponse,
} from '../types/notification'

export function buildNotificationListQuery(query?: NotificationListQuery): string {
  const searchParams = new URLSearchParams()

  if (typeof query?.page === 'number') {
    searchParams.set('page', String(query.page))
  }

  if (typeof query?.pageSize === 'number') {
    searchParams.set('pageSize', String(query.pageSize))
  }

  if (query?.status) {
    searchParams.set('status', query.status)
  }

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export function getNotifications(
  query?: NotificationListQuery,
): Promise<NotificationListResponse> {
  return requestJson<NotificationListResponse>({
    path: `/api/v1/notifications${buildNotificationListQuery(query)}`,
  })
}

export async function markNotificationRead(id: string): Promise<void> {
  await requestJson<unknown>({
    path: `/api/v1/notifications/${encodeURIComponent(id)}/read`,
    method: 'PATCH',
  })
}

export function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse | null> {
  return requestJson<MarkAllNotificationsReadResponse | null>({
    path: '/api/v1/notifications/read-all',
    method: 'PATCH',
  })
}
