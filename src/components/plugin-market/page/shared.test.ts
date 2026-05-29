import { describe, expect, it } from 'vitest'
import {
  buildCommentTree,
  buildNotificationTree,
  createEmptyPluginDetailState,
  createEmptyNotificationState,
  isPluginHostPermissionDeniedError,
  buildCurrentPluginDownloadTarget,
  mapPluginSourceLabel,
  parsePluginSourceReference,
  mergePluginDetailIntoPlugin,
  validateUsername,
  validatePassword,
  validateLoginPayload,
  validateRegisterPayload,
  validateAvatarFile,
} from './shared'
import { buildMarketViewState, mergeMarketSnapshots } from './storefront'
import { resolvePluginInstallPayload } from '../../../api/pluginMarket'
import { buildLatestPluginDownloadTarget, canUpgrade } from './actions/install-target'
import type { InstalledPlugin, PluginDetailResponse, PluginMarketFetchResponse, PluginMarketUiPlugin } from '../../../types/pluginMarket'
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

  it('merges previous market snapshot until stream completes', () => {
    const previous: PluginMarketFetchResponse = {
      success: true,
      data: [
        { name: 'old-plugin', version: '1.0.0', title: 'Old' },
        { name: 'shared-plugin', version: '1.0.0', title: 'Old Shared' },
      ],
      storefront: {
        sections: [],
        categories: {},
        categoryLayouts: {},
      },
    }
    const incoming: PluginMarketFetchResponse = {
      success: true,
      data: [
        { name: 'shared-plugin', version: '2.0.0', title: 'New Shared' },
        { name: 'new-plugin', version: '1.0.0', title: 'New' },
      ],
      storefront: {
        sections: [],
        categories: {},
        categoryLayouts: {},
      },
    }

    const merged = mergeMarketSnapshots(previous, incoming)

    expect(merged.data?.map((plugin) => plugin.name)).toEqual([
      'old-plugin',
      'shared-plugin',
      'new-plugin',
    ])
    expect(merged.data?.find((plugin) => plugin.name === 'shared-plugin')?.version).toBe('2.0.0')
  })

  it('keeps zero-plugin categories in market view state', () => {
    const viewState = buildMarketViewState(
      {
        success: true,
        data: [
          {
            name: 'demo-plugin',
            version: '1.0.0',
            title: 'Demo Plugin',
            platform: ['win32'],
            categories: ['tools'],
          },
        ],
        storefront: {
          sections: [
            {
              type: 'navigation',
              key: 'categories',
              title: '分类',
              categories: [
                { key: 'tools', title: '工具', showDescription: false, pluginCount: 1 },
                { key: 'empty', title: '空分类', showDescription: false, pluginCount: 0 },
              ],
            },
            {
              type: 'fixed',
              key: 'all-plugins',
              title: '全部插件',
              plugins: [{ name: 'demo-plugin' }],
            },
          ],
          categories: {
            tools: {
              key: 'tools',
              title: '工具',
              plugins: [{ name: 'demo-plugin' }],
            },
            empty: {
              key: 'empty',
              title: '空分类',
              plugins: [],
            },
          },
          categoryLayouts: {},
        },
      },
      [],
      [],
      'win32',
    )

    expect(viewState.storefrontCategories.empty).toEqual(
      expect.objectContaining({ key: 'empty', title: '空分类', plugins: [] }),
    )
    expect(viewState.storefrontSections).toEqual([
      {
        type: 'navigation',
        key: 'categories',
        title: '分类',
        categories: [
          expect.objectContaining({ key: 'tools', title: '工具', pluginCount: 1 }),
          expect.objectContaining({ key: 'empty', title: '空分类', pluginCount: 0 }),
        ],
      },
      {
        type: 'fixed',
        key: 'all-plugins',
        title: '全部插件',
        plugins: [
          expect.objectContaining({ name: 'demo-plugin' }),
        ],
      },
    ])
  })

  it('marks only installed plugins returned by check-updates as updatable', () => {
    const installed: InstalledPlugin[] = [
      {
        name: 'demo-plugin',
        path: '/plugins/demo',
        version: '1.0.0',
        hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        name: 'local-only',
        path: '/plugins/local-only',
        version: '1.0.0',
      },
    ]
    const viewState = buildMarketViewState(
      {
        success: true,
        data: [{ name: 'demo-plugin', version: '1.0.0', title: 'Demo Plugin' }],
        storefront: {
          sections: [],
          categories: {},
          categoryLayouts: {},
        },
      },
      installed,
      [],
      'win32',
      new Map([['demo-plugin', 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']]),
    )

    expect(viewState.uiPlugins.find((plugin) => plugin.name === 'demo-plugin')).toEqual(
      expect.objectContaining({ hasUpdate: false, latestHash: undefined }),
    )
    expect(viewState.installedViewPlugins.find((plugin) => plugin.name === 'demo-plugin')).toEqual(
      expect.objectContaining({
        hasUpdate: true,
        localHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        latestHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    )
    expect(viewState.installedViewPlugins.find((plugin) => plugin.name === 'local-only')).toEqual(
      expect.objectContaining({ hasUpdate: false, latestHash: undefined }),
    )
  })

  it('uses latestHash when building an installed plugin update target', () => {
    const plugin: PluginMarketUiPlugin = {
      name: 'demo-plugin',
      version: '1.0.0',
      title: 'Demo Plugin',
      description: 'Demo',
      installed: true,
      path: '/plugins/demo',
      localVersion: '1.0.0',
      latestVersion: '1.0.0',
      latestHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      hasUpdate: true,
      marketPlugin: { name: 'demo-plugin', version: '1.0.0', title: 'Demo Plugin' },
    }
    const target = buildLatestPluginDownloadTarget(plugin, null)

    expect(canUpgrade(plugin)).toBe(true)
    expect(target.hash).toBe('sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    expect(target.version).toBe('最新版本')
    expect(target.downloadUrl).toContain('/demo-plugin/download?hash=sha256%3Abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
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
      const payload: LoginRequest = { account: 'testuser', password: 'password123', captchaToken: 'token', captchaCode: '10' }
      expect(() => validateLoginPayload(payload)).not.toThrow()
    })

    it('rejects login payload with empty account', () => {
      const payload: LoginRequest = { account: '  ', password: 'password123', captchaToken: 'token', captchaCode: '10' }
      expect(() => validateLoginPayload(payload)).toThrow('请输入账号')
    })

    it('rejects login payload with empty password', () => {
      const payload: LoginRequest = { account: 'testuser', password: '', captchaToken: 'token', captchaCode: '10' }
      expect(() => validateLoginPayload(payload)).toThrow('请输入密码')
    })

    it('rejects login payload with empty captchaCode', () => {
      const payload: LoginRequest = { account: 'testuser', password: 'password123', captchaToken: 'token', captchaCode: '  ' }
      expect(() => validateLoginPayload(payload)).toThrow('请输入验证码')
    })

    it('accepts valid register payload', () => {
      const payload: RegisterRequest = {
        account: 'testuser',
        username: 'Test User',
        password: 'password123',
        captchaToken: 'token',
        captchaCode: '10',
      }
      expect(() => validateRegisterPayload(payload)).not.toThrow()
    })

    it('rejects register payload with invalid account pattern', () => {
      const payload: RegisterRequest = {
        account: 'invalid@account',
        username: 'Test User',
        password: 'password123',
        captchaToken: 'token',
        captchaCode: '10',
      }
      expect(() => validateRegisterPayload(payload)).toThrow('账号需为 3-50 位字母、数字、下划线或连字符')
    })

    it('rejects register payload with empty captchaCode', () => {
      const payload: RegisterRequest = {
        account: 'testuser',
        username: 'Test User',
        password: 'password123',
        captchaToken: 'token',
        captchaCode: '  ',
      }
      expect(() => validateRegisterPayload(payload)).toThrow('请输入验证码')
    })

    it('accepts valid avatar file', () => {
      const file = new File([''], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 })
      expect(() => validateAvatarFile(file)).not.toThrow()
    })

    it('rejects avatar file with invalid type', () => {
      const file = new File([''], 'avatar.pdf', { type: 'application/pdf' })
      expect(() => validateAvatarFile(file)).toThrow('头像仅支持 jpeg/png/gif/webp 格式')
    })

    it('rejects avatar file that is too large', () => {
      const file = new File([''], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })
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
        {
          id: '1',
          version: '2.0.0',
          hash: 'def456',
          fileSize: 1024,
          downloads: 100,
          createdAt: '2026-04-01T00:00:00Z',
          source: { type: 'provider', provider: { id: 'provider-1', name: '官方' } },
          uploaderUsername: 'octocat',
        },
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

    it('maps provider-backed sources through embedded provider names', () => {
      const reference = parsePluginSourceReference({
        type: 'provider',
        provider: { id: 'provider-1', name: '官方' },
      })
      expect(mapPluginSourceLabel(reference)).toBe('官方')
    })

    it('does not show a fallback label for provider-backed sources without names', () => {
      const reference = parsePluginSourceReference({ type: 'provider' })
      expect(mapPluginSourceLabel(reference)).toBe('')
    })

    it('maps local sources as user uploads', () => {
      const reference = parsePluginSourceReference({ type: 'local' })
      expect(mapPluginSourceLabel(reference)).toBe('用户上传')
    })

    it('maps uploaded sources without exposing raw payloads', () => {
      const reference = parsePluginSourceReference('manual-upload')
      expect(mapPluginSourceLabel(reference)).toBe('用户上传')
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
      const merged = mergePluginDetailIntoPlugin(
        plugin,
        {
          ...mockDetail,
          title: 'Detail Title',
          description: 'Detail Description',
          author: 'Detail Author',
          main: 'dist/main.js',
          preload: 'dist/preload.js',
        },
      )
      expect(merged.title).toBe('Detail Title')
      expect(merged.description).toBe('Detail Description')
      expect(merged.author).toBe('Detail Author')
      expect(merged.main).toBe('dist/main.js')
      expect(merged.preload).toBe('dist/preload.js')
      expect(merged.totalDownloads).toBe(1000)
      expect(merged.avgRating).toBe(4.5)
      expect(merged.ratingCount).toBe(100)
    })

    it('builds resolved download target with latest detail build by default', () => {
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
      const target = buildCurrentPluginDownloadTarget(plugin, mockDetail)
      expect(target?.version).toBe('2.0.0')
      expect(target?.hash).toBe('def456')
      expect(target?.downloadMode).toBe('hash')
    })

    it('builds resolved download target for selected historical build', () => {
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
      const selectedBuild = mockDetail.versions[1]
      const target = buildCurrentPluginDownloadTarget(plugin, mockDetail, selectedBuild)
      expect(target?.version).toBe('1.5.0')
      expect(target?.hash).toBe('abc123')
      expect(target?.downloadMode).toBe('hash')
      expect(target?.build?.hash).toBe('abc123')
      expect(target?.downloadUrl).toContain('/test-plugin/1.5.0/abc123/download')
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
      const target = buildCurrentPluginDownloadTarget(plugin, null)
      expect(target?.version).toBe('1.0.0')
      expect(target?.downloadMode).toBe('latest')
    })
  })
})
