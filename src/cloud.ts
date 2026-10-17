import type { SupabaseClient, User } from '@supabase/supabase-js'
import { sanitize, type Settings } from './engine'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
/** False when env vars are missing: the app then runs in local mode and never loads Supabase. */
export const cloudConfigured = Boolean(URL_ && KEY)

export type Visibility = 'private' | 'public'
export interface CloudArtwork { id: string; ownerId: string; title: string; settings: Settings; visibility: Visibility; updatedAt: number }

let cached: Promise<SupabaseClient> | null = null
function client(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Cloud features are not configured.'))
  cached ??= import('@supabase/supabase-js').then((m) => m.createClient(URL_!, KEY!))
  return cached
}
/** Logs details for developers, shows a safe message to users. */
function fail(error: { code?: string; message: string }): never {
  console.error('Cloud error', error)
  throw new Error(error.code === '42501' ? 'You do not have permission to do that.' : 'The cloud request failed. Please try again.')
}
async function currentUser(c: SupabaseClient): Promise<User | null> {
  return (await c.auth.getSession()).data.session?.user ?? null
}

// ---- auth ----
export async function getUser(): Promise<User | null> { return currentUser(await client()) }
export async function onAuthChange(cb: (u: User | null) => void): Promise<() => void> {
  const { data } = (await client()).auth.onAuthStateChange((_e, s) => cb(s?.user ?? null))
  return () => data.subscription.unsubscribe()
}
export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await (await client()).auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/account` } })
  if (error) throw new Error(error.message)
}
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await client()).auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}
export async function signOut(): Promise<void> {
  const { error } = await (await client()).auth.signOut()
  if (error) throw new Error(error.message)
}
/** Only sends the reset email; setting a new password after the link is not built yet. */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await (await client()).auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/account` })
  if (error) throw new Error(error.message)
}

// ---- artworks (authorization is enforced by Row Level Security, see supabase/migrations) ----
const COLS = 'id, owner_id, title, settings, visibility, updated_at'
interface Row { id: string; owner_id: string; title: string; settings: unknown; visibility: Visibility; updated_at: string }
const toArt = (r: Row): CloudArtwork[] => {
  const s = sanitize(r.settings) // never trust stored JSON either
  return s ? [{ id: r.id, ownerId: r.owner_id, title: r.title, settings: s, visibility: r.visibility, updatedAt: Date.parse(r.updated_at) }] : []
}

export async function saveCloud(title: string, settings: Settings, visibility: Visibility, id?: string): Promise<string> {
  const c = await client(), user = await currentUser(c)
  if (!user) throw new Error('Sign in to save to the cloud.')
  const row = { title: title.trim().slice(0, 80) || 'Untitled', preset: settings.preset, settings, visibility }
  const q = id ? c.from('artworks').update(row).eq('id', id) : c.from('artworks').insert({ ...row, owner_id: user.id })
  const { data, error } = await q.select('id').single() // 0 affected rows => error, never a false "saved"
  if (error) fail(error)
  return data.id as string
}
export async function listPublic(): Promise<CloudArtwork[]> {
  const { data, error } = await (await client()).from('artworks').select(COLS)
    .eq('visibility', 'public').order('updated_at', { ascending: false }).limit(60)
  if (error) fail(error)
  return (data as Row[]).flatMap(toArt)
}
export async function listMine(): Promise<CloudArtwork[]> {
  const c = await client(), user = await currentUser(c)
  if (!user) throw new Error('Sign in to see your cloud artworks.')
  const { data, error } = await c.from('artworks').select(COLS).eq('owner_id', user.id).order('updated_at', { ascending: false })
  if (error) fail(error)
  return (data as Row[]).flatMap(toArt)
}
export async function getCloud(id: string): Promise<CloudArtwork | null> {
  const { data, error } = await (await client()).from('artworks').select(COLS).eq('id', id).maybeSingle()
  if (error) fail(error)
  return data ? toArt(data as Row)[0] ?? null : null // private artworks of others are invisible => null
}
export async function deleteCloud(id: string): Promise<void> {
  const { data, error } = await (await client()).from('artworks').delete().eq('id', id).select('id')
  if (error) fail(error)
  if (!data || data.length === 0) throw new Error('Nothing was deleted (not found or not yours).')
}
