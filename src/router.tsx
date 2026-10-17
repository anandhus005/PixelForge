import { useEffect, useState, type AnchorHTMLAttributes } from 'react'

const here = () => location.pathname + location.search
export function navigate(to: string) {
  history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
/** Current path + query; re-renders on navigation and browser back/forward. */
export function useLoc(): string {
  const [loc, setLoc] = useState(here)
  useEffect(() => {
    const on = () => setLoc(here())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  return loc
}
export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} {...rest} onClick={(e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault(); navigate(to)
  }} />
}
