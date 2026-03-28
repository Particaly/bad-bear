export type NotificationStatus = 'UNREAD' | 'READ'
export type NotificationFilter = 'ALL' | NotificationStatus

export interface NotificationListQuery {
  page?: number
  pageSize?: number
  status?: NotificationStatus
}

export interface NotificationRecord {
  id: string
  type: string
  status: NotificationStatus
  title: string
  message: string
  metadata: Record<string, unknown> | null
  parentId?: string | null
  createdAt: string
  readAt: string | null
}

export interface NotificationTreeNode extends NotificationRecord {
  replies: NotificationTreeNode[]
  depth: 0 | 1
}

export interface NotificationListResponse {
  items: NotificationRecord[]
  total: number
  page: number
  pageSize: number
}

export interface MarkAllNotificationsReadResponse {
  success?: boolean
  message?: string
}
