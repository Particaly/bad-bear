import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstalledPlugin } from '../types/pluginMarket'
import {
  buildMarketPluginUpdateCheckItems,
  getMarketInstallRegistryFilePath,
  normalizeSha256Hash,
  readMarketInstalledPluginHashes,
  removeMarketInstalledPluginHash,
  upsertMarketInstalledPluginHash,
} from './pluginMarketInstallRegistry'

const HASH_A = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HASH_B = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const HASH_C = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const BARE_HASH_D = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

function mockHostFileApis(options: {
  exists?: boolean
  content?: string
} = {}) {
  const writeFile = vi.fn()
  const readFile = vi.fn(() => options.content ?? '')
  const exists = vi.fn(() => options.exists ?? true)

  ;(window as any).ztools = {
    getPath: vi.fn(() => 'C:/userData'),
  }
  ;(window as any).services = {
    path: {
      join: vi.fn((...segments: string[]) => segments.join('/')),
    },
    exists,
    readFile,
    writeFile,
  }

  return { exists, readFile, writeFile }
}

function installedPlugin(name: string, hash?: string): InstalledPlugin {
  return {
    name,
    path: `C:/plugins/${name}`,
    version: '1.0.0',
    hash,
  }
}

describe('pluginMarketInstallRegistry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(window as any).ztools = undefined
    ;(window as any).services = undefined
  })

  it('builds the registry path under the plugin data directory', () => {
    mockHostFileApis()

    expect(getMarketInstallRegistryFilePath()).toBe(
      'C:/userData/plugins/installed-plugin-hashes.csv',
    )
  })

  it('normalizes sha256 hashes', () => {
    expect(normalizeSha256Hash(HASH_A.toUpperCase())).toBe(HASH_A)
    expect(normalizeSha256Hash(BARE_HASH_D.toUpperCase())).toBe(`sha256:${BARE_HASH_D}`)
    expect(normalizeSha256Hash('bad-hash')).toBeNull()
    expect(normalizeSha256Hash(null)).toBeNull()
  })

  it('returns empty records when the registry file is missing or APIs are unavailable', () => {
    mockHostFileApis({ exists: false })

    expect(readMarketInstalledPluginHashes()).toEqual(new Map())

    ;(window as any).services = undefined

    expect(readMarketInstalledPluginHashes()).toEqual(new Map())
  })

  it('reads valid CSV rows and skips malformed records', () => {
    mockHostFileApis({
      content: [
        'name,hash',
        `demo-plugin,${HASH_A}`,
        `other-plugin,${BARE_HASH_D.toUpperCase()}`,
        'invalid-plugin,not-a-hash',
        `,${HASH_B}`,
        '',
      ].join('\n'),
    })

    expect(readMarketInstalledPluginHashes()).toEqual(new Map([
      ['demo-plugin', HASH_A],
      ['other-plugin', `sha256:${BARE_HASH_D}`],
    ]))
  })

  it('uses the last valid record for duplicate names', () => {
    mockHostFileApis({
      content: [
        'name,hash',
        `demo-plugin,${HASH_A}`,
        `demo-plugin,${HASH_B}`,
      ].join('\n'),
    })

    expect(readMarketInstalledPluginHashes()).toEqual(new Map([
      ['demo-plugin', HASH_B],
    ]))
  })

  it('supports escaped CSV names', () => {
    mockHostFileApis({
      content: [
        'name,hash',
        `"demo, ""quoted"" plugin",${HASH_A}`,
      ].join('\n'),
    })

    expect(readMarketInstalledPluginHashes()).toEqual(new Map([
      ['demo, "quoted" plugin', HASH_A],
    ]))
  })

  it('upserts records with stable CSV output', () => {
    const { writeFile } = mockHostFileApis({
      content: [
        'name,hash',
        `z-plugin,${HASH_C}`,
        `demo-plugin,${HASH_A}`,
      ].join('\n'),
    })

    upsertMarketInstalledPluginHash('demo-plugin', HASH_B)

    expect(writeFile).toHaveBeenCalledWith(
      'C:/userData/plugins/installed-plugin-hashes.csv',
      [
        'name,hash',
        `demo-plugin,${HASH_B}`,
        `z-plugin,${HASH_C}`,
        '',
      ].join('\n'),
    )
  })

  it('removes records after uninstall', () => {
    const { writeFile } = mockHostFileApis({
      content: [
        'name,hash',
        `demo-plugin,${HASH_A}`,
        `z-plugin,${HASH_C}`,
      ].join('\n'),
    })

    removeMarketInstalledPluginHash('demo-plugin')

    expect(writeFile).toHaveBeenCalledWith(
      'C:/userData/plugins/installed-plugin-hashes.csv',
      [
        'name,hash',
        `z-plugin,${HASH_C}`,
        '',
      ].join('\n'),
    )
  })

  it('removes stale records when upserting an invalid hash', () => {
    const { writeFile } = mockHostFileApis({
      content: [
        'name,hash',
        `demo-plugin,${HASH_A}`,
      ].join('\n'),
    })

    upsertMarketInstalledPluginHash('demo-plugin', 'invalid')

    expect(writeFile).toHaveBeenCalledWith(
      'C:/userData/plugins/installed-plugin-hashes.csv',
      'name,hash\n',
    )
  })

  it('builds update check items from registry hashes only', () => {
    mockHostFileApis({
      content: [
        'name,hash',
        `demo-plugin,${HASH_A}`,
        `stale-plugin,${HASH_B}`,
      ].join('\n'),
    })

    expect(buildMarketPluginUpdateCheckItems([
      installedPlugin('demo-plugin', HASH_C),
      installedPlugin('missing-plugin', HASH_C),
    ])).toEqual([
      {
        name: 'demo-plugin',
        hash: HASH_A,
      },
    ])
  })
})
