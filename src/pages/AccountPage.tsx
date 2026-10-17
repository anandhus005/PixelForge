import { useState, type FormEvent } from 'react'
import { Link } from '../router'
import { cloudConfigured, resetPassword, signIn, signOut, signUp } from '../cloud'
import { useUser } from '../useUser'

export default function AccountPage() {
  const user = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const validEmail = /^\S+@\S+\.\S+$/.test(email)

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg('')
    try { setMsg(await fn()) } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy(false) }
  }
  const needPassword = () => { if (!validEmail || password.length < 8) throw new Error('Enter a valid email and a password of at least 8 characters.') }
  const onSignIn = (e: FormEvent) => { e.preventDefault(); void run(async () => { needPassword(); await signIn(email, password); return 'Signed in.' }) }

  return (
    <div className="page">
      <nav className="nav"><Link to="/" className="logo">PixelForge</Link><Link to="/studio">Playground</Link><Link to="/gallery">Gallery</Link></nav>
      <h1>Account</h1>
      {!cloudConfigured && <p className="muted">Cloud features are not configured on this deployment. Everything else works in local mode, no account needed.</p>}
      {cloudConfigured && user && (
        <div>
          <p>Signed in as <strong>{user.email}</strong>.</p>
          <button disabled={busy} onClick={() => void run(async () => { await signOut(); return 'Signed out.' })}>Sign out</button>
        </div>
      )}
      {cloudConfigured && !user && (
        <form onSubmit={onSignIn} className="auth">
          <label>Email <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password <input type="password" autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <div className="row">
            <button type="submit" disabled={busy}>Sign in</button>
            <button type="button" disabled={busy} onClick={() => void run(async () => { needPassword(); await signUp(email, password); return 'Account created. Check your email to confirm it, then sign in.' })}>Create account</button>
            <button type="button" disabled={busy || !validEmail} onClick={() => void run(async () => { await resetPassword(email); return 'If that email has an account, a reset link was sent.' })}>Forgot password</button>
          </div>
        </form>
      )}
      {msg && <p role="status" aria-live="polite">{msg}</p>}
    </div>
  )
}
