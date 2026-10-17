import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('PixelForge UI error', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">Your saved artworks are untouched.</p>
        <button onClick={() => location.assign('/')}>Reload PixelForge</button>
      </main>
    )
  }
}
