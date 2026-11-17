// node compare.mjs <beforeOut> <afterOut> [jsonOut] — for every case (view × viewer × job kind) the same page is
// rendered from both builds and compared: every link (href + text), every button, every heading, the visible text,
// the tile counts, the Firestore reads (each listener / get with its path) and the schedule grid's text.
// Exits 1 when a link, button, read, count or the schedule grid differs. Not run by CI.
const { chromium } = await import(process.env.HARNESS_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs')
const CHROME = process.env.HARNESS_CHROME || '/usr/bin/google-chrome'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

function serve(dir) {
  const s = http.createServer((req, res) => {
    const p = path.join(dir, req.url.split('?')[0].replace(/^\/$/, '/index.html'))
    if (!fs.existsSync(p)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }).end(fs.readFileSync(p))
  })
  return new Promise((r) => s.listen(0, () => r(s)))
}
const [sb, sa] = await Promise.all([serve(path.resolve(process.argv[2])), serve(path.resolve(process.argv[3]))])
const jsonOut = process.argv[4]
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

export const CASES = []
for (const kind of ['proj', 'sw'])
  for (const variant of ['admin', 'mgrassigned', 'mgrother', 'operative'])
    for (const view of ['overview', 'section']) CASES.push(`view=${view}&variant=${variant}&kind=${kind}`)
for (const kind of ['proj', 'sw']) CASES.push(`view=notfound&variant=admin&kind=${kind}`)

async function grab(port, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z'))
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${port}/?${q}`)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const root = document.getElementById('harness-page')
    const vis = (el) => {
      const st = getComputedStyle(el)
      return st.display !== 'none' && st.visibility !== 'hidden'
    }
    const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
    const links = [...root.querySelectorAll('a')].filter(vis).map((a) => `${a.getAttribute('href')} | ${t(a)}`)
    const buttons = [...root.querySelectorAll('button')].filter(vis).map((b) => `${t(b)} disabled=${b.disabled}`)
    const headings = [...root.querySelectorAll('h1,h2,h3')].filter(vis).map((h) => `${h.tagName} ${t(h)}`)
    const texts = new Set()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      const s = n.textContent.replace(/\s+/g, ' ').trim()
      if (s && n.parentElement && vis(n.parentElement)) texts.add(s)
    }
    const nav = root.querySelector('nav[aria-label="Project sections"]')
    const tiles = nav ? [...nav.querySelectorAll('a')].map((a) => `${t(a)}${a.getAttribute('aria-current') ? ' [current]' : ''}${a.className.includes('on') ? ' [on]' : ''}`) : []
    const sched = [...root.querySelectorAll('h2')].find((h) => t(h) === 'This week on site')
    const card = sched ? sched.closest('section') : null
    const body = card ? card.children[card.children.length - 1] : null
    const bandStats = [...root.querySelectorAll('.pj-band-stat')].map(t)
    return { links, buttons, headings, texts: [...texts], tiles, schedule: body ? t(body) : null, bandStats }
  })
  out.reads = await page.evaluate(() => [...(window.__READS__ || [])])
  out.errors = errors
  await page.close()
  return out
}

const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const counts = (l) => l.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})
let failures = 0
const report = []
for (const q of CASES) {
  const b = await grab(sb.address().port, q)
  const a = await grab(sa.address().port, q)
  const issues = []
  if (!sameList(b.links, a.links)) issues.push({ links: { before: b.links, after: a.links } })
  if (!sameList(b.buttons, a.buttons)) issues.push({ buttons: { before: b.buttons, after: a.buttons } })
  const tb = b.tiles.map((x) => x.replace(/ \[(current|on)\]/g, ''))
  const ta = a.tiles.map((x) => x.replace(/ \[(current|on)\]/g, ''))
  if (JSON.stringify(tb) !== JSON.stringify(ta)) issues.push({ tiles: { before: b.tiles, after: a.tiles } })
  const onB = b.tiles.filter((x) => x.includes('[on]')).map((x) => x.split(' [')[0])
  const curA = a.tiles.filter((x) => x.includes('[current]')).map((x) => x.split(' [')[0])
  if (JSON.stringify(onB) !== JSON.stringify(curA)) issues.push({ activeTile: { before: onB, after: curA } })
  if (JSON.stringify(counts(b.reads)) !== JSON.stringify(counts(a.reads))) issues.push({ reads: { before: counts(b.reads), after: counts(a.reads) } })
  if (b.schedule !== a.schedule) issues.push({ schedule: { before: b.schedule, after: a.schedule } })
  if (b.errors.length || a.errors.length) issues.push({ errors: { before: b.errors, after: a.errors } })
  const textOnlyBefore = b.texts.filter((x) => !a.texts.includes(x))
  const textOnlyAfter = a.texts.filter((x) => !b.texts.includes(x))
  report.push({ q, issues, textOnlyBefore, textOnlyAfter, headingsBefore: b.headings, headingsAfter: a.headings, bandStats: a.bandStats, tiles: a.tiles, readsTotal: a.reads.length, links: a.links.length, buttons: a.buttons.length, schedule: a.schedule ? a.schedule.slice(0, 80) : null })
  if (issues.length) failures++
  console.log(`\n== ${q}: links ${a.links.length}, buttons ${a.buttons.length}, reads ${a.reads.length}, schedule ${a.schedule ? 'yes' : 'no'}${issues.length ? ' — DIFFERENT' : ' — same'}`)
  for (const i of issues) console.log('  ', JSON.stringify(i).slice(0, 1200))
  console.log('   band figures:', JSON.stringify(a.bandStats), ' tiles:', JSON.stringify(a.tiles))
  if (textOnlyBefore.length) console.log('   text only BEFORE:', JSON.stringify(textOnlyBefore))
  if (textOnlyAfter.length) console.log('   text only AFTER :', JSON.stringify(textOnlyAfter))
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2))
console.log(`\n${CASES.length} cases, ${failures} with a difference in links, buttons, tiles, reads, schedule or errors`)
await browser.close()
sb.close()
sa.close()
process.exit(failures ? 1 : 0)
