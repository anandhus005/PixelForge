import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { cloudConfigured, getUser, onAuthChange } from './cloud'

/** Current Supabase user, or null (signed out / cloud not configured). */
export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    if (!cloudConfigured) return
    let dead = false, off = () => {}
    getUser().then((u) => { if (!dead) setUser(u) }).catch(() => {})
    onAuthChange(setUser).then((f) => { if (dead) f(); else off = f }).catch(() => {})
    return () => { dead = true; off() }
  }, [])
  return user
}
