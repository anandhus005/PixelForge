import { useEffect, useRef, useState } from 'react'
import { Link } from '../router'
import { AudioEngine, levelsFrom, type Levels } from '../audio'

type Mode = 'pulse' | 'bars' | 'wave' | 'circle'
type Source = 'none' | 'file' | 'mic'
const MODE_LABEL: Record<Mode, string> = { pulse: 'Particle pulse', bars: 'Frequency spectrum', wave: 'Waveform', circle: 'Circular audio field' }
const TAU = Math.PI * 2

export default function VisualizerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cfg = useRef({ mode: 'pulse' as Mode, hue: 260, sens: 1, motion: 1 }) // read every frame, so no re-render per change
  const [mode, setMode] = useState<Mode>('pulse')
  const [hue, setHue] = useState(260)
  const [sens, setSens] = useState(1)
  const [motion, setMotion] = useState(1)
  const [source, setSource] = useState<Source>('none')
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('Choose an audio file or use your microphone. Audio stays on your device.')

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')
    if (!ctx) { setStatus('Canvas is not supported in this browser.'); return }
    const eng = new AudioEngine(); engineRef.current = eng
    const lv: Levels = { bass: 0, mid: 0, treble: 0, volume: 0 }
    let raf = 0, w = 1, h = 1, rot = 0
    const resize = () => {
      const r = c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, r.width); h = Math.max(1, r.height)
      c.width = Math.floor(w * d); c.height = Math.floor(h * d); ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(c)
    const bin = (frac: number) => eng.freq[Math.min(eng.freq.length - 1, Math.floor(frac * eng.freq.length))] / 255
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      const { mode: m, hue: hue0, sens: k, motion: mv } = cfg.current
      eng.sample(); levelsFrom(eng.freq, lv)
      lv.bass = Math.min(1, lv.bass * k); lv.mid = Math.min(1, lv.mid * k); lv.treble = Math.min(1, lv.treble * k); lv.volume = Math.min(1, lv.volume * k)
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#080810'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1
      const s = Math.min(w, h)
      if (m === 'bars') {
        const n = 64, bw = w / n
        for (let i = 0; i < n; i++) {
          const v = Math.min(1, bin(Math.pow(i / n, 1.6) * 0.75) * k)
          ctx.fillStyle = `hsl(${(hue0 + v * 80) % 360} 90% ${40 + v * 30}%)`
          ctx.fillRect(i * bw + 1, h - v * h * 0.85, bw - 2, v * h * 0.85)
        }
      } else if (m === 'wave') {
        ctx.lineWidth = 2 + lv.volume * 6
        ctx.strokeStyle = `hsl(${(hue0 + lv.treble * 200) % 360} 90% ${50 + lv.volume * 35}%)`
        ctx.beginPath()
        const n = eng.wave.length
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * w, y = h / 2 + ((eng.wave[i] - 128) / 128) * h * 0.4 * Math.min(2, k)
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
      } else if (m === 'circle') {
        rot += (0.002 + lv.mid * 0.02) * mv
        const cx = w / 2, cy = h / 2, r0 = s * 0.2 + lv.bass * s * 0.05, N = 120
        ctx.lineWidth = Math.max(2, ((TAU * r0) / N) * 0.6); ctx.lineCap = 'round'
        for (let i = 0; i < N; i++) {
          const v = Math.min(1, bin(Math.pow(i / N, 1.5) * 0.7) * k), a = (i / N) * TAU + rot
          ctx.strokeStyle = `hsl(${(hue0 + i * 2.5 + lv.treble * 60) % 360} 90% ${45 + v * 35}%)`
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
          ctx.lineTo(cx + Math.cos(a) * (r0 + 2 + v * s * 0.28), cy + Math.sin(a) * (r0 + 2 + v * s * 0.28)); ctx.stroke()
        }
        ctx.fillStyle = `hsla(${hue0} 90% 60% / ${0.1 + lv.volume * 0.35})`
        ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.9, 0, TAU); ctx.fill()
      } else {
        rot += (0.003 + lv.mid * 0.05) * mv
        const N = 180
        for (let i = 0; i < N; i++) {
          const a = (i / N) * TAU + rot, r = s * 0.18 + lv.bass * s * 0.3 + Math.sin(i * 0.7 + rot * 10) * lv.mid * 30
          ctx.fillStyle = `hsl(${(hue0 + lv.treble * 120 + i) % 360} 90% ${45 + lv.volume * 40}%)`
          ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2 + lv.bass * 5, 0, TAU); ctx.fill()
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); eng.stop(); engineRef.current = null }
  }, [])

  const start = async (fn: () => Promise<void>, src: Source, ok: string) => {
    try { await fn(); setSource(src); setPlaying(src === 'file' || src === 'mic'); setStatus(ok) }
    catch (e) { setSource('none'); setPlaying(false); setStatus(e instanceof Error ? e.message : 'Audio failed.') }
  }
  const stop = () => { engineRef.current?.stop(); setSource('none'); setPlaying(false); setStatus('Stopped. Microphone and audio resources released.') }
  const togglePlay = async () => {
    try { const p = await engineRef.current?.togglePlay(); setPlaying(Boolean(p)); setStatus(p ? 'Playing.' : 'Paused.') }
    catch { setStatus('Playback failed. Try choosing the file again.') }
  }

  return (
    <div className="page">
      <nav className="nav"><Link to="/" className="logo">PixelForge</Link><Link to="/studio">Playground</Link><Link to="/3d">3D Studio</Link><Link to="/gallery">Gallery</Link></nav>
      <h1>Music Visualizer</h1>
      <canvas ref={canvasRef} className="viz" aria-label="Audio visualizer" />
      <div className="row">
        <button onClick={() => fileRef.current?.click()}>Choose audio file</button>
        <button onClick={() => void start(async () => { await engineRef.current?.useMic() }, 'mic', 'Listening to the microphone.')}>Use microphone</button>
        <button onClick={() => void togglePlay()} disabled={source !== 'file'}>{playing ? 'Pause' : 'Play'}</button>
        <button onClick={stop} disabled={source === 'none'}>Stop</button>
        <input ref={fileRef} type="file" accept="audio/*" hidden aria-label="Audio file"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void start(async () => { await engineRef.current?.useFile(f) }, 'file', `Playing "${f.name}".`) }} />
      </div>
      <div className="row">
        <label>Mode <select value={mode} onChange={(e) => { const m = e.target.value as Mode; setMode(m); cfg.current.mode = m }}>
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </select></label>
        <label>Hue <input type="range" min={0} max={360} value={hue} onChange={(e) => { const v = Number(e.target.value); setHue(v); cfg.current.hue = v }} /></label>
        <label>Sensitivity <input type="range" min={0.5} max={3} step={0.1} value={sens} onChange={(e) => { const v = Number(e.target.value); setSens(v); cfg.current.sens = v }} /></label>
        <label>Motion <input type="range" min={0} max={3} step={0.1} value={motion} onChange={(e) => { const v = Number(e.target.value); setMotion(v); cfg.current.motion = v }} /></label>
      </div>
      <p role="status" aria-live="polite" className="muted">{status}</p>
    </div>
  )
}
