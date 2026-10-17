# PixelForge — Run cheyyaan, Host cheyyaan (Manglish guide)

## 1. Node.js install
https://nodejs.org il poyi LTS version download cheythu install cheyyuka. Pinne PowerShell thurannu check cheyyuka:
```
node -v
npm -v
```
Randum version number kaanikkanam.

## 2. ZIP extract cheythu VS Code-il open cheyyuka
`PixelForge_Project.zip` right-click -> Extract All. Pinne VS Code-il **File -> Open Folder -> pixelforge**.
Terminal: **Terminal -> New Terminal**. Ee terminal project root-il (package.json ulla folder) aayirikkanam.

## 3. Dependencies install cheyyuka (project root-il)
```
npm install
```
Ithu node_modules folder undaakkum, package-lock.json um create cheyyum (ZIP-il lock file illa, kaaranam ente environment-il internet illaayirunnu).

## 4. Run cheyyuka
```
npm run dev
```
Terminal-il kaanikkunna URL (usually http://localhost:5173) browser-il open cheyyuka. Nirthaan Ctrl + C. Veendum thudangaan `npm run dev`.

## 5. Test, build, preview
```
npm run typecheck
npm test
npm run build
npm run preview
```
`npm run build` kazhinjaal `dist` folder undaakum — ithaanu production files.

## 6. GitHub-il push cheyyuka
github.com il new repository undaakkuka (README add cheyyaruthu). Pinne project root-il:
```
git init
git add .
git commit -m "PixelForge v0.1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pixelforge.git
git push -u origin main
```
`.env` file `.gitignore` il ullathu kondu push aavilla.

## 7. Vercel-il host cheyyuka
1. vercel.com -> GitHub vechu sign up.
2. **Add New -> Project** -> pixelforge repo **Import**.
3. Framework: Vite. Build Command: `npm run build`. Output Directory: `dist`.
4. **Deploy** click cheyyuka. Environment variables ippo venda.
5. Code maattiyaal: `git add .`, `git commit -m "msg"`, `git push` — Vercel thaane redeploy cheyyum.

## 8. Local mode vs Cloud mode
Ippo ulla version **local mode** maathram. Save cheyyunnathu ninte browser-il (LocalStorage) aanu; browser data clear cheythaal poyi. Supabase login/cloud save ee version-il **illa**.

## 9. Common errors
- `npm is not recognized` -> Node install cheythu, terminal close cheythu veendum thurakkuka.
- Port already in use -> vere terminal-il `npm run dev` odunnundakum; ath Ctrl + C cheyyuka.
- `npm install` fail -> internet check cheyyuka; `node -v` 18 or kooduthal aano ennu nokkuka.

## 10. v0.2-il maattangal
- Ippo pages: `/` (landing), `/studio`, `/gallery`. `vercel.json` undu, athu kondu Vercel-il `/studio` refresh cheythaalum 404 varilla.
- Share link ippo `/studio?s=...` format aanu. Pazhaya `#s=` links work cheyyilla.
- Test file randu undu: `tests/core.test.ts`, `tests/storage.test.ts`. `npm test` run cheyyuka.

## 11. v0.3-il pudhiyathu
- Undo/Redo: bottom bar-il button, allenkil `Ctrl + Z` / `Ctrl + Shift + Z`.
- Autosave: oru artwork Save cheythaal (allenkil Gallery-yil ninnu Open cheythaal) pinne maattangal 1.5 second kazhinju thaane save aakum.
- Left panel-il "Export JSON" / "Import JSON": settings oru file aayi save cheyyaam.
- GitHub-il push cheyyumbol `package-lock.json` koodi commit cheyyanam, allenkil CI (`npm ci`) fail aakum.

## 12. v0.4-il pudhiyathu
- `npm install` veendum run cheyyanam (`three` pudhiya dependency aanu).
- Pages: `/3d` (3D playground), `/visualizer` (audio file allenkil microphone). Microphone permission browser chodikkum; automatic aayi chodikkilla.
- Architecture vivaranam `docs/ARCHITECTURE.md`-il undu.

## 13. Supabase (cloud) - optional
Cloud illathe thanne app work cheyyum (local mode). Cloud venamenkil:
1. supabase.com-il project undaakkuka.
2. **SQL Editor**-il `supabase/migrations/20260101000000_pixelforge_artworks.sql` file-inte content paste cheythu **Run** cheyyuka.
3. **Project Settings -> API**-il ninnu Project URL-um publishable (anon) key-um eduthu, project root-il `.env.local` file undaakki ezhuthuka:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=ninte-publishable-key
```
   `service_role` key onnum ivide ittaruthu. `.env.local` GitHub-il push aavilla.
4. **Authentication -> URL Configuration**: Site URL `http://localhost:5173`; Redirect URLs-il `http://localhost:5173/account` koodi cherkkuka. Vercel-il host cheythaal aa domain-um `/account` vechu cherkkuka.
5. `npm run dev` restart cheythu `/account`-il account undaakki sign in cheyyuka. Studio-yil "Save to cloud" kaanum.
6. Vercel-il Environment Variables-il ee randu variables koodi add cheythu redeploy cheyyuka.
Note: ee cloud code ente environment-il real Supabase project vechu test cheythittilla. Ninte project-il test cheythu error vannaal text ayakku.

## 14. Browser tests (e2e)
Randu terminal veno. Onnaamathe terminal-il (project root):
```
npm run build
npm run preview
```
Athu `http://localhost:4173`-il odum, nirtharuthu. Randaamathe terminal-il, project root-il:
```
npx playwright install chromium
npm run e2e
```
`npx playwright install chromium` aadyam oru pravashyam maathram cheythaal mathi. Ellaa line-um `PASS` aanenkil sheri; `FAIL` vannaal aa line enikku ayakku.

## 15. v0.7: Dimension Studio, visualizer, quality
- `/3d` ippo "Dimension Studio" aanu: moonnu mode (Orbital Sculpture, Particle Nebula, Kinetic Geometry), palette buttons, Render quality (Performance / Balanced / High Quality), Export PNG, Fullscreen.
- `/visualizer`-il 4 mode, Play/Pause, Sensitivity, Motion sliders undu. Studio-yil pointer-il "trail" mode-um "Render quality"-yum koodi cherthu.
- **Ee version njan 3D browser-il test cheythittilla.** Ninte machine-il ithu cheyyuka (project root, PowerShell):
```
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```
Pinne `http://localhost:4173/3d` thurannu moonnu mode-um, sliders-um, Pause, Export PNG-yum nokkuka. Error vannaal output ayakkuka.
- `npm audit`-ile dev-tool advisories maattaan (oru branch-il, ellaam work cheyyunnu ennurappichittu maathram merge):
```
git checkout -b upgrade-tooling
npm install -D vite@latest vitest@latest @vitejs/plugin-react@latest
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```
Ethenkilum fail aayaal output ayakkuka. `npm audit fix --force` run cheyyaruthu.
