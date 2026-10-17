import { useEffect, useMemo, useState } from 'react'
import { Link } from '../router'
import { PRESET_LABELS, defaults, type Preset } from '../engine'
import { deleteArtwork, duplicateArtwork, listArtworks } from '../storage'
import { cloudConfigured, deleteCloud, listMine, listPublic, type CloudArtwork } from '../cloud'

type Tab = 'examples' | 'mine' | 'community' | 'cloud'
interface Item { hue: number; id: string; title: string; preset: Preset; at: number; label: string; open: string; remix: string; local?: boolean; cloudOwn?: boolean }
const PRESETS = Object.keys(PRESET_LABELS) as Preset[]
const TAB_LABEL: Record<Tab, string> = { examples: 'Built-in examples', mine: 'My artworks (this browser)', community: 'Community (public cloud)', cloud: 'My cloud artworks' }
const EMPTY: Record<Tab, string> = {
  examples: 'No examples match.', mine: 'No saved artworks match. Create one in the studio and press Save.',
  community: 'No public artworks match.', cloud: 'No cloud artworks match.',
}

export default function GalleryPage() {
  const [tab, setTab] = useState<Tab>('examples')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Preset | 'all'>('all')
  const [sort, setSort] = useState<'new' | 'name'>('new')
  const [mine, setMine] = useState(listArtworks)
  const [cloud, setCloud] = useState<CloudArtwork[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (tab !== 'community' && tab !== 'cloud') return
    let dead = false
    setCloud([]); setErr(''); setLoading(true)
    ;(tab === 'cloud' ? listMine : listPublic)()
      .then((a) => { if (!dead) setCloud(a) })
      .catch((e) => { if (!dead) setErr(e instanceof Error ? e.message : 'Could not load artworks.') })
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [tab])

  const items = useMemo(() => {
    const base: Item[] = tab === 'mine'
      ? mine.map((a) => ({ id: a.id, title: a.title, preset: a.settings.preset, at: a.updatedAt, hue: a.settings.hue, local: true,
          label: 'Saved locally · ' + new Date(a.updatedAt).toLocaleDateString(), open: `/studio?id=${a.id}`, remix: `/studio?remix=${a.id}` }))
      : tab === 'examples'
        ? PRESETS.map((p) => ({ id: p, title: PRESET_LABELS[p] + ' (example)', preset: p, at: 0, hue: defaults(p).hue, label: 'Built-in example', open: `/studio?preset=${p}`, remix: `/studio?preset=${p}` }))
        : cloud.map((a) => ({ id: a.id, title: a.title, preset: a.settings.preset, at: a.updatedAt, hue: a.settings.hue, cloudOwn: tab === 'cloud',
            label: tab === 'cloud' ? `Cloud · ${a.visibility}` : 'Public cloud artwork', open: `/studio?cloud=${a.id}`, remix: `/studio?cloud=${a.id}` }))
    return base.filter((i) => (filter === 'all' || i.preset === filter) && i.title.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.at - a.at))
  }, [tab, mine, cloud, q, filter, sort])

  const act = (fn: () => ReturnType<typeof listArtworks>) => { try { setMine(fn()); setErr('') } catch { setErr('Storage action failed (storage may be full or blocked).') } }
  const delCloud = async (i: Item) => {
    if (!confirm(`Delete "${i.title}" from the cloud?`)) return
    try { await deleteCloud(i.id); setCloud((c) => c.filter((a) => a.id !== i.id)); setErr('') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Delete failed.') }
  }
  const tabs: Tab[] = cloudConfigured ? ['examples', 'mine', 'community', 'cloud'] : ['examples', 'mine']

  return (
    <div className="page">
      <nav className="nav"><Link to="/" className="logo">PixelForge</Link><Link to="/studio">Playground</Link><Link to="/account">Account</Link></nav>
      <h1>Gallery</h1>
      <div className="seg">
        {tabs.map((t) => <button key={t} aria-pressed={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}
      </div>
      <div className="filters">
        <input aria-label="Search artworks" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by preset" value={filter} onChange={(e) => setFilter(e.target.value as Preset | 'all')}>
          <option value="all">All presets</option>
          {PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'name')}>
          <option value="new">Newest</option><option value="name">Name</option>
        </select>
      </div>
      {loading && <p role="status" className="muted">Loading…</p>}
      {err && <p role="alert" className="err">{err}</p>}
      {!loading && !err && items.length === 0 && <p className="muted">{EMPTY[tab]}</p>}
      <div className="grid">
        {items.map((i) => (
          <div className="card" key={i.id}>
            <div className="thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${i.hue} 80% 22%), hsl(${(i.hue + 70) % 360} 85% 45%))` }} />
            <h3>{i.title}</h3>
            <p className="muted">{PRESET_LABELS[i.preset]} · {i.label}</p>
            <div className="seg">
              <Link to={i.open} className="btn">Open</Link>
              <Link to={i.remix} className="btn">Remix</Link>
              {i.local && <button onClick={() => act(() => duplicateArtwork(i.id))}>Duplicate</button>}
              {i.local && <button onClick={() => { if (confirm(`Delete "${i.title}"?`)) act(() => deleteArtwork(i.id)) }}>Delete</button>}
              {i.cloudOwn && <button onClick={() => void delCloud(i)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
