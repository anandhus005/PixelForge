import { sanitize, type Settings } from './engine'
const KEY = 'pixelforge.artworks.v1'
export interface Artwork { id: string; title: string; settings: Settings; createdAt: number; updatedAt: number }

export function parseArtworks(json: string | null): Artwork[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr.flatMap((x): Artwork[] => {
      const s = sanitize(x?.settings)
      if (!s || typeof x.id !== 'string') return []
      return [{ id: x.id, title: String(x.title ?? 'Untitled').slice(0, 80), settings: s,
        createdAt: Number(x.createdAt) || Date.now(), updatedAt: Number(x.updatedAt) || Date.now() }]
    })
  } catch { return [] }
}
export function listArtworks(): Artwork[] {
  try { return parseArtworks(localStorage.getItem(KEY)) } catch { return [] }
}
const write = (l: Artwork[]) => localStorage.setItem(KEY, JSON.stringify(l)) // may throw (quota) - callers catch

export function saveArtwork(title: string, settings: Settings, id?: string): { list: Artwork[]; id: string } {
  const list = listArtworks(), now = Date.now(), clean = title.trim().slice(0, 80) || 'Untitled'
  const i = id ? list.findIndex((a) => a.id === id) : -1
  let outId = id ?? ''
  if (i >= 0) list[i] = { ...list[i], title: clean, settings, updatedAt: now }
  else { outId = crypto.randomUUID(); list.unshift({ id: outId, title: clean, settings, createdAt: now, updatedAt: now }) }
  write(list); return { list, id: outId }
}
export function duplicateArtwork(id: string): Artwork[] {
  const list = listArtworks(), a = list.find((x) => x.id === id)
  if (!a) return list
  const now = Date.now()
  list.unshift({ ...a, id: crypto.randomUUID(), title: (a.title + ' (copy)').slice(0, 80), createdAt: now, updatedAt: now })
  write(list); return list
}
export function deleteArtwork(id: string): Artwork[] {
  const list = listArtworks().filter((a) => a.id !== id)
  write(list); return list
}

export function encodeShare(s: Settings): string {
  return btoa(JSON.stringify(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeShare(token: string): Settings | null {
  if (!token || token.length > 2000) return null
  try { return sanitize(JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/')))) } catch { return null }
}

export function exportPng(canvas: HTMLCanvasElement, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('PNG export failed'))
      const url = URL.createObjectURL(b), a = document.createElement('a')
      a.href = url; a.download = (name.replace(/[^\w-]+/g, '_') || 'pixelforge') + '.png'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000); resolve()
    }, 'image/png')
  })
}

// ---- Settings file (JSON) import / export ----
export const CONFIG_VERSION = 1
export const MAX_CONFIG_BYTES = 20_000

export function exportConfigJson(title: string, settings: Settings): string {
  return JSON.stringify({ app: 'pixelforge', version: CONFIG_VERSION, title: title.slice(0, 80), settings }, null, 2)
}
/** Only data is read; every field goes through sanitize(). Returns null for anything unusable. */
export function parseConfigJson(text: string): { title: string; settings: Settings } | null {
  if (text.length > MAX_CONFIG_BYTES) return null
  try {
    const o = JSON.parse(text)
    if (!o || o.app !== 'pixelforge' || o.version !== CONFIG_VERSION) return null
    const settings = sanitize(o.settings)
    if (!settings) return null
    const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 80) : 'Imported artwork'
    return { title, settings }
  } catch { return null }
}
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
