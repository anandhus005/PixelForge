import { Suspense, lazy } from 'react'
import { Link, useLoc } from './router'
import LandingPage from './pages/LandingPage'
import StudioPage from './pages/StudioPage'
import GalleryPage from './pages/GalleryPage'
import AccountPage from './pages/AccountPage'

// Heavy / optional modules are code-split so the 2D studio never depends on them.
const Playground3D = lazy(() => import('./pages/Playground3D'))
const VisualizerPage = lazy(() => import('./pages/VisualizerPage'))
const loading = <main className="page"><p className="muted">Loading…</p></main>

export default function App() {
  const loc = useLoc()
  const path = loc.split('?')[0].replace(/\/+$/, '') || '/'
  // key = full URL so the studio re-initialises when the query changes (remix, open, preset)
  if (path === '/') return <LandingPage />
  if (path === '/studio') return <StudioPage key={loc} />
  if (path === '/gallery') return <GalleryPage />
  if (path === '/account') return <AccountPage />
  if (path === '/3d') return <Suspense fallback={loading}><Playground3D /></Suspense>
  if (path === '/visualizer') return <Suspense fallback={loading}><VisualizerPage /></Suspense>
  return <main className="page"><h1>Page not found</h1><Link to="/" className="btn">Back home</Link></main>
}
