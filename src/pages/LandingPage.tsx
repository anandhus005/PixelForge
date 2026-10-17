import { useEffect, useRef } from 'react'
import { Link } from '../router'
import { Engine, PRESET_LABELS, defaults, type Preset } from '../engine'

const BLURB: Record<Preset, string> = {
  cosmic: 'Slow drifting star-dust that reacts to your pointer.',
  neon: 'Particles riding a smooth, shifting flow field.',
  orbit: 'Concentric orbits you can push and swirl.',
  waves: 'Layered liquid waves with adjustable colour and speed.',
  bloom: 'A golden-angle flower that breathes and bends.',
}
const FEATURES: [string, string, string, number][] = [
  ['/studio', 'Generative Art', 'Five generative presets with live controls, undo and autosave.', 260],
  ['/studio?preset=cosmic', 'Particle Playground', 'Attract, repel, swirl or drag thousands of particles with your pointer.', 190],
  ['/3d', '3D Creative Studio', 'Dimension Studio: orbital sculptures, particle nebulae and kinetic geometry.', 300],
  ['/visualizer', 'Music Visualizer', 'Four visual modes driven by real audio analysis of your own file or microphone.', 20],
]
const BENEFITS = [
  ['Live customization', 'Every slider changes the artwork instantly. Undo and redo your experiments.'],
  ['Save, restore, remix', 'Autosave to your browser, duplicate, and remix any artwork without touching the original.'],
  ['Export and share', 'Download PNG images or settings files, or copy a link that recreates your artwork.'],
  ['Private by design', 'Everything runs in your browser. Audio you play never leaves your device.'],
]
const STEPS = [
  ['Choose a mode', 'Pick one of five generative presets, a 3D scene, or the music visualizer.'],
  ['Customize', 'Tune particles, colours, motion and how the artwork reacts to your pointer.'],
  ['Save, export or share', 'Keep it in your browser, download a PNG, or send a link.'],
]

export default function LandingPage() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    let e: Engine
    try { e = new Engine(c, { ...defaults('neon'), count: 250, interaction: 'none' }) } catch { return }
    e.start()
    const ro = new ResizeObserver(() => e.resize()); ro.observe(c)
    return () => { ro.disconnect(); e.stop() }
  }, [])
  return (
    <div className="landing">
      <header className="topnav">
        <div className="wrap nav-in">
          <Link to="/" className="logo">PixelForge</Link>
          <nav aria-label="Main" className="links">
            <a href="#modes">Explore</a><Link to="/studio">Playground</Link><Link to="/3d">3D Studio</Link><Link to="/gallery">Gallery</Link>
            <Link to="/visualizer">Visualizer</Link><a href="#about">About</a><Link to="/account">Sign in</Link>
          </nav>
          <Link to="/studio" className="btn primary">Start Creating</Link>
        </div>
      </header>
      <section className="hero2">
        <canvas ref={ref} aria-hidden="true" />
        <div className="hero-scrim" />
        <div className="wrap hero-in">
          <div className="hero-text">
            <h1>Your Imagination, In Motion.</h1>
            <p>Create mesmerizing digital art, explore immersive 3D worlds, and turn your imagination into interactive visual experiences.</p>
            <div className="row"><Link to="/studio" className="btn primary big">Start Creating</Link><Link to="/gallery" className="btn big">Explore Gallery</Link></div>
          </div>
        </div>
      </section>
      <section className="wrap sec">
        <h2>Four ways to create</h2>
        <div className="grid4">
          {FEATURES.map(([to, h, p, hue]) => (
            <Link key={h} to={to} className="card">
              <div className="thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 22%), hsl(${(hue + 70) % 360} 85% 45%))` }} />
              <h3>{h}</h3><p className="muted">{p}</p><span className="more">Open →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="wrap sec" id="modes">
        <h2>Creative presets</h2>
        <div className="grid5">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <Link key={p} to={`/studio?preset=${p}`} className="card">
              <div className="thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${defaults(p).hue} 80% 22%), hsl(${(defaults(p).hue + 70) % 360} 85% 45%))` }} />
              <h3>{PRESET_LABELS[p]}</h3><p className="muted">{BLURB[p]}</p><span className="more">Open in studio →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="wrap sec">
        <h2>Why PixelForge</h2>
        <div className="grid4">{BENEFITS.map(([h, p]) => <div className="card" key={h}><h3>{h}</h3><p className="muted">{p}</p></div>)}</div>
      </section>
      <section className="wrap sec">
        <h2>How it works</h2>
        <div className="grid3">{STEPS.map(([h, p], i) => <div className="card" key={h}><div className="num">{i + 1}</div><h3>{h}</h3><p className="muted">{p}</p></div>)}</div>
      </section>
      <section className="wrap sec" id="about">
        <h2>About PixelForge</h2>
        <p className="muted about">PixelForge is a browser-based creative playground built with React, TypeScript, Canvas 2D, Three.js and the Web Audio API. It works without an account: artwork is saved in your browser, and optional cloud saving is available when the site is connected to Supabase.</p>
      </section>
      <section className="wrap sec cta">
        <h2>Ready to make something?</h2>
        <div className="row"><Link to="/studio" className="btn primary big">Open the studio</Link><Link to="/3d" className="btn big">Try the 3D playground</Link><Link to="/visualizer" className="btn big">Music visualizer</Link></div>
      </section>
      <footer className="wrap foot2">
        <div><strong className="logo">PixelForge</strong><p className="muted">Create. Interact. Imagine.</p></div>
        <nav aria-label="Footer" className="links"><Link to="/studio">Playground</Link><Link to="/gallery">Gallery</Link><Link to="/3d">3D</Link><Link to="/visualizer">Visualizer</Link><Link to="/account">Account</Link></nav>
        <p className="muted small">Built with React, TypeScript, Canvas, Three.js and the Web Audio API.</p>
      </footer>
    </div>
  )
}
