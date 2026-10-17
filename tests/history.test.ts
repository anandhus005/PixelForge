import { describe, expect, it } from 'vitest'
import { COALESCE_MS, HISTORY_LIMIT, commit, createHistory, push, redo, undo } from '../src/history'

describe('history', () => {
  it('undoes and redoes', () => {
    let h = push(push(createHistory(1), 2), 3)
    h = undo(h); expect(h.present).toBe(2)
    h = undo(h); expect(h.present).toBe(1); expect(undo(h)).toBe(h)
    h = redo(h); expect(h.present).toBe(2)
  })
  it('a new edit clears redo', () => {
    const h = push(undo(push(createHistory(1), 2)), 9)
    expect(h.future).toEqual([]); expect(h.present).toBe(9)
  })
  it('coalesces rapid edits into one step', () => {
    let h = commit(createHistory(0), 1, 10_000)
    h = commit(h, 2, COALESCE_MS - 1); h = commit(h, 3, COALESCE_MS - 1)
    expect(h.present).toBe(3); expect(h.past).toEqual([0])
  })
  it('is bounded', () => {
    let h = createHistory(0)
    for (let i = 1; i < HISTORY_LIMIT + 20; i++) h = push(h, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
  })
})
