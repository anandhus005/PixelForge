import { useEffect, useRef, useState } from 'react'
import { Engine, LIMITS, INTERACTIONS, PRESET_LABELS, PALETTE_LABELS, defaults, randomize, sanitize, type NumKey, type PaletteId, type Preset, type Settings } from '../engine'
import { Link } from '../router'
import { commit, createHistory, redo, undo } from '../history'
import { QUALITIES, QUALITY_LABEL, loadQuality, saveQuality, type Quality } from '../quality'
import { cloudConfigured, getCloud, saveCloud, type Visibility } from '../cloud'
import { useUser } from '../useUser'
import { MAX_CONFIG_BYTES, decodeShare, deleteArtwork, duplicateArtwork, encodeShare, exportPng, listArtworks, saveArtwork, exportConfigJson, parseConfigJson, downloadText } from '../storage'

interface Init { settings: Settings; msg: string; id?: string; title?: string }
function loadInitial(): Init {
  const q = new URLSearchParams(location.search)
  const tok = q.get('s')
  if (tok) {
    const s = decodeShare(tok)
    return s ? { settings: s, msg: 'Loaded shared artwork configuration.' }
             : { settings: defaults('cosmic'), msg: 'The shared link is invalid or too large. Showing defaults.' }
  }
  const id = q.get('id') ?? q.get('remix')
  if (id) {
    const a = listArtworks().find((x) => x.id === id)
    if (!a) return { settings: defaults('cosmic'), msg: 'That artwork was not found in this browser.' }
    return q.get('remix')
      ? { settings: a.settings, title: a.title + ' (remix)', msg: 'Remix started. Saving creates a new artwork; the original is unchanged.' }
      : { settings: a.settings, title: a.title, id: a.id, msg: '' }
  }
  const p = sanitize({ preset: q.get('preset') })
  return { settings: p ?? defaults('cosmic'), msg: '' }
}

export default function StudioPage() {
  const [init] = useState(loadInitial)
  const [hist, setHist] = useState(() => createHistory(init.settings))
  const settings = hist.present
  const lastEdit = useRef(0)
  const setSettings = (u: Settings | ((s: Settings) => Settings)) => {
    const now = Date.now(), gap = now - lastEdit.current
    lastEdit.current = now
    setHist((h) => commit(h, typeof u === 'function' ? u(h.present) : u, gap))
  }
  const [title, setTitle] = useState(init.title ?? 'Untitled artwork')
  const [currentId, setCurrentId] = useState<string | undefined>(init.id)
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState(init.msg)
  const [saved, setSaved] = useState(listArtworks)
  const [sheet, setSheet] = useState<'modes' | 'controls' | null>(null) // mobile bottom sheets
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [cloudId, setCloudId] = useState<string | undefined>()
  const user = useUser()
  const [quality, setQuality] = useState<Quality>(loadQuality)
  const [tip, setTip] = useState(() => { try { return localStorage.getItem('pixelforge.tip.v1') !== '1' } catch { return false } })
  const dismissTip = () => { setTip(false); try { localStorage.setItem('pixelforge.tip.v1', '1') } catch { /* storage unavailable: tip may show again */ } }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const first = useRef(settings)

  useEffect(() => {
    const c = canvasRef.current!
    let e: Engine
    try { e = new Engine(c, first.current) } catch { setStatus('Your browser cannot start the canvas renderer.'); return }
    engineRef.current = e; e.start()
    const ro = new ResizeObserver(() => e.resize()); ro.observe(c)
    return () => { ro.disconnect(); e.stop(); engineRef.current = null }
  }, [])
  useEffect(() => { engineRef.current?.setSettings(settings) }, [settings])
  useEffect(() => { engineRef.current?.setQuality(quality); saveQuality(quality) }, [quality])
  useEffect(() => { if (engineRef.current) engineRef.current.paused = paused }, [paused])

  const randomizeNow = () => setSettings((s) => randomize(s))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (el.matches('input:not([type=range]):not([type=color]),textarea,select')) return // keep native text undo
        e.preventDefault(); setHist(e.shiftKey ? redo : undo); return
      }
      if (el.closest('input,textarea,select,button')) return
      if (e.code === 'Space') { e.preventDefault(); setPaused((p) => !p) }
      else if (e.key.toLowerCase() === 'r') setHist((h) => commit(h, randomize(h.present), Infinity)) // one undo step
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }))
  const choosePreset = (p: Preset) => { setSettings(defaults(p)); setCurrentId(undefined) }

  const save = () => {
    try { const r = saveArtwork(title, settings, currentId); setSaved(r.list); setCurrentId(r.id); setStatus('Saved to this browser (LocalStorage).') }
    catch { setStatus('Could not save: browser storage is full or blocked.') }
  }
  const run = (fn: () => ReturnType<typeof listArtworks>) => { try { setSaved(fn()) } catch { setStatus('Storage action failed.') } }
  const share = async () => {
    const url = `${location.origin}/studio?s=${encodeShare(settings)}`
    try { await navigator.clipboard.writeText(url); setStatus('Link copied. It contains the encoded settings (no server involved).') }
    catch { setStatus('Copy failed. Link: ' + url) }
  }
  const exportImg = async () => {
    try { await exportPng(canvasRef.current!, title); setStatus('PNG exported.') } catch { setStatus('PNG export failed.') }
  }
  const importRef = useRef<HTMLInputElement>(null)
  const exportJson = () => {
    downloadText((title.replace(/[^\w-]+/g, '_') || 'pixelforge') + '.pixelforge.json', exportConfigJson(title, settings))
    setStatus('Settings exported as a JSON file.')
  }
  const importJson = async (f?: File) => {
    if (!f) return
    if (f.size > MAX_CONFIG_BYTES) { setStatus('That file is too large to be a PixelForge settings file.'); return }
    try {
      const r = parseConfigJson(await f.text())
      if (!r) { setStatus('Not a valid PixelForge settings file.'); return }
      setSettings(r.settings); setTitle(r.title); setCurrentId(undefined)
      setStatus(`Imported "${r.title}". Press Save to keep it.`)
    } catch { setStatus('Could not read that file.') }
  }
  // Autosave: only for artworks that are already saved/opened; the cleanup cancels stale timers.
  useEffect(() => {
    if (!currentId) return
    const t = setTimeout(() => {
      const cur = listArtworks().find((a) => a.id === currentId)
      if (!cur || (cur.title === title && JSON.stringify(cur.settings) === JSON.stringify(settings))) return
      try { setSaved(saveArtwork(title, settings, currentId).list); setStatus('Autosaved locally.') }
      catch { setStatus('Autosave failed: browser storage is full or blocked.') }
    }, 1500)
    return () => clearTimeout(t)
  }, [settings, title, currentId])
  // ?cloud=<id>: open a cloud artwork as a remix (saving always creates your own copy)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('cloud')
    if (!id) return
    getCloud(id)
      .then((a) => {
        if (!a) { setStatus('That cloud artwork was not found, or it is private.'); return }
        setSettings(a.settings); setTitle(a.title + ' (remix)'); setStatus('Cloud artwork loaded as a remix. Saving creates your own copy.')
      })
      .catch(() => setStatus('Could not load the cloud artwork.'))
  }, [])
  const saveToCloud = async () => {
    try { const id = await saveCloud(title, settings, visibility, cloudId); setCloudId(id); setStatus(`Saved to the cloud (${visibility}).`) }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Cloud save failed.') }
  }
  const fullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    stageRef.current?.requestFullscreen?.().catch(() => setStatus('Fullscreen is not available here.'))
  }

  return (
    <div className="app">
      <header className="bar">
        <Link to="/" className="logo">PixelForge</Link><Link to="/gallery">Gallery</Link><Link to="/3d">3D</Link><Link to="/visualizer">Visualizer</Link><Link to="/account">Account</Link><span className="tag">Create. Interact. Imagine.</span>
        <input aria-label="Artwork title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <button onClick={save}>Save</button><button onClick={exportImg}>Export PNG</button><button onClick={share}>Share</button>
        {cloudConfigured && user && <>
          <select aria-label="Cloud visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="private">Private</option><option value="public">Public</option>
          </select>
          <button onClick={() => void saveToCloud()}>Save to cloud</button>
        </>}
        {cloudConfigured && !user && <Link to="/account">Sign in for cloud save</Link>}
      </header>
      <aside className={`panel left${sheet === 'modes' ? ' open' : ''}`}>
        <button className="mobile-only" onClick={() => setSheet(null)}>Close</button>
        <h2>Presets</h2>
        {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
          <button key={p} aria-pressed={settings.preset === p} className={settings.preset === p ? 'on' : ''} onClick={() => choosePreset(p)}>{PRESET_LABELS[p]}</button>
        ))}
        <h2>My artworks</h2>
        {saved.length === 0 && <p className="muted">Nothing saved yet.</p>}
        {saved.map((a) => (
          <div className="item" key={a.id}>
            <span>{a.title}</span>
            <button onClick={() => { setSettings(a.settings); setTitle(a.title); setCurrentId(a.id) }}>Load</button>
            <button onClick={() => run(() => duplicateArtwork(a.id))}>Copy</button>
            <button onClick={() => { if (confirm(`Delete "${a.title}"?`)) run(() => deleteArtwork(a.id)) }}>Del</button>
          </div>
        ))}
        <h2>Settings file</h2>
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => importRef.current?.click()}>Import JSON</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden aria-label="Import settings JSON"
          onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = '' }} />
      </aside>
      <main className="stage" ref={stageRef}>
        {tip && (
          <div className="tip" role="note">
            <span>Move your pointer over the artwork to interact. Space = pause, R = randomize, Ctrl+Z = undo. Settings are on the right.</span>
            <button onClick={dismissTip}>Got it</button>
          </div>
        )}
        <canvas ref={canvasRef} aria-label="Interactive artwork"
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); engineRef.current?.pointer(e.clientX - r.left, e.clientY - r.top) }}
          onPointerLeave={() => engineRef.current?.pointer(-9999, -9999)} />
      </main>
      <aside className={`panel right${sheet === 'controls' ? ' open' : ''}`}>
        <button className="mobile-only" onClick={() => setSheet(null)}>Close</button>
        <h2>Controls</h2>
        <label>palette <select value={settings.palette} onChange={(e) => set('palette', e.target.value as PaletteId)}>
          {(Object.keys(PALETTE_LABELS) as PaletteId[]).map((p) => <option key={p} value={p}>{PALETTE_LABELS[p]}</option>)}
        </select></label>
        {(Object.keys(LIMITS) as NumKey[]).map((k) => (
          <label key={k}>{k} <output>{settings[k]}</output>
            <input type="range" min={LIMITS[k][0]} max={LIMITS[k][1]} step={LIMITS[k][2]} value={settings[k]} disabled={k === 'hue' && settings.palette !== 'custom'} onChange={(e) => set(k, Number(e.target.value))} />
          </label>
        ))}
        <label>background <input type="color" value={settings.bg} onChange={(e) => set('bg', e.target.value)} /></label>
        <h2>Pointer</h2>
        <div className="seg">{INTERACTIONS.map((i) => (
          <button key={i} aria-pressed={settings.interaction === i} className={settings.interaction === i ? 'on' : ''} onClick={() => set('interaction', i)}>{i}</button>
        ))}</div>
        <h2>Render quality</h2>
        <div className="seg">{QUALITIES.map((q) => (
          <button key={q} aria-pressed={quality === q} className={quality === q ? 'on' : ''} onClick={() => setQuality(q)}>{QUALITY_LABEL[q]}</button>
        ))}</div>
        <p className="muted small">Performance draws half the particles at 1x resolution; High Quality draws 1.5x at full resolution.</p>
      </aside>
      <footer className="bar">
        <button onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</button>
        <button onClick={randomizeNow}>Randomize</button>
        <button onClick={() => setSettings(defaults(settings.preset))}>Reset</button>
        <button className="mobile-only" onClick={() => setSheet((s) => (s === 'modes' ? null : 'modes'))}>Modes</button>
        <button className="mobile-only" onClick={() => setSheet((s) => (s === 'controls' ? null : 'controls'))}>Settings</button>
        <button onClick={() => setHist(undo)} disabled={hist.past.length === 0}>Undo</button>
        <button onClick={() => setHist(redo)} disabled={hist.future.length === 0}>Redo</button>
        <button onClick={fullscreen}>Fullscreen</button>
        <span role="status" aria-live="polite" className="muted">{status}</span>
      </footer>
    </div>
  )
}
