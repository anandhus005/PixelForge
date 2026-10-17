import { describe, expect, it } from 'vitest'
import { LIMITS, defaults, randomize, sanitize, type NumKey, type Preset } from '../src/engine'
import { decodeShare, encodeShare, parseArtworks } from '../src/storage'

const presets: Preset[] = ['cosmic', 'neon', 'orbit', 'waves', 'bloom']
describe('settings', () => {
  it('defaults are valid for every preset', () => {
    for (const p of presets) expect(sanitize(defaults(p))).toEqual(defaults(p))
  })
  it('clamps out-of-range numbers', () => {
    const s = sanitize({ ...defaults('cosmic'), count: 999999, speed: -5 })!
    expect(s.count).toBe(LIMITS.count[1]); expect(s.speed).toBe(LIMITS.speed[0])
  })
  it('rejects bad preset and bad colour', () => {
    expect(sanitize({ preset: 'evil' })).toBeNull()
    expect(sanitize({ ...defaults('neon'), bg: 'url(x)' })!.bg).toBe('#080810')
  })
  it('randomize stays within limits', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomize(defaults('orbit'))
      ;(Object.keys(LIMITS) as NumKey[]).forEach((k) => {
        expect(s[k]).toBeGreaterThanOrEqual(LIMITS[k][0]); expect(s[k]).toBeLessThanOrEqual(LIMITS[k][1])
      })
    }
  })
})
describe('sharing and storage', () => {
  it('round-trips a share token', () => expect(decodeShare(encodeShare(defaults('waves')))).toEqual(defaults('waves')))
  it('rejects garbage and oversized tokens', () => {
    expect(decodeShare('not-base64!!')).toBeNull(); expect(decodeShare('a'.repeat(5000))).toBeNull()
  })
  it('drops invalid saved artworks', () => {
    expect(parseArtworks('{bad')).toEqual([])
    expect(parseArtworks(JSON.stringify([{ id: 'x', settings: { preset: 'nope' } }]))).toEqual([])
  })
})
