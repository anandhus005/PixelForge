# PixelForge — Create. Interact. Imagine.

A browser-based generative art playground (React + TypeScript + Vite, Canvas 2D).

## Implemented (v0.7)
- Routes `/`, `/studio`, `/gallery` (tiny built-in router); `vercel.json` rewrites for refresh on nested routes
- 5 presets: Cosmic Drift, Neon Flow, Orbit Field, Liquid Waves, Fractal Bloom (phyllotaxis-based, not a strict recursive fractal)
- 6 palette options (Custom hue + 5 fixed palettes), live controls, pointer modes (attract / repel / orbit / none)
- Undo / Redo (bounded to 50 steps, slider drags coalesce into one step); Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Space = pause, R = randomize
- LocalStorage save / load / duplicate / delete, autosave (1.5 s debounce, only for saved/opened artworks)
- PNG export; share links (`/studio?s=...`); settings JSON export/import (validated, 20 KB limit)
- Gallery: built-in examples + local artworks, search / filter / sort, Open, Remix, Duplicate, Delete
- Music visualizer (`/visualizer`): audio file or microphone via Web Audio `AnalyserNode`; four modes (particle pulse, frequency spectrum, waveform, circular audio field), play/pause, hue, sensitivity and motion controls; resources released on stop/leave
- Dimension Studio (`/3d`, plain Three.js): three distinct experiences (Orbital Sculpture, Particle Nebula with a GPU shader, Kinetic Geometry with instanced meshes), palette presets, per-mode controls, Performance / Balanced / High Quality (resolution, particle budgets, bloom; automatic step-down when frames are slow), camera reset, pause, randomize, PNG export of the rendered scene, fullscreen, WebGL-unavailable fallback. NOT yet verified in a real WebGL browser by the author
- Optional Supabase cloud (`/account`): email/password sign-up, sign-in, sign-out, password-reset email; cloud save (private/public), public community tab, "My cloud artworks" with delete; Row Level Security in `supabase/migrations/`. Cloud code is written but NOT tested against a real project
- Mobile studio uses bottom sheets (Modes / Settings buttons)
- ESLint config + `npm run lint` (not yet run)
- Redesigned full-width landing page (sticky nav, readable hero, modes, benefits, how-it-works, footer), gallery card previews, dismissible first-visit tip in the studio
- 2D studio: Trail pointer mode (particles follow pointer movement; in Liquid Waves it behaves like Attract) and Render quality (Performance / Balanced / High Quality: resolution and particle budget)
- Error boundary, favicon and page metadata, GitHub Actions CI (`.github/workflows/ci.yml`, needs a committed `package-lock.json`)

## Not implemented yet
Favorites/likes, unlisted links, set-new-password screen after a reset email, editing your own cloud artwork in place (opening always makes a copy), cloud thumbnails, high-resolution PNG export, PWA, React component tests, React Three Fiber (plain Three.js is used instead).

## Future improvements
Favorites/likes and unlisted links (needs a secure token design), set-new-password screen, real thumbnails saved with each artwork, quality presets (Performance / Balanced / High), 3D PNG export, PWA install support, React component tests, upgrade of dev tooling (vite/vitest) to clear `npm audit` dev-dependency advisories.

## Security notes
- No secrets in the repo; only the public Supabase URL and publishable key are used by the frontend. Authorization is enforced by Row Level Security (`supabase/migrations/`), not by hidden buttons.
- Imported JSON, share links, saved artwork and cloud rows all pass through `sanitize()`; audio never leaves the browser.
- `npm audit` (run by the project owner) reported 6 advisories, all in development tooling (vitest, vite, esbuild dev server, tinypool); none are part of the built `dist`. Do not run `npm audit fix --force`. To clear them, upgrade `vite`, `vitest` and `@vitejs/plugin-react` together on a branch, then rerun typecheck, lint, test, build and e2e.

## End-to-end tests
`e2e/pixelforge.e2e.cjs` (Playwright) drives the real app: landing, studio layout, all 5 presets, controls, pointer repel/attract, pause, undo/redo, keyboard, save/reload/autosave, PNG and JSON export/import, share links, gallery + remix, 404, 360/390/768/1366/1920px layouts, mobile bottom sheets, audio visualizer with a generated WAV file.
Run: `npm run build`, `npm run preview` (terminal 1), `npx playwright install chromium` once, then `npm run e2e` (terminal 2).
The suite also contains a 3D check (each mode renders, hue changes the scene, pause freezes it, quality levels, PNG export); it skips itself when the browser has no WebGL. These checks were executed by the author only against an esbuild bundle in a sandbox (React 19, no Vite build, 3D check skipped because three.js was not installed there). Supabase is not covered.

## Supabase setup
1. Create a project at supabase.com. 2. SQL Editor: paste and run `supabase/migrations/20260101000000_pixelforge_artworks.sql`.
3. Project Settings > API: copy the Project URL and the publishable (anon) key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). Never use the service_role key.
4. Authentication > URL Configuration: Site URL `http://localhost:5173` for local work; add redirect URLs `http://localhost:5173/account` and `https://YOUR-VERCEL-DOMAIN/account` (and set the Site URL to the production domain for production).
5. Add the same two variables in Vercel > Project Settings > Environment Variables, then redeploy.

## Commands
```
npm install
npm run dev        # development
npm run typecheck
npm run lint
npm test
npm run build      # outputs dist/
npm run preview
```
Deploy: Vercel, build command `npm run build`, output directory `dist`. No env variables needed.
