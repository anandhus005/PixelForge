import { describe, expect, it } from 'vitest'
import { ARRANGEMENTS, MODES, PARAM_LIMITS, clampParams, defaultParams, randomParams, type ParamKey } from '../src/graphics/params3d'

describe('3D parameters', () => {
  it('defaults are valid and stable under clampParams', () => expect(clampParams(defaultParams())).toEqual(defaultParams()))
  it('clamps out-of-range and non-finite numbers', () => {
    const p = clampParams({ speed: 99, density: -5, hue: Number.NaN, glow: Infinity })
    expect(p.speed).toBe(PARAM_LIMITS.speed[1]); expect(p.density).toBe(PARAM_LIMITS.density[0])
    expect(p.hue).toBe(defaultParams().hue); expect(p.glow).toBe(defaultParams().glow)
  })
  it('rejects unknown arrangements', () => {
    expect(clampParams({ arrangement: 'evil' as never }).arrangement).toBe(defaultParams().arrangement)
    expect(clampParams({ arrangement: 'sphere' }).arrangement).toBe('sphere')
  })
  it('randomParams always stays within limits', () => {
    for (let i = 0; i < 100; i++) {
      const p = randomParams()
      ;(Object.keys(PARAM_LIMITS) as ParamKey[]).forEach((k) => { expect(p[k]).toBeGreaterThanOrEqual(PARAM_LIMITS[k][0]); expect(p[k]).toBeLessThanOrEqual(PARAM_LIMITS[k][1]) })
      expect(ARRANGEMENTS).toContain(p.arrangement)
    }
  })
  it('every mode only exposes known parameters', () => {
    for (const m of Object.values(MODES)) m.params.forEach((k) => expect(PARAM_LIMITS[k]).toBeDefined())
  })
})
