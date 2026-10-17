// End-to-end checks. Run: npm run build && npm run preview  (terminal 1), then: npm run e2e  (terminal 2).
// One-time: npx playwright install chromium.  BASE_URL overrides http://localhost:4173.
// Not covered: 3D page, cloud/Supabase.
const { chromium } = require('playwright')
const fs = require('fs')
const B = process.env.BASE_URL || 'http://localhost:4173', results = [], errors = []
const t = async (name, fn) => { try { await fn(); results.push('PASS  ' + name) } catch (e) { results.push('FAIL  ' + name + ' :: ' + String(e.message).split('\n')[0]) } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed') }
const sig = (page) => page.evaluate(() => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, ink = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 60) ink++; s = (s * 31 + v) >>> 0 } return { s, ink, w: c.width, h: c.height } })
const inkBox = (page, cx, cy, r) => page.evaluate(([cx, cy, r]) => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(Math.max(0, cx - r), Math.max(0, cy - r), 2 * r, 2 * r).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n }, [cx, cy, r])
const status = (page) => page.locator('footer [role=status]').innerText()
const slider = (page, name) => page.locator('label', { hasText: name }).locator('input')
const outv = (page, name) => page.locator('label', { hasText: name }).locator('output').innerText()
const stor = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pixelforge.artworks.v1') || '[]'))
;(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()) })
  page.on('dialog', (d) => d.accept())

  await t('landing: headline + nav + hero canvas', async () => {
    await page.goto(B + '/'); await page.waitForSelector('h1')
    ok((await page.locator('h1').innerText()).includes('Your Imagination, In Motion.')); ok(await page.locator('.hero2 canvas').count() === 1)
  })
  await t('landing: Start Creating -> /studio', async () => { await page.getByRole('link', { name: 'Start Creating' }).last().click(); await page.waitForURL('**/studio'); await page.waitForSelector('main.stage canvas') })
  await t('studio: .stage layout, canvas fills stage, draws pixels', async () => {
    await page.waitForTimeout(1200)
    const s = await page.locator('main.stage').boundingBox(), c = await page.locator('canvas').boundingBox()
    ok(s.width > 700 && s.height > 400, 'stage too small ' + JSON.stringify(s)); ok(Math.abs(s.width - c.width) < 2 && Math.abs(s.height - c.height) < 2, 'canvas != stage')
    ok((await sig(page)).ink > 50, 'no ink drawn')
  })
  await t('presets: all 5 select + render + differ', async () => {
    const inks = new Set()
    for (const n of ['Cosmic Drift', 'Neon Flow', 'Orbit Field', 'Liquid Waves', 'Fractal Bloom']) {
      await page.getByRole('button', { name: n }).click(); await page.waitForTimeout(900)
      ok(await page.getByRole('button', { name: n }).getAttribute('aria-pressed') === 'true', n + ' not pressed')
      const s = await sig(page); ok(s.ink > 20, n + ' drew nothing'); inks.add(s.ink)
    }
    ok(inks.size >= 4, 'presets look identical: ' + [...inks])
  })
  await t('controls: count slider changes output', async () => {
    await page.getByRole('button', { name: 'Cosmic Drift' }).click(); await slider(page, 'trail').fill('0'); await slider(page, 'size').fill('4')
    await slider(page, 'count').fill('50'); await page.waitForTimeout(500); const a = (await sig(page)).ink
    await slider(page, 'count').fill('3000'); await page.waitForTimeout(500); const b = (await sig(page)).ink
    ok(b > a * 5, `ink ${a} -> ${b}`)
  })
  await t('controls: palette select + hue disabled for fixed palette', async () => {
    await page.locator('label', { hasText: 'palette' }).locator('select').selectOption('sunset')
    ok(await slider(page, 'hue').isDisabled()); await page.locator('label', { hasText: 'palette' }).locator('select').selectOption('custom'); ok(!(await slider(page, 'hue').isDisabled()))
  })
  await t('pointer: repel clears area under cursor vs none', async () => {
    await slider(page, 'strength').fill('5'); await slider(page, 'radius').fill('300')
    const box = await page.locator('canvas').boundingBox(), cx = Math.round(box.width / 2), cy = Math.round(box.height / 2)
    await page.getByRole('button', { name: 'none', exact: true }).click(); await page.mouse.move(box.x + cx, box.y + cy); await page.waitForTimeout(1500)
    const base = await inkBox(page, cx, cy, 60)
    await page.getByRole('button', { name: 'repel', exact: true }).click(); await page.mouse.move(box.x + cx + 1, box.y + cy + 1); await page.waitForTimeout(2500)
    const rep = await inkBox(page, cx, cy, 60); ok(rep < base * 0.6, `none=${base} repel=${rep}`)
    await page.getByRole('button', { name: 'attract', exact: true }).click(); await page.mouse.move(box.x + cx, box.y + cy); await page.waitForTimeout(1500)
    let att = 0; for (let k = 0; k < 30 && att <= base * 1.3; k++) { att = Math.max(att, await inkBox(page, cx, cy, 60)); await page.waitForTimeout(300) } // swarm oscillates around the pointer: wait for its peak (speed depends on machine)
    ok(att > base * 1.3, `none=${base} attract peak=${att}`)
  })
  await t('pause freezes canvas, play resumes', async () => {
    await page.getByRole('button', { name: 'none', exact: true }).click()
    await page.getByRole('button', { name: 'Pause', exact: true }).click(); await page.waitForTimeout(300); const a = await sig(page); await page.waitForTimeout(600); const b = await sig(page); ok(a.s === b.s, 'canvas changed while paused')
    await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForTimeout(600); const c = await sig(page); ok(c.s !== b.s, 'canvas did not resume')
  })
  await t('undo/redo restore settings', async () => {
    await page.getByRole('button', { name: 'Neon Flow' }).click(); await page.waitForTimeout(600)
    const h0 = await outv(page, 'hue'); await slider(page, 'hue').fill('100'); await page.waitForTimeout(500)
    ok(await outv(page, 'hue') === '100'); await page.getByRole('button', { name: 'Undo' }).click(); ok(await outv(page, 'hue') === h0, 'undo failed')
    await page.getByRole('button', { name: 'Redo' }).click(); ok(await outv(page, 'hue') === '100', 'redo failed')
    await page.keyboard.press('Control+z'); ok(await outv(page, 'hue') === h0, 'ctrl+z failed')
  })
  await t('keyboard: Space pauses, R randomizes', async () => {
    await page.locator('canvas').click(); await page.keyboard.press('Space'); ok(await page.getByRole('button', { name: 'Play', exact: true }).count() === 1); await page.keyboard.press('Space')
    const before = (await outv(page, 'hue')) + (await outv(page, 'speed')) + (await outv(page, 'count')); await page.keyboard.press('r'); await page.waitForTimeout(200)
    ok(before !== (await outv(page, 'hue')) + (await outv(page, 'speed')) + (await outv(page, 'count')), 'R changed nothing')
  })
  await t('save -> storage -> reload -> load; autosave updates', async () => {
    await page.getByRole('button', { name: 'Neon Flow' }).click(); await page.getByLabel('Artwork title').fill('My Test Art'); await page.getByRole('button', { name: 'Save', exact: true }).click()
    ok((await status(page)).includes('Saved to this browser')); ok((await stor(page)).length === 1)
    await slider(page, 'hue').fill('77'); await page.waitForTimeout(2300); ok((await stor(page))[0].settings.hue === 77, 'autosave did not update'); ok((await status(page)).includes('Autosaved'))
    await page.reload(); await page.waitForSelector('.panel.left .item'); await page.locator('.panel.left .item', { hasText: 'My Test Art' }).getByRole('button', { name: 'Load' }).click()
    ok(await outv(page, 'hue') === '77', 'restore failed')
  })
  await t('PNG export downloads a real PNG', async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export PNG' }).click()])
    ok(d.suggestedFilename().endsWith('.png')); const f = await d.path(); const b = fs.readFileSync(f); ok(b.length > 1000 && b.slice(1, 4).toString() === 'PNG', 'not a PNG')
  })
  await t('JSON export + import (valid and invalid)', async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON' }).click()]); const f = await d.path()
    ok(JSON.parse(fs.readFileSync(f, 'utf8')).app === 'pixelforge')
    await page.getByLabel('Import settings JSON').setInputFiles(f); await page.waitForTimeout(300); ok((await status(page)).includes('Imported'))
    await page.getByLabel('Import settings JSON').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"evil"}') }); await page.waitForTimeout(300); ok((await status(page)).includes('Not a valid'))
  })
  await t('share link copies, reopens same settings; bad link rejected', async () => {
    await page.getByRole('button', { name: 'Orbit Field' }).click(); await page.waitForTimeout(500); await slider(page, 'count').fill('300')
    await page.getByRole('button', { name: 'Share' }).click(); await page.waitForTimeout(300); const url = await page.evaluate(() => navigator.clipboard.readText()); ok(url.includes('/studio?s='), url)
    const p2 = await ctx.newPage(); await p2.goto(url.replace(/^https?:\/\/[^/]+/, B)); await p2.waitForSelector('canvas'); await p2.waitForTimeout(500)
    ok((await p2.locator('footer [role=status]').innerText()).includes('Loaded shared')); ok(await p2.getByRole('button', { name: 'Orbit Field' }).getAttribute('aria-pressed') === 'true'); ok(await outv(p2, 'count') === '300')
    await p2.goto(B + '/studio?s=' + 'A'.repeat(3000)); await p2.waitForSelector('canvas'); ok((await p2.locator('footer [role=status]').innerText()).includes('invalid')); await p2.close()
  })
  await t('gallery: examples, search, remix creates separate copy, duplicate, delete, back button', async () => {
    await page.goto(B + '/gallery'); await page.waitForSelector('.card'); ok(await page.locator('.card').count() === 5, 'examples != 5')
    await page.getByLabel('Search artworks').fill('neon'); ok(await page.locator('.card').count() === 1); await page.getByLabel('Search artworks').fill('')
    await page.getByRole('button', { name: /My artworks/ }).click(); ok(await page.locator('.card', { hasText: 'My Test Art' }).count() === 1)
    await page.locator('.card', { hasText: 'My Test Art' }).getByRole('link', { name: 'Remix' }).click(); await page.waitForURL('**/studio?remix=*'); await page.waitForSelector('canvas')
    ok(await page.getByLabel('Artwork title').inputValue() === 'My Test Art (remix)'); ok((await status(page)).includes('Remix started'))
    await page.getByRole('button', { name: 'Save', exact: true }).click(); const l = await stor(page); ok(l.length === 2 && l.some((a) => a.title === 'My Test Art') && l.some((a) => a.title === 'My Test Art (remix)'), 'remix overwrote original: ' + l.map((a) => a.title))
    await page.goBack(); await page.waitForSelector('.card'); ok(page.url().endsWith('/gallery'), 'back failed')
    await page.getByRole('button', { name: /My artworks/ }).click(); await page.locator('.card', { hasText: 'My Test Art (remix)' }).getByRole('button', { name: 'Duplicate' }).click(); ok((await stor(page)).length === 3)
    await page.locator('.card', { hasText: '(remix) (copy)' }).getByRole('button', { name: 'Delete' }).click(); ok((await stor(page)).length === 2)
  })
  await t('cloud not configured: account page + no cloud tabs, no crash', async () => {
    ok(await page.getByRole('button', { name: /Community/ }).count() === 0); await page.goto(B + '/account'); await page.waitForSelector('h1'); ok((await page.locator('body').innerText()).includes('not configured'))
  })
  await t('unknown route shows 404 page', async () => { await page.goto(B + '/nope'); ok((await page.locator('body').innerText()).includes('Page not found')) })

  await t('trail pointer mode selectable; Render quality scales particles', async () => {
    await page.goto(B + '/studio'); await page.waitForSelector('main.stage canvas'); await page.getByRole('button', { name: 'Cosmic Drift' }).click()
    await page.getByRole('button', { name: 'trail', exact: true }).click(); ok(await page.getByRole('button', { name: 'trail', exact: true }).getAttribute('aria-pressed') === 'true')
    const box = await page.locator('canvas').boundingBox(); await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.move(box.x + 300, box.y + 200, { steps: 8 })
    await page.getByRole('button', { name: 'none', exact: true }).click()
    await slider(page, 'trail').fill('0'); await slider(page, 'size').fill('4'); await slider(page, 'count').fill('2000')
    await page.getByRole('button', { name: 'High Quality' }).click(); await page.waitForTimeout(700); const hi = (await sig(page)).ink
    await page.getByRole('button', { name: 'Performance' }).click(); await page.waitForTimeout(700); const lo = (await sig(page)).ink
    ok(lo < hi * 0.6, `performance ink ${lo} vs high ${hi}`); await page.getByRole('button', { name: 'Balanced' }).click(); await page.goto(B + '/account') // stop the animation so later tests are not slowed
  })
  if (!process.env.SKIP_3D) await t('3D: each mode renders, controls change the scene, pause, quality, PNG export', async () => {
    const p3 = await ctx.newPage(); p3.on('pageerror', (e) => errors.push('3d pageerror: ' + e.message))
    await p3.goto(B + '/3d'); await p3.waitForTimeout(1500)
    if (await p3.locator('[role=alert]').count()) { results.push('SKIP  3D scene: WebGL unavailable in this browser'); await p3.close(); return }
    await p3.waitForSelector('.gl canvas')
    const snap = () => p3.evaluate(() => { const c = document.querySelector('.gl canvas'); const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, o.width, o.height).data; let ink = 0, s = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 90) ink++; s = (s * 31 + v) >>> 0 } return { ink, s } })
    const sigs = new Set()
    for (const n of ['Orbital Sculpture', 'Particle Nebula', 'Kinetic Geometry']) { await p3.getByRole('button', { name: n }).click(); await p3.waitForTimeout(1500); const s = await snap(); ok(s.ink > 100, n + ' rendered nothing'); sigs.add(s.s) }
    ok(sigs.size === 3, 'modes look identical')
    const before = await snap(); await p3.locator('label', { hasText: 'hue' }).locator('input').fill('120'); await p3.waitForTimeout(600); ok((await snap()).s !== before.s, 'hue did not change the scene')
    await p3.getByRole('button', { name: 'Pause', exact: true }).click(); await p3.waitForTimeout(300); const a = await snap(); await p3.waitForTimeout(600); ok(a.s === (await snap()).s, 'scene moves while paused'); await p3.getByRole('button', { name: 'Play', exact: true }).click()
    for (const q of ['Performance', 'High Quality', 'Balanced']) { await p3.getByRole('button', { name: q }).click(); await p3.waitForTimeout(900); ok((await snap()).ink > 100, q + ' rendered nothing') }
    const [d] = await Promise.all([p3.waitForEvent('download'), p3.getByRole('button', { name: 'Export PNG' }).click()]); ok(d.suggestedFilename().endsWith('.png'))
    await p3.goto(B + '/'); await p3.waitForTimeout(400); await p3.close()
  })
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const mp = await m.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message))
  for (const w of [360, 390, 768]) await t(`responsive ${w}px: studio no h-overflow, canvas usable`, async () => {
    await mp.setViewportSize({ width: w, height: 844 }); await mp.goto(B + '/studio'); await mp.waitForSelector('canvas'); await mp.waitForTimeout(500)
    ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'horizontal overflow'); const c = await mp.locator('canvas').boundingBox(); ok(c.height > 300 && c.width > w * 0.9, JSON.stringify(c))
  })
  await t('mobile: Modes / Settings bottom sheets open + close', async () => {
    await mp.setViewportSize({ width: 390, height: 844 }); await mp.goto(B + '/studio'); await mp.waitForSelector('canvas')
    await mp.getByRole('button', { name: 'Settings' }).tap(); await mp.waitForFunction(() => { const r = document.querySelector('.panel.right').getBoundingClientRect(); return r.top < 744 && r.bottom <= 845 }, null, { timeout: 8000 }).catch(() => { throw new Error('sheet not visible') })
    await mp.locator('.panel.right').getByRole('button', { name: 'Close' }).tap(); await mp.waitForFunction(() => document.querySelector('.panel.right').getBoundingClientRect().top >= 843, null, { timeout: 8000 }).catch(() => { throw new Error('sheet did not close') })
  })
  for (const w of [1366, 1920]) await t(`responsive ${w}px: landing + gallery no h-overflow`, async () => {
    await mp.setViewportSize({ width: w, height: 900 }); for (const r of ['/', '/gallery']) { await mp.goto(B + r); await mp.waitForTimeout(300); ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), r + ' overflow') }
  })
  await m.close()

  // audio fixture: 3s WAV, 60Hz bass pulses + 1kHz tone
  const sr = 22050, n = sr * 3, buf = Buffer.alloc(44 + n * 2); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) { const tt = i / sr, env = (Math.sin(tt * Math.PI * 4) > 0 ? 1 : 0.2); buf.writeInt16LE(Math.round(32767 * 0.8 * (0.7 * Math.sin(2 * Math.PI * 60 * tt) * env + 0.3 * Math.sin(2 * Math.PI * 1000 * tt))), 44 + i * 2) }
  const va = await ctx.newPage(); va.on('pageerror', (e) => errors.push('viz pageerror: ' + e.message))
  await t('visualizer: silence draws nothing; real audio file drives the bars', async () => {
    await va.goto(B + '/visualizer'); await va.waitForSelector('canvas'); await va.locator('select').first().selectOption('bars'); await va.waitForTimeout(600)
    const silent = (await sig(va)).ink
    await va.getByLabel('Audio file').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: buf }); await va.waitForTimeout(1500)
    ok((await va.locator('[role=status]').innerText()).includes('Playing'), await va.locator('[role=status]').innerText())
    const a = await sig(va); await va.waitForTimeout(700); const b = await sig(va)
    ok(a.ink > silent + 500, `silent=${silent} playing=${a.ink}`); ok(a.s !== b.s, 'visual not changing with audio')
    await va.getByRole('button', { name: 'Stop' }).click(); await va.waitForTimeout(1500); const after = (await sig(va)).ink; ok(after < a.ink * 0.3, `bars did not fade after stop: ${a.ink} -> ${after}`)
  })
  await t('visualizer: rejects non-audio file; mic failure handled; stop releases', async () => {
    await va.getByLabel('Audio file').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }); await va.waitForTimeout(300); ok((await va.locator('[role=status]').innerText()).includes('choose an audio file'))
    await va.getByRole('button', { name: 'Use microphone' }).click(); await va.waitForTimeout(800); const s = await va.locator('[role=status]').innerText(); ok(/microphone/i.test(s), s)
  })
  await t('visualizer: all 4 modes draw from audio; play/pause toggles', async () => {
    await va.getByLabel('Audio file').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: buf }); await va.waitForTimeout(1200)
    for (const m of ['pulse', 'bars', 'wave', 'circle']) { await va.locator('select').first().selectOption(m); await va.waitForTimeout(500); ok((await sig(va)).ink > 300, m + ' drew little') }
    await va.getByRole('button', { name: 'Pause', exact: true }).click(); await va.waitForTimeout(500); ok((await va.locator('[role=status]').innerText()).includes('Paused'), 'status after Pause: ' + await va.locator('[role=status]').innerText())
    await va.getByRole('button', { name: 'Play', exact: true }).click(); await va.waitForTimeout(500); ok((await va.locator('[role=status]').innerText()).includes('Playing'), 'status after Play: ' + await va.locator('[role=status]').innerText())
  })
  await t('visualizer: leaving the page does not throw', async () => { await va.goto(B + '/'); await va.waitForTimeout(500) })

  console.log(results.join('\n')); console.log('\nERRORS (' + errors.length + '):\n' + errors.slice(0, 15).join('\n'))
  await browser.close(); process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0)
})()
