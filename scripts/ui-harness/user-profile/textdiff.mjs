// node textdiff.mjs <beforeDir> <afterDir> — the set of visible text nodes and controls per variant, before vs after.
// Playwright is not a project dependency: point HARNESS_PLAYWRIGHT at an install (default: the global one).
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
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const variants = ['operative', 'manager', 'admin', 'superadmin', 'inactive', 'allowanceoff', 'pending', 'ghost', 'opsmgr', 'operativeview']
async function grab(port, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z'))
  await page.goto(`http://localhost:${port}/?${q}`)
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const texts = new Set()
    const walker = document.createTreeWalker(document.getElementById('harness-page'), NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      const t = n.textContent.replace(/\s+/g, ' ').trim()
      const el = n.parentElement
      if (!t || !el || el.closest('option')) continue
      const st = getComputedStyle(el)
      if (st.display === 'none' || st.visibility === 'hidden') continue
      texts.add(t)
    }
    const controls = [...document.querySelectorAll('#harness-page input, #harness-page select, #harness-page textarea, #harness-page button, #harness-page a')].map((e) => {
      const tag = e.tagName.toLowerCase()
      if (tag === 'select') return `select[${[...e.options].map((o) => o.value + '=' + o.text).join('|')}] value=${e.value} disabled=${e.disabled}`
      if (tag === 'input') return `input type=${e.type} value=${e.value} placeholder=${e.placeholder} disabled=${e.disabled}`
      if (tag === 'a') return `a href=${e.getAttribute('href')}`
      if (e.getAttribute('role') === 'switch') return `switch checked=${e.getAttribute('aria-checked')} disabled=${e.disabled}`
      return `button "${e.textContent.replace(/\s+/g, ' ').trim()}" disabled=${e.disabled}`
    })
    return { texts: [...texts], controls }
  })
  await page.close()
  return out
}
for (const view of ['edit', 'profile']) {
  for (const v of variants) {
    const q = `view=${view}&variant=${v}`
    const b = await grab(sb.address().port, q)
    const a = await grab(sa.address().port, q)
    const onlyB = b.texts.filter((t) => !a.texts.includes(t))
    const onlyA = a.texts.filter((t) => !b.texts.includes(t))
    const cb = [...b.controls].sort(), ca = [...a.controls].sort()
    const ctrlOnlyB = cb.filter((c) => !ca.includes(c))
    const ctrlOnlyA = ca.filter((c) => !cb.includes(c))
    console.log(`\n== ${q}: texts before ${b.texts.length} after ${a.texts.length}; controls before ${cb.length} after ${ca.length}`)
    if (onlyB.length) console.log('  text only BEFORE:', JSON.stringify(onlyB))
    if (onlyA.length) console.log('  text only AFTER :', JSON.stringify(onlyA))
    if (ctrlOnlyB.length) console.log('  control only BEFORE:', JSON.stringify(ctrlOnlyB))
    if (ctrlOnlyA.length) console.log('  control only AFTER :', JSON.stringify(ctrlOnlyA))
  }
}
await browser.close()
sb.close()
sa.close()
