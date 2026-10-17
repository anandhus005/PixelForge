// Pure (no three.js import) so it can be unit-tested and loaded without the 3D chunk.
export type Mode3D = 'sculpture' | 'nebula' | 'kinetic'
export type Arrangement = 'grid' | 'spiral' | 'sphere'
export type ParamKey = 'hue' | 'speed' | 'size' | 'density' | 'glow' | 'light'
export interface Params3D extends Record<ParamKey, number> { arrangement: Arrangement }

/** [min, max, step] */
export const PARAM_LIMITS: Record<ParamKey, [number, number, number]> = {
  hue: [0, 360, 1], speed: [0, 4, 0.1], size: [0.3, 2, 0.05], density: [0.1, 1, 0.05], glow: [0, 2, 0.1], light: [0.2, 3, 0.1],
}
export const ARRANGEMENTS: Arrangement[] = ['grid', 'spiral', 'sphere']
export const MODES: Record<Mode3D, { label: string; blurb: string; params: ParamKey[]; labels: Partial<Record<ParamKey, string>> }> = {
  sculpture: { label: 'Orbital Sculpture', blurb: 'Concentric metallic rings with orbiting satellites around a glowing core.',
    params: ['hue', 'speed', 'size', 'density', 'glow', 'light'], labels: { density: 'Rings', size: 'Scale', light: 'Lighting' } },
  nebula: { label: 'Particle Nebula', blurb: 'A spiral galaxy of GPU-animated particles that parts around your pointer.',
    params: ['hue', 'speed', 'size', 'density', 'glow'], labels: { density: 'Density', size: 'Particle size' } },
  kinetic: { label: 'Kinetic Geometry', blurb: 'Instanced shapes in a grid, spiral or sphere that pulse in waves and swell near your pointer.',
    params: ['hue', 'speed', 'size', 'density', 'glow', 'light'], labels: { density: 'Count', size: 'Element size', light: 'Lighting' } },
}
export const PALETTES_3D = [
  { id: 'violet', label: 'Violet Dream', hue: 260, glow: 1.2 }, { id: 'aurora', label: 'Aurora', hue: 165, glow: 1.2 },
  { id: 'ember', label: 'Ember', hue: 20, glow: 1 }, { id: 'deep', label: 'Deep Sea', hue: 205, glow: 0.8 },
] as const

export const defaultParams = (): Params3D => ({ hue: 260, speed: 1, size: 1, density: 0.7, glow: 1, light: 1, arrangement: 'spiral' })

/** Validates untrusted/derived values: numbers are clamped to PARAM_LIMITS, unknown arrangement falls back. */
export function clampParams(raw: Partial<Params3D>): Params3D {
  const out = defaultParams()
  ;(Object.keys(PARAM_LIMITS) as ParamKey[]).forEach((k) => {
    const v = raw[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(PARAM_LIMITS[k][1], Math.max(PARAM_LIMITS[k][0], v))
  })
  if (raw.arrangement && ARRANGEMENTS.includes(raw.arrangement)) out.arrangement = raw.arrangement
  return out
}
export function randomParams(): Params3D {
  const r = (k: ParamKey) => { const [a, b, s] = PARAM_LIMITS[k]; return Number((Math.round((a + Math.random() * (b - a)) / s) * s).toFixed(2)) }
  return clampParams({ hue: r('hue'), speed: Math.max(0.4, r('speed')), size: r('size'), density: Math.max(0.3, r('density')),
    glow: r('glow'), light: r('light'), arrangement: ARRANGEMENTS[Math.floor(Math.random() * ARRANGEMENTS.length)] })
}
