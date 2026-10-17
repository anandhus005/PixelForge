import type { Quality } from './quality'
export type Preset = 'cosmic' | 'neon' | 'orbit' | 'waves' | 'bloom'
export type Interaction = 'attract' | 'repel' | 'orbit' | 'trail' | 'none'
export type NumKey = 'count' | 'speed' | 'size' | 'hue' | 'radius' | 'strength' | 'trail'
export interface Settings {
  preset: Preset; interaction: Interaction; palette: PaletteId
  count: number; speed: number; size: number; hue: number
  radius: number; strength: number; trail: number; bg: string
}
// [min, max, step]
export const LIMITS: Record<NumKey, [number, number, number]> = {
  count: [50, 3000, 50], speed: [0.1, 5, 0.1], size: [1, 8, 0.5], hue: [0, 360, 1],
  radius: [50, 400, 10], strength: [0, 5, 0.1], trail: [0, 0.95, 0.05],
}
export const PRESET_LABELS: Record<Preset, string> = {
  cosmic: 'Cosmic Drift', neon: 'Neon Flow', orbit: 'Orbit Field', waves: 'Liquid Waves', bloom: 'Fractal Bloom',
}
export const INTERACTIONS: Interaction[] = ['attract', 'repel', 'orbit', 'trail', 'none']
// Quality scales resolution and particle budget.
const Q2D: Record<Quality, { dpr: number; scale: number }> = { performance: { dpr: 1, scale: 0.5 }, balanced: { dpr: 2, scale: 1 }, high: { dpr: 2, scale: 1.5 } }
export type PaletteId = 'custom' | 'cosmic' | 'ocean' | 'neon' | 'sunset' | 'mono'
export const PALETTE_LABELS: Record<PaletteId, string> = {
  custom: 'Custom hue', cosmic: 'Cosmic Purple', ocean: 'Ocean Blue', neon: 'Neon Pink', sunset: 'Sunset', mono: 'Monochrome',
}
const PALETTES: Record<Exclude<PaletteId, 'custom'>, string[]> = {
  cosmic: ['#8b5cf6', '#6d28d9', '#c4b5fd', '#22d3ee', '#ec4899'],
  ocean: ['#0ea5e9', '#22d3ee', '#38bdf8', '#0369a1', '#67e8f9'],
  neon: ['#ec4899', '#f472b6', '#fb7185', '#d946ef', '#fdf2f8'],
  sunset: ['#f97316', '#fb923c', '#ec4899', '#facc15', '#ef4444'],
  mono: ['#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#e4e4e7'],
}
const PRESETS = Object.keys(PRESET_LABELS) as Preset[]
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function defaults(p: Preset): Settings {
  const base: Settings = { preset: p, interaction: 'attract', palette: 'custom', count: 500, speed: 1, size: 3, hue: 260, radius: 150, strength: 2, trail: 0.6, bg: '#080810' }
  if (p === 'neon') return { ...base, hue: 190, trail: 0.85, size: 2.5 }
  if (p === 'orbit') return { ...base, hue: 320, count: 700, trail: 0.7, interaction: 'repel' }
  if (p === 'waves') return { ...base, hue: 200, count: 900, trail: 0.3, size: 3 }
  if (p === 'bloom') return { ...base, hue: 300, count: 900, trail: 0.5 }
  return base
}

export function randomize(s: Settings): Settings {
  const r = (k: NumKey) => {
    const [a, b, st] = LIMITS[k]
    return Number(clamp(Math.round((a + Math.random() * (b - a)) / st) * st, a, b).toFixed(2))
  }
  return { ...s, hue: r('hue'), speed: r('speed'), size: r('size'), count: Math.min(r('count'), 1500),
    strength: r('strength'), radius: r('radius'), trail: r('trail'),
    interaction: INTERACTIONS[Math.floor(Math.random() * INTERACTIONS.length)] }
}

/** Validates untrusted data (shared links, localStorage). Returns null if unusable. */
export function sanitize(raw: unknown): Settings | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!PRESETS.includes(r.preset as Preset)) return null
  const d = defaults(r.preset as Preset)
  const out: Settings = { ...d }
  ;(Object.keys(LIMITS) as NumKey[]).forEach((k) => {
    const v = r[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = clamp(v, LIMITS[k][0], LIMITS[k][1])
  })
  if (INTERACTIONS.includes(r.interaction as Interaction)) out.interaction = r.interaction as Interaction
  if ((Object.keys(PALETTE_LABELS) as PaletteId[]).includes(r.palette as PaletteId)) out.palette = r.palette as PaletteId
  if (typeof r.bg === 'string' && /^#[0-9a-f]{6}$/i.test(r.bg)) out.bg = r.bg
  return out
}

export class Engine {
  paused = false
  private ctx: CanvasRenderingContext2D
  private raf = 0
  private running = false
  private w = 1; private h = 1; private t = 0
  private px = -9999; private py = -9999; private pvx = 0; private pvy = 0
  private qDpr = 2; private qScale = 1; private n = 0
  private x = new Float32Array(0); private y = new Float32Array(0)
  private vx = new Float32Array(0); private vy = new Float32Array(0)
  private ox = new Float32Array(0); private oy = new Float32Array(0)
  private a = new Float32Array(0); private rad = new Float32Array(0)
  private pal: string[] = []
  private reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private canvas: HTMLCanvasElement, private s: Settings) {
    const c = canvas.getContext('2d')
    if (!c) throw new Error('Canvas 2D is not supported')
    this.ctx = c
    this.buildPalette()
    this.resize()
  }

  setSettings(s: Settings) {
    const rebuild = s.preset !== this.s.preset || s.count !== this.s.count
    this.s = s
    this.buildPalette()
    if (rebuild) this.init()
  }
  pointer(x: number, y: number) {
    const known = this.px > -1000 && x > -1000
    this.pvx = known ? clamp(x - this.px, -30, 30) : 0; this.pvy = known ? clamp(y - this.py, -30, 30) : 0 // pointer velocity for Trail
    this.px = x; this.py = y
  }
  setQuality(q: Quality) { this.qDpr = Q2D[q].dpr; this.qScale = Q2D[q].scale; this.resize() }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, this.qDpr)
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height)
    this.canvas.width = Math.floor(this.w * dpr); this.canvas.height = Math.floor(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.fillStyle = this.s.bg; this.ctx.fillRect(0, 0, this.w, this.h)
    this.init()
  }

  start() {
    if (this.running) return
    this.running = true
    const loop = () => {
      if (!this.running) return
      if (!this.paused && !document.hidden) this.frame()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf) }

  private buildPalette() {
    const fixed = this.s.palette === 'custom' ? null : PALETTES[this.s.palette]
    this.pal = Array.from({ length: 64 }, (_, i) =>
      fixed ? fixed[i % fixed.length] : `hsl(${(this.s.hue + i * 2.5) % 360} 90% ${55 + (i % 4) * 5}%)`)
  }

  private init() {
    const n = Math.min(3000, Math.max(20, Math.round(this.s.count * this.qScale)))
    this.n = n
    this.x = new Float32Array(n); this.y = new Float32Array(n)
    this.vx = new Float32Array(n); this.vy = new Float32Array(n)
    this.ox = new Float32Array(n); this.oy = new Float32Array(n)
    this.a = new Float32Array(n); this.rad = new Float32Array(n)
    const m = Math.min(this.w, this.h)
    for (let i = 0; i < n; i++) {
      this.x[i] = Math.random() * this.w; this.y[i] = Math.random() * this.h
      this.vx[i] = (Math.random() - 0.5) * 1.2; this.vy[i] = (Math.random() - 0.5) * 1.2
      this.a[i] = Math.random() * Math.PI * 2; this.rad[i] = 30 + Math.random() * m * 0.45
    }
  }

  private frame() {
    const { ctx, s, w, h } = this
    const sp = s.speed * (this.reduce ? 0.3 : 1)
    this.t += 0.01 * sp
    this.pvx *= 0.9; this.pvy *= 0.9
    const t = this.t
    ctx.globalAlpha = 1 - s.trail; ctx.fillStyle = s.bg; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1
    if (s.preset === 'waves') return this.waves(sp)
    if (s.preset === 'bloom') return this.bloom()
    const R = s.radius, R2 = R * R, active = s.interaction !== 'none'
    const cx = w / 2, cy = h / 2
    if (s.preset === 'neon') { ctx.lineWidth = s.size * 0.6; ctx.lineCap = 'round' }
    for (let i = 0; i < this.n; i++) {
      if (active) {
        const dx = this.px - this.x[i], dy = this.py - this.y[i], d2 = dx * dx + dy * dy
        if (d2 < R2 && d2 > 1) {
          const d = Math.sqrt(d2), f = (1 - d / R) * s.strength * 0.15, nx = dx / d, ny = dy / d
          if (s.interaction === 'attract') { this.ox[i] += nx * f; this.oy[i] += ny * f }
          else if (s.interaction === 'repel') { this.ox[i] -= nx * f; this.oy[i] -= ny * f }
          else if (s.interaction === 'trail') { this.ox[i] += this.pvx * f * 0.2; this.oy[i] += this.pvy * f * 0.2 } // drag with the pointer
          else { this.ox[i] -= ny * f; this.oy[i] += nx * f }
        }
      }
      let ang = 0
      if (s.preset === 'orbit') {
        this.a[i] += sp * 0.004 * (200 / this.rad[i] + 0.3)
        this.x[i] = cx + Math.cos(this.a[i]) * this.rad[i] + this.ox[i] * 12
        this.y[i] = cy + Math.sin(this.a[i]) * this.rad[i] * 0.7 + this.oy[i] * 12
      } else {
        let bx = this.vx[i], by = this.vy[i]
        if (s.preset === 'neon') {
          ang = (Math.sin(this.x[i] * 0.004 + t) + Math.cos(this.y[i] * 0.004 - t)) * Math.PI
          bx = Math.cos(ang) * 1.5; by = Math.sin(ang) * 1.5
        }
        this.x[i] += (bx + this.ox[i]) * sp; this.y[i] += (by + this.oy[i]) * sp
        if (this.x[i] < 0) this.x[i] += w; else if (this.x[i] > w) this.x[i] -= w
        if (this.y[i] < 0) this.y[i] += h; else if (this.y[i] > h) this.y[i] -= h
      }
      this.ox[i] *= 0.94; this.oy[i] *= 0.94
      ctx.fillStyle = ctx.strokeStyle = this.pal[i & 63]
      if (s.preset === 'neon') {
        ctx.beginPath(); ctx.moveTo(this.x[i], this.y[i])
        ctx.lineTo(this.x[i] - Math.cos(ang) * s.size * 4, this.y[i] - Math.sin(ang) * s.size * 4); ctx.stroke()
      } else ctx.fillRect(this.x[i], this.y[i], s.size, s.size)
    }
  }

  /** Phyllotaxis (golden-angle) bloom with breathing radius; not a strict recursive fractal. */
  private bloom() {
    const { ctx, s, w, h, t } = this
    const n = this.n, GA = 2.399963, k = (Math.min(w, h) * 0.46) / Math.sqrt(n), R = s.radius
    const cx = w / 2, cy = h / 2, active = s.interaction !== 'none'
    for (let i = 0; i < n; i++) {
      const r = k * Math.sqrt(i) * (1 + 0.15 * Math.sin(t * 2 + i * 0.05)), th = i * GA + t * 0.5
      let x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r
      if (active) {
        const dx = this.px - x, dy = this.py - y, d = Math.hypot(dx, dy)
        if (d < R && d > 1) {
          const f = (1 - d / R) * s.strength * 12, nx = dx / d, ny = dy / d
          if (s.interaction === 'attract') { x += nx * f; y += ny * f }
          else if (s.interaction === 'repel') { x -= nx * f; y -= ny * f }
          else if (s.interaction === 'trail') { x += this.pvx * f * 0.15; y += this.pvy * f * 0.15 }
          else { x -= ny * f; y += nx * f }
        }
      }
      ctx.fillStyle = this.pal[i & 63]
      ctx.beginPath(); ctx.arc(x, y, s.size * (0.4 + r / (k * Math.sqrt(n))), 0, 6.2832); ctx.fill()
    }
  }

  private waves(sp: number) {
    const { ctx, s, w, h, t } = this
    const layers = clamp(Math.round((s.count * this.qScale) / 150), 3, 16), amp = h * 0.18, R = s.radius
    ctx.lineWidth = s.size * 0.5 + 1
    const dir = s.interaction === 'repel' ? -1 : 1
    for (let l = 0; l < layers; l++) {
      ctx.strokeStyle = this.pal[(l * 4) & 63]; ctx.beginPath()
      for (let x = 0; x <= w; x += 6) {
        let y = h / 2 + (l - layers / 2) * 14 + Math.sin(x * 0.008 + t * 2 * sp + l * 0.5) * amp + Math.sin(x * 0.02 - t + l) * amp * 0.3
        if (s.interaction !== 'none') {
          const dx = x - this.px
          y += dir * (this.py - y) * Math.exp(-(dx * dx) / (R * R)) * s.strength * 0.1
        }
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
}
