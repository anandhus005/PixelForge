export type Quality = 'performance' | 'balanced' | 'high'
export const QUALITIES: Quality[] = ['performance', 'balanced', 'high']
export const QUALITY_LABEL: Record<Quality, string> = { performance: 'Performance', balanced: 'Balanced', high: 'High Quality' }
const KEY = 'pixelforge.quality.v1'

export function loadQuality(): Quality {
  try { const v = localStorage.getItem(KEY); return QUALITIES.includes(v as Quality) ? (v as Quality) : 'balanced' } catch { return 'balanced' }
}
export function saveQuality(q: Quality): void {
  try { localStorage.setItem(KEY, q) } catch { /* storage unavailable: preference is just not remembered */ }
}
