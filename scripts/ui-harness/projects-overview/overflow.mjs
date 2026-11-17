// node overflow.mjs <outDir> <shotsDir> — no overflow at 1440/1280/1024/820/390 for every case, light, dark and system dark;
// text contrast of the restyled parts (band, tiles, cards) at least 4.5:1; screenshots at 1440/1024/390 light and
// dark, plus a keyboard-focus shot of the section tiles. Not run by CI.
const { chromium } = await import(process.env.HARNESS_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs')
const CHROME = process.env.HARNESS_CHROME || '/usr/bin/google-chrome'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(process.argv[2])
const shots = path.resolve(process.argv[3])
fs.mkdirSync(shots, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(dir, req.url.split('?')[0].replace(/^\/$/, '/index.html'))
  if (!fs.existsSync(p)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }).end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

const cases = [
  { name: 'overview-admin-proj', q: 'view=overview&variant=admin&kind=proj' },
  { name: 'overview-admin-proj-long', q: 'view=overview&variant=admin&kind=proj&long=1' },
  { name: 'overview-admin-sw', q: 'view=overview&variant=admin&kind=sw' },
  { name: 'overview-mgrother-proj', q: 'view=overview&variant=mgrother&kind=proj' },
  { name: 'overview-operative-proj', q: 'view=overview&variant=operative&kind=proj' },
  { name: 'section-admin-proj', q: 'view=section&variant=admin&kind=proj' },
  { name: 'section-operative-sw', q: 'view=section&variant=operative&kind=sw' },
  { name: 'notfound-proj', q: 'view=notfound&variant=admin&kind=proj' },
  { name: 'notfound-sw', q: 'view=notfound&variant=admin&kind=sw' },
]
const widths = [1440, 1280, 1024, 820, 390]
let failures = 0
let checks = 0
for (const theme of ['light', 'dark', 'system']) {
  for (const c of cases) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme === 'system' ? 'dark' : 'light' })
      await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z'))
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`http://localhost:${port}/?${c.q}&theme=${theme}`)
      await page.waitForTimeout(1300)
      const problems = await page.evaluate(() => {
        const out = []
        const de = document.documentElement
        if (de.scrollWidth > de.clientWidth) out.push(`page scrolls sideways: ${de.scrollWidth} > ${de.clientWidth}`)
        const vw = de.clientWidth
        const root = document.getElementById('harness-page')
        const label = (e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')} "${(e.textContent || '').trim().slice(0, 30)}"`
        const inScroller = (e) => {
          for (let p = e.parentElement; p && p !== root; p = p.parentElement) {
            const s = getComputedStyle(p)
            if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true
          }
          return false
        }
        // contrast
        const parse = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/)
          if (!m) return null
          const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x))
          return [r, g, b, a === undefined || Number.isNaN(a) ? 1 : a]
        }
        const lum = ([r, g, b]) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const blend = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
        const bgOf = (e) => {
          const chain = []
          for (let p = e; p; p = p.parentElement) chain.push(p)
          let bg = [255, 255, 255, 1]
          for (const p of chain.reverse()) {
            const c = parse(getComputedStyle(p).backgroundColor)
            if (c && c[3] > 0) bg = blend(c, bg)
          }
          return bg
        }
        const scope = root.querySelectorAll('.pj-band *, .pj-tile *, .pj-tile, .pj-card-h *, .pj-card-b > p, .pj-card-b > a, .pj-dl *, .pj-back, .pj-notfound-link, .pj-notfound-text')
        for (const e of scope) {
          if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
          const st = getComputedStyle(e)
          if (st.display === 'none' || st.visibility === 'hidden') continue
          const fg = parse(st.color)
          const bg = bgOf(e)
          const L1 = lum(blend(fg, bg)), L2 = lum(bg)
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
          if (ratio < 4.5) out.push(`contrast ${ratio.toFixed(2)}: ${label(e)}`)
        }
        for (const e of root.querySelectorAll('*')) {
          const st = getComputedStyle(e)
          if (st.display === 'none' || st.visibility === 'hidden') continue
          const r = e.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) continue
          if (inScroller(e)) continue
          if (r.right > vw + 0.5) out.push(`past screen (${Math.round(r.right)} > ${vw}): ${label(e)}`)
          const box = e.parentElement && e.parentElement.closest('.pj-card, .pj-band, .pj-tile, .pj-band-stat, .pj-band-prog')
          if (box) {
            const b = box.getBoundingClientRect()
            if (r.right > b.right + 0.5 || r.left < b.left - 0.5) out.push(`past its box: ${label(e)}`)
          }
          if ((st.overflow === 'hidden' || st.textOverflow === 'ellipsis' || st.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 1 && e.children.length === 0 && e.textContent.trim())
            out.push(`text cut off: ${label(e)}`)
        }
        return [...new Set(out)]
      })
      checks++
      if (problems.length || errors.length) {
        failures++
        console.log(`FAIL ${c.name} ${width} ${theme}:`, [...problems, ...errors].slice(0, 10))
      }
      if ([1440, 1024, 390].includes(width) && theme !== 'system') await page.screenshot({ path: path.join(shots, `${c.name}-${width}-${theme}.png`), fullPage: true })
      if (c.name === 'overview-admin-proj' && width === 1440 && theme !== 'system') {
        await page.locator('nav[aria-label="Project sections"] a').nth(2).focus()
        await page.keyboard.press('Tab')
        await page.waitForTimeout(150)
        await page.screenshot({ path: path.join(shots, `focus-tiles-${theme}.png`) })
      }
      await page.close()
    }
  }
}
console.log(`${checks} page checks, ${failures} with problems`)
await browser.close()
server.close()
process.exit(failures ? 1 : 0)
