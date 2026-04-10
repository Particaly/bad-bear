import { describe, expect, it } from 'vitest'
import {
  buildCommentTree,
  buildNotificationTree,
  createEmptyPluginDetailState,
  createEmptyNotificationState,
  isPluginHostPermissionDeniedError,
  buildPluginVersionOptions,
  buildPluginHashOptions,
  buildResolvedPluginDownloadTarget,
  resolveSelectedVersion,
  resolveSelectedHash,
  mergePluginDetailIntoPlugin,
  validateUsername,
  validatePassword,
  validateLoginPayload,
  validateRegisterPayload,
  validateAvatarFile,
} from './shared'
import { resolvePluginInstallPayload } from '../../../api/pluginMarket'
import type { PluginDetailResponse, PluginMarketUiPlugin } from '../../../types/pluginMarket'
import type { LoginRequest, RegisterRequest } from '../../../types/auth'

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

  describe('validation', () => {
    it('accepts valid username', () => {
      expect(() => validateUsername('validuser')).not.toThrow()
    })

    it('rejects username that is too short', () => {
      expect(() => validateUsername('a')).toThrow('用户名长度需为 2-50 个字符')
    })

    it('rejects username that is too long', () => {
      expect(() => validateUsername('a'.repeat(51))).toThrow('用户名长度需为 2-50 个字符')
    })

    it('accepts valid password', () => {
      expect(() => validatePassword('password123')).not.toThrow()
    })

    it('rejects password that is too short', () => {
      expect(() => validatePassword('short')).toThrow('密码长度需为 8-72 个字符')
    })

    it('rejects password that is too long', () => {
      expect(() => validatePassword('a'.repeat(73))).toThrow('密码长度需为 8-72 个字符')
    })

    it('accepts valid login payload', () => {
      const payload: LoginRequest = { account: 'testuser', password: 'password123' }
      expect(() => validateLoginPayload(payload)).not.toThrow()
    })

    it('rejects login payload with empty account', () => {
      const payload: LoginRequest = { account: '  ', password: 'password123' }
      expect(() => validateLoginPayload(payload)).toThrow('请输入账号')
    })

    it('rejects login payload with empty password', () => {
      const payload: LoginRequest = { account: 'testuser', password: '' }
      expect(() => validateLoginPayload(payload)).toThrow('请输入密码')
    })

    it('accepts valid register payload', () => {
      const payload: RegisterRequest = {
        account: 'testuser',
        username: 'Test User',
        password: 'password123',
      }
      expect(() => validateRegisterPayload(payload)).not.toThrow()
    })

    it('rejects register payload with invalid account pattern', () => {
      const payload: RegisterRequest = {
        account: 'invalid@account',
        username: 'Test User',
        password: 'password123',
      }
      expect(() => validateRegisterPayload(payload)).toThrow('账号需为 3-50 位字母、数字、下划线或连字符')
    })

    it('accepts valid avatar file', () => {
      const file = new File([''], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB
      expect(() => validateAvatarFile(file)).not.toThrow()
    })

    it('rejects avatar file with invalid type', () => {
      const file = new File([''], 'avatar.pdf', { type: 'application/pdf' })
      expect(() => validateAvatarFile(file)).toThrow('头像仅支持 jpeg/png/gif/webp 格式')
    })

    it('rejects avatar file that is too large', () => {
      const file = new File([''], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }) // 6MB
      expect(() => validateAvatarFile(file)).toThrow('头像大小不能超过 5MB')
    })
  })

  describe('plugin detail resolution', () => {
    const mockDetail: PluginDetailResponse = {
      id: 'test-plugin',
      name: 'test-plugin',
      categories: [],
      categoryFallback: false,
      avgRating: 4.5,
      ratingCount: 100,
      totalDownloads: 1000,
      versions: [
        { id: '1', version: '2.0.0', hash: 'def456', fileSize: 1024, downloads: 100, createdAt: '2026-04-01T00:00:00Z' },
        { id: '2', version: '1.5.0', hash: 'abc123', fileSize: 1024, downloads: 50, createdAt: '2026-03-01T00:00:00Z' },
        { id: '3', version: '2.0.0', hash: 'xyz789', fileSize: 1024, downloads: 20, createdAt: '2026-04-02T00:00:00Z' },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    }

    it('creates empty plugin detail state', () => {
      const state = createEmptyPluginDetailState()
      expect(state.detail).toBeNull()
      expect(state.selectedVersion).toBeNull()
      expect(state.selectedHash).toBeNull()
      expect(state.comments).toEqual([])
      expect(state.requestId).toBe(0)
    })

    it('creates empty notification state', () => {
      const state = createEmptyNotificationState()
      expect(state.items).toEqual([])
      expect(state.filter).toBe('ALL')
      expect(state.page).toBe(1)
      expect(state.requestId).toBe(0)
    })

    it('builds version options from detail', () => {
      const options = buildPluginVersionOptions(mockDetail)
      expect(options).toHaveLength(2)
      expect(options[0].value).toBe('2.0.0')
      expect(options[0].label).toBe('2.0.0（2 个构建）')
      expect(options[1].value).toBe('1.5.0')
      expect(options[1].label).toBe('1.5.0')
    })

    it('builds hash options for selected version', () => {
      const options = buildPluginHashOptions(mockDetail, '2.0.0')
      expect(options).toHaveLength(2)
      expect(options[0].value).toBe('def456')
      expect(options[0].label).toBe('def456（最新构建）')
      expect(options[1].value).toBe('xyz789')
    })

    it('returns empty hash options when no version selected', () => {
      const options = buildPluginHashOptions(mockDetail, null)
      expect(options).toEqual([])
    })

    it('resolves selected version preferring local version if available', () => {
      const version = resolveSelectedVersion(mockDetail, '1.5.0')
      expect(version).toBe('1.5.0')
    })

    it('resolves to latest version when local version not available', () => {
      const version = resolveSelectedVersion(mockDetail, '1.0.0')
      expect(version).toBe('2.0.0')
    })

    it('resolves selected hash for version', () => {
      const hash = resolveSelectedHash(mockDetail, '2.0.0')
      expect(hash).toBe('def456')
    })

    it('merges plugin detail into plugin', () => {
      const plugin: PluginMarketUiPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        title: 'Test Plugin',
        description: 'Test',
        installed: false,
        logo: null,
        size: null,
        totalDownloads: null,
        avgRating: null,
        ratingCount: null,
      }
      const merged = mergePluginDetailIntoPlugin(plugin, mockDetail)
      expect(merged.totalDownloads).toBe(1000)
      expect(merged.avgRating).toBe(4.5)
      expect(merged.ratingCount).toBe(100)
    })

    it('builds resolved download target with version and hash', () => {
      const plugin: PluginMarketUiPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        title: 'Test Plugin',
        description: 'Test',
        installed: false,
        logo: null,
        size: null,
        marketPlugin: {
          name: 'test-plugin',
          version: '1.0.0',
          title: 'Test Plugin',
          description: 'Test',
          downloadUrl: 'https://example.com/test-plugin/1.0.0/download',
        },
      }
      const target = buildResolvedPluginDownloadTarget(plugin, mockDetail, '2.0.0', 'def456')
      expect(target?.version).toBe('2.0.0')
      expect(target?.hash).toBe('def456')
      expect(target?.downloadMode).toBe('hash')
    })

    it('builds resolved download target in latest mode when no detail', () => {
      const plugin: PluginMarketUiPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        title: 'Test Plugin',
        description: 'Test',
        installed: false,
        logo: null,
        size: null,
        marketPlugin: {
          name: 'test-plugin',
          version: '1.0.0',
          title: 'Test Plugin',
          description: 'Test',
          downloadUrl: 'https://example.com/test-plugin/1.0.0/download',
        },
      }
      const target = buildResolvedPluginDownloadTarget(plugin, null, null, null)
      expect(target?.downloadMode).toBe('latest')
      expect(target?.version).toBe('1.0.0')
    })
  })
})
