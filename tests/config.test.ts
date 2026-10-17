import { describe, expect, it } from 'vitest'
import { defaults, sanitize, type Settings } from '../src/engine'
import { decodeShare, encodeShare, exportConfigJson, parseConfigJson } from '../src/storage'

describe('settings file', () => {
  it('round-trips', () => {
    const r = parseConfigJson(exportConfigJson('My art', { ...defaults('bloom'), palette: 'sunset' }))
    expect(r?.title).toBe('My art'); expect(r?.settings.palette).toBe('sunset'); expect(r?.settings.preset).toBe('bloom')
  })
  it('rejects wrong app, wrong version, bad preset, oversize and junk', () => {
    const ok = JSON.parse(exportConfigJson('x', defaults('neon')))
    expect(parseConfigJson(JSON.stringify({ ...ok, app: 'other' }))).toBeNull()
    expect(parseConfigJson(JSON.stringify({ ...ok, version: 99 }))).toBeNull()
    expect(parseConfigJson(JSON.stringify({ ...ok, settings: { preset: 'nope' } }))).toBeNull()
    expect(parseConfigJson('x'.repeat(30_000))).toBeNull()
    expect(parseConfigJson('not json')).toBeNull()
  })
})
describe('palettes and older data', () => {
  it('accepts known palettes only', () => {
    expect(sanitize({ ...defaults('orbit'), palette: 'ocean' })?.palette).toBe('ocean')
    expect(sanitize({ ...defaults('orbit'), palette: '__proto__' })?.palette).toBe('custom')
  })
  it('old share links without a palette still load', () => {
    const old: Partial<Settings> = { ...defaults('cosmic') }
    delete old.palette
    const token = encodeShare(old as Settings)
    expect(decodeShare(token)?.palette).toBe('custom')
  })
})
