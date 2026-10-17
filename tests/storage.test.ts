import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaults } from '../src/engine'
import { deleteArtwork, duplicateArtwork, listArtworks, saveArtwork } from '../src/storage'

const mem = new Map<string, string>()
beforeEach(() => {
  mem.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  })
})
describe('local artwork storage', () => {
  it('saves, updates in place, duplicates and deletes', () => {
    const { id } = saveArtwork('One', defaults('neon'))
    expect(listArtworks()).toHaveLength(1)
    saveArtwork('Renamed', defaults('neon'), id)
    expect(listArtworks()).toHaveLength(1); expect(listArtworks()[0].title).toBe('Renamed')
    const after = duplicateArtwork(id)
    expect(after).toHaveLength(2); expect(after[0].id).not.toBe(id); expect(after[0].title).toBe('Renamed (copy)')
    expect(deleteArtwork(id)).toHaveLength(1)
  })
  it('recovers from corrupted storage', () => {
    mem.set('pixelforge.artworks.v1', '{{{')
    expect(listArtworks()).toEqual([])
  })
})
