import { describe, expect, it } from 'vitest'
import { compareVersions, formatDateTime, weightedSearch } from './utils'

describe('plugin-market utils', () => {
  it('compares semantic-like versions', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1)
    expect(compareVersions('2.0', '2.0.0')).toBe(0)
    expect(compareVersions('3.0.1', '3.0.0')).toBe(1)
  })

  it('filters plugins with weighted field priority', () => {
    const items = [
      { name: 'alpha-tool', title: 'Alpha Tool', description: '实用插件' },
      { name: 'beta-helper', title: 'Beta Helper', description: '适合 alpha 场景' },
      { name: 'gamma-pack', title: '', description: '其他描述' },
    ]

    expect(
      weightedSearch(items, 'alpha', [
        { value: (item) => item.title || item.name || '', weight: 10 },
        { value: (item) => item.description || '', weight: 5 },
      ]),
    ).toEqual([items[0], items[1]])
  })

  it('returns original items for blank query and ignores case', () => {
    const items = [
      { name: 'alpha-tool', title: 'Alpha Tool', description: null },
      { name: 'beta-helper', title: null, description: 'BETA helper' },
    ]

    expect(
      weightedSearch(items, '   ', [
        { value: (item) => item.title || item.name || '', weight: 10 },
        { value: (item) => item.description || '', weight: 5 },
      ]),
    ).toBe(items)

    expect(
      weightedSearch(items, 'beta', [
        { value: (item) => item.title || item.name || '', weight: 10 },
        { value: (item) => item.description || '', weight: 5 },
      ]),
    ).toEqual([items[1]])
  })

  it('formats datetime values', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime('invalid')).toBe('invalid')
    expect(formatDateTime('2026-03-28T10:30:00Z')).toContain('2026')
  })
})
