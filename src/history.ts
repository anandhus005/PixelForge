/** Bounded undo/redo over immutable snapshots (settings), never per-frame state. */
export interface History<T> { past: T[]; present: T; future: T[] }
export const HISTORY_LIMIT = 50
export const COALESCE_MS = 400

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] })

export function push<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}
/** Changes closer together than COALESCE_MS (a slider drag) become one undo step. */
export function commit<T>(h: History<T>, next: T, gapMs: number): History<T> {
  return gapMs < COALESCE_MS && h.past.length > 0 ? { ...h, present: next } : push(h, next)
}
export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
}
export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
}
