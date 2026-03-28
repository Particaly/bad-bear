import { describe, expect, it } from 'vitest'
import { compareVersions, formatDateTime } from './utils'

describe('plugin-market utils', () => {
  it('compares semantic-like versions', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1)
    expect(compareVersions('2.0', '2.0.0')).toBe(0)
    expect(compareVersions('3.0.1', '3.0.0')).toBe(1)
  })

  it('formats datetime values', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime('invalid')).toBe('invalid')
    expect(formatDateTime('2026-03-28T10:30:00Z')).toContain('2026')
  })
})
