import { describe, expect, it } from 'vitest'
import {
  buildCommentTree,
  buildNotificationTree,
  createEmptyNotificationState,
  isPluginHostPermissionDeniedError,
} from './shared'
import { resolvePluginInstallPayload } from '../../../api/pluginMarket'

describe('plugin market page helpers', () => {
  it('builds nested comment tree from flat and nested records', () => {
    const tree = buildCommentTree([
      {
        id: '1',
        content: 'root',
        parentId: null,
        user: { id: 'u1', account: 'a', username: 'A', avatarUrl: null },
        createdAt: '2026-03-28T10:00:00Z',
        updatedAt: '2026-03-28T10:00:00Z',
        replies: [
          {
            id: '2',
            content: 'child',
            parentId: '1',
            user: { id: 'u2', account: 'b', username: 'B', avatarUrl: null },
            createdAt: '2026-03-28T11:00:00Z',
            updatedAt: '2026-03-28T11:00:00Z',
          },
        ],
      },
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].id).toBe('2')
  })

  it('builds notification tree with replies grouped under root', () => {
    const tree = buildNotificationTree([
      {
        id: 'reply',
        type: 'COMMENT_REPLY',
        status: 'UNREAD',
        title: 'reply',
        message: 'message',
        metadata: { parentId: 'root' },
        createdAt: '2026-03-28T11:00:00Z',
        readAt: null,
      },
      {
        id: 'root',
        type: 'COMMENT',
        status: 'READ',
        title: 'root',
        message: 'root message',
        metadata: null,
        createdAt: '2026-03-28T10:00:00Z',
        readAt: '2026-03-28T10:10:00Z',
      },
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('root')
    expect(tree[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].id).toBe('reply')
  })

  it('detects host permission denied errors for plugin APIs', () => {
    expect(
      isPluginHostPermissionDeniedError(
        new Error('PermissionDeniedError: API "internal:get-plugins" 仅限内置插件调用'),
      ),
    ).toBe(true)
    expect(isPluginHostPermissionDeniedError(new Error('普通错误'))).toBe(false)
  })

  it('resolves plugin install payload for selected version and build', () => {
    const payload = resolvePluginInstallPayload(
      {
        name: 'demo-plugin',
        version: '1.0.0',
        title: 'Demo',
      },
      { version: '2.0.0', hash: 'abc123' },
    )

    expect(payload.version).toBe('2.0.0')
    expect(payload.downloadUrl).toContain('/demo-plugin/2.0.0/abc123/download')
  })
})
