// node overflow.mjs <outDir> <shotsDir> — overflow check at 1440/1280/1024/820/390 for every variant and state,
// light and dark, plus screenshots at 1440 and 390.
// Playwright is not a project dependency: point HARNESS_PLAYWRIGHT at an install (default: the global one).
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

const x = (s) => `xpath=${s}`
const after = (label, tag) => x(`(//*[normalize-space(text())=${JSON.stringify(label)}]/following::${tag})[1]`)
const cases = [
  ...['operative', 'manager', 'admin', 'superadmin', 'inactive', 'allowanceoff', 'pending', 'ghost', 'opsmgr', 'operativeview'].flatMap((v) => [
    { name: `profile-${v}`, q: `view=profile&variant=${v}` },
    { name: `edit-${v}`, q: `view=edit&variant=${v}` },
  ]),
  { name: 'edit-operative-unsaved', q: 'view=edit&variant=operative', act: async (p) => p.fill(after('First name', 'input'), 'Farnie J') },
  {
    name: 'edit-manager-type-chooser',
    q: 'view=edit&variant=manager',
    act: async (p) => {
      await p.locator('button', { hasText: 'Change user type' }).first().click()
      await p.locator('button', { hasText: 'Field access:' }).first().click()
    },
  },
  {
    name: 'edit-manager-permission-expanded',
    q: 'view=edit&variant=manager',
    act: async (p) => {
      for (const n of ['Projects — add & edit', 'Daily Overview', 'Materials']) await p.locator('button', { hasText: n }).first().click()
      await p.locator('[role=switch][aria-label="Materials"]').click()
    },
  },
  { name: 'edit-operative-fixemail', q: 'view=edit&variant=operative', act: async (p) => p.locator('button', { hasText: /^Ask Project Planner to fix it$/ }).click() },
  { name: 'edit-inactive-reactivated', q: 'view=edit&variant=inactive', act: async (p) => p.locator('button', { hasText: 'Reactivate user' }).click() },
  { name: 'loading-profile', q: 'view=loading-profile' },
  { name: 'loading-edit', q: 'view=loading-edit' },
]
const widths = [1440, 1280, 1024, 820, 390]
let failures = 0
let checks = 0
for (const theme of ['light', 'dark']) {
  for (const c of cases) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z'))
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`http://localhost:${port}/?${c.q}&theme=${theme}`)
      await page.waitForTimeout(900)
      if (c.act) {
        await c.act(page)
        await page.waitForTimeout(300)
      }
      const problems = await page.evaluate(() => {
        const out = []
        const de = document.documentElement
        if (de.scrollWidth > de.clientWidth) out.push(`page scrolls sideways: ${de.scrollWidth} > ${de.clientWidth}`)
        const vw = de.clientWidth
        const root = document.getElementById('harness-page')
        const label = (e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')} "${(e.textContent || e.value || '').trim().slice(0, 30)}"`
        for (const e of root.querySelectorAll('*')) {
          const st = getComputedStyle(e)
          if (st.display === 'none' || st.visibility === 'hidden') continue
          const r = e.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) continue
          if (r.right > vw + 0.5) out.push(`past screen (${Math.round(r.right)} > ${vw}): ${label(e)}`)
          const box = e.parentElement && e.parentElement.closest('.pu-card, .pu-band, .up-dialog')
          if (box) {
            const b = box.getBoundingClientRect()
            if (r.right > b.right + 0.5 || r.left < b.left - 0.5) out.push(`past its card: ${label(e)}`)
          }
          // cut-off text: clipped content wider than the box
          if ((st.overflow === 'hidden' || st.textOverflow === 'ellipsis' || st.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 1 && e.children.length === 0 && e.textContent.trim())
            out.push(`text cut off: ${label(e)}`)
          // short labels wrapping onto two lines
          if (e.matches('button, a.pu-btn, .pu-chip, .up-dchip, .up-savestate, [role=tab]') && e.textContent.trim().length > 0 && e.textContent.trim().length <= 24 && !e.matches('.up-act, .up-opt, .up-perm-main, .up-dialog li button')) {
            const range = document.createRange()
            range.selectNodeContents(e)
            const tops = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)))
            if (tops.size > 1 && e.getBoundingClientRect().height > 50) out.push(`short label wraps: ${label(e)}`)
          }
        }
        return [...new Set(out)]
      })
      checks++
      if (problems.length || errors.length) {
        failures++
        console.log(`FAIL ${c.name} ${width} ${theme}:`, [...problems, ...errors].slice(0, 8))
      }
      if ((width === 1440 || width === 390) && (theme === 'light' || ['edit-operative', 'profile-operative', 'edit-manager', 'edit-superadmin'].includes(c.name)))
        await page.screenshot({ path: path.join(shots, `${c.name}-${width}${theme === 'dark' ? '-dark' : ''}.png`), fullPage: true })
      await page.close()
    }
  }
}
console.log(`${checks} page checks, ${failures} with problems`)
await browser.close()
server.close()
