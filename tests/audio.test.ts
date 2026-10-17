import { describe, expect, it } from 'vitest'
import { levelsFrom } from '../src/audio'

describe('levelsFrom', () => {
  it('is zero for silence and for empty input', () => {
    expect(levelsFrom(new Uint8Array(512))).toEqual({ bass: 0, mid: 0, treble: 0, volume: 0 })
    expect(levelsFrom(new Uint8Array(0)).volume).toBe(0)
  })
  it('is 1 for full-scale input', () => {
    const l = levelsFrom(new Uint8Array(512).fill(255))
    expect(l.bass).toBe(1); expect(l.treble).toBe(1); expect(l.volume).toBe(1)
  })
  it('separates bass energy from treble', () => {
    const d = new Uint8Array(512); d.fill(255, 0, 10)
    const l = levelsFrom(d)
    expect(l.bass).toBeGreaterThan(0.5); expect(l.treble).toBe(0); expect(l.volume).toBeLessThan(0.1)
  })
})
