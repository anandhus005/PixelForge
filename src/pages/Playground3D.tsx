import { useEffect, useRef, useState } from 'react'
import { Link } from '../router'
import { DimensionEngine } from '../graphics/dimension'
import { ARRANGEMENTS, MODES, PALETTES_3D, PARAM_LIMITS, clampParams, defaultParams, randomParams, type Arrangement, type Mode3D, type ParamKey, type Params3D } from '../graphics/params3d'
import { QUALITIES, QUALITY_LABEL, loadQuality, saveQuality, type Quality } from '../quality'
import { exportPng } from '../storage'

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

export default function Playground3D() {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<DimensionEngine | null>(null)
  const [mode, setMode] = useState<Mode3D>('sculpture')
  const [params, setParams] = useState<Params3D>(defaultParams)
  const [quality, setQuality] = useState<Quality>(loadQuality)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(() => !hasWebGL())
  const [status, setStatus] = useState('')
  const init = useRef({ mode, params, quality })

  // One engine per mounted page; everything else is pushed into it by the effects below.
  useEffect(() => {
    if (failed) return
    let e: DimensionEngine
    try { e = new DimensionEngine(host.current!, init.current.mode, init.current.quality, init.current.params) } catch { setFailed(true); return }
    e.onAdapt = (q) => { setQuality(q); saveQuality(q); setStatus(`Frame rate was low, so quality was lowered to ${QUALITY_LABEL[q]}.`) }
    e.onError = () => setFailed(true)
    engine.current = e
    return () => { e.dispose(); engine.current = null }
  }, [failed])
  useEffect(() => { engine.current?.setMode(mode) }, [mode])
  useEffect(() => { engine.current?.setParams(params) }, [params])
  useEffect(() => { engine.current?.setQuality(quality); saveQuality(quality) }, [quality])
  useEffect(() => { if (engine.current) engine.current.paused = paused }, [paused])

  const setP = (k: ParamKey, v: number) => setParams((p) => clampParams({ ...p, [k]: v }))
  const exportImage = async () => {
    const e = engine.current
    if (!e) return
    try { e.renderNow(); await exportPng(e.canvas, `pixelforge-3d-${mode}`); setStatus('PNG exported.') } catch { setStatus('PNG export failed.') }
  }
  const fullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    host.current?.requestFullscreen?.().catch(() => setStatus('Fullscreen is not available here.'))
  }
  const info = MODES[mode]

  return (
    <div className="page">
      <nav className="nav"><Link to="/" className="logo">PixelForge</Link><Link to="/studio">Playground</Link><Link to="/visualizer">Visualizer</Link><Link to="/gallery">Gallery</Link></nav>
      <h1>Dimension Studio</h1>
      <div className="seg" role="group" aria-label="3D experience">
        {(Object.keys(MODES) as Mode3D[]).map((m) => (
          <button key={m} aria-pressed={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{MODES[m].label}</button>
        ))}
      </div>
      <p className="muted">{info.blurb} Drag to orbit, scroll or pinch to zoom, move the pointer over the scene to interact.</p>
      {failed ? (
        <p role="alert" className="err">WebGL is not available (or the 3D renderer stopped), so Dimension Studio cannot run here. The 2D studio and the visualizer still work.</p>
      ) : (
        <div className="dim">
          <div className="gl" ref={host} aria-label="Interactive 3D scene" />
          <aside className="dim-panel" aria-label="3D controls">
            <h2>Palette</h2>
            <div className="seg">
              {PALETTES_3D.map((p) => <button key={p.id} onClick={() => setParams((q) => clampParams({ ...q, hue: p.hue, glow: p.glow }))}>{p.label}</button>)}
            </div>
            <h2>{info.label}</h2>
            {info.params.map((k) => (
              <label key={k}>{info.labels[k] ?? k} <output>{params[k]}</output>
                <input type="range" min={PARAM_LIMITS[k][0]} max={PARAM_LIMITS[k][1]} step={PARAM_LIMITS[k][2]} value={params[k]} onChange={(e) => setP(k, Number(e.target.value))} />
              </label>
            ))}
            {mode === 'kinetic' && (
              <div className="seg" role="group" aria-label="Arrangement">
                {ARRANGEMENTS.map((a: Arrangement) => (
                  <button key={a} aria-pressed={params.arrangement === a} className={params.arrangement === a ? 'on' : ''} onClick={() => setParams((p) => clampParams({ ...p, arrangement: a }))}>{a}</button>
                ))}
              </div>
            )}
            <h2>Render quality</h2>
            <div className="seg">
              {QUALITIES.map((q) => <button key={q} aria-pressed={quality === q} className={quality === q ? 'on' : ''} onClick={() => setQuality(q)}>{QUALITY_LABEL[q]}</button>)}
            </div>
            <p className="muted small">Glow (bloom) is rendered in High Quality. Performance lowers resolution and particle counts.</p>
            <h2>Actions</h2>
            <div className="seg">
              <button onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</button>
              <button onClick={() => engine.current?.resetCamera()}>Reset camera</button>
              <button onClick={() => setParams(randomParams())}>Randomize</button>
              <button onClick={() => setParams(defaultParams())}>Reset</button>
              <button onClick={() => void exportImage()}>Export PNG</button>
              <button onClick={fullscreen}>Fullscreen</button>
            </div>
          </aside>
        </div>
      )}
      <p role="status" aria-live="polite" className="muted">{status}</p>
    </div>
  )
}
