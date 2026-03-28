import { describe, expect, it } from 'vitest'
import { buildNotificationListQuery } from './notifications'
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
