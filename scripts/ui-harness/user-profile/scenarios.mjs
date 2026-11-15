// node scenarios.mjs <outDir> <resultJson>
// Runs the same edits on Edit user and records every store call, Firestore write and navigation.
// Playwright is not a project dependency: point HARNESS_PLAYWRIGHT at an install (default: the global one).
const { chromium } = await import(process.env.HARNESS_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs')
const CHROME = process.env.HARNESS_CHROME || '/usr/bin/google-chrome'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(process.argv[2])
const outFile = path.resolve(process.argv[3])
const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'))
  if (!fs.existsSync(p)) return res.writeHead(404).end()
  const type = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html'
  res.writeHead(200, { 'content-type': type }).end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

const x = (s) => `xpath=${s}`
const after = (label, tag) => x(`(//*[normalize-space(text())=${JSON.stringify(label)}]/following::${tag})[1]`)
const sw = (label) => after(label, "*[@role='switch']")

async function dialogs(page) {
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(250)
    const btn = page.locator('[role=dialog] button', { hasText: /^(OK|Today)$/ }).first()
    if (await btn.count()) await btn.click()
    else break
  }
}
async function save(page) {
  await page.locator('button', { hasText: /^Save$/ }).first().click()
  await dialogs(page)
  await page.waitForTimeout(800)
}

const scenarios = {
  operative: async (p) => {
    await p.fill(after('First name', 'input'), 'Farnie J')
    await p.fill(after('Mobile number', 'input'), '07876 000111')
    await p.selectOption('select:has(option[value="paye"])', 'paye')
    await p.fill('input[aria-label="Day rate"]', '240')
    await p.selectOption(after('Trade type', 'select'), 'Plumber')
    await p.fill(after('Days per year', 'input'), '22')
    await p.click(sw('Carry unused days into next leave year'))
    await p.click(sw('Timesheets enabled'))
    await p.click(sw('Materials'))
    await p.fill(after('VAT number', 'input'), 'GB123456789')
    await save(p)
  },
  manager: async (p) => {
    await p.fill(after('Surname', 'input'), 'Manager-Two')
    await p.locator('button', { hasText: /^Day rate$/ }).first().click()
    await p.fill('input[aria-label="Day rate"]', '200')
    await p.selectOption(after('Company leave year', 'select'), '4')
    await p.click(sw('Sub Contractors'))
    await save(p)
  },
  superadmin: async (p) => {
    await p.fill(after('Surname', 'input'), 'Admin-Super')
    await p.fill(after('Mobile number', 'input'), '07700 111222')
    await p.selectOption(after('Trade type', 'select'), 'Roofer')
    await p.fill('input[aria-label="Day rate"]', '260')
    await save(p)
  },
  'manager-type': async (p) => {
    await p.locator('button', { hasText: 'Change user type' }).first().click()
    await p.locator('button', { hasText: 'Field access:' }).first().click()
    await p.waitForTimeout(200)
    await save(p)
  },
  'manager-type-cancel': async (p) => {
    await p.locator('button', { hasText: 'Change user type' }).first().click()
    await p.locator('button', { hasText: 'Field access:' }).first().click()
    await p.locator('button', { hasText: 'Cancel type change' }).click()
    await p.waitForTimeout(200)
  },
  inactive: async (p) => {
    await p.locator('button', { hasText: 'Reactivate user' }).click()
    await p.waitForTimeout(800)
  },
  'admin-type': async (p) => {
    await p.locator('button', { hasText: 'Change user type' }).first().click()
    await p.locator('button', { hasText: 'Can manage projects' }).first().click()
    await p.waitForTimeout(200)
    await save(p)
  },
  'manager-to-admin': async (p) => {
    await p.locator('button', { hasText: 'Change user type' }).first().click()
    await p.locator('button', { hasText: 'Full admin access' }).first().click()
    await p.locator('button', { hasText: 'Yes, make administrator' }).click()
    await p.waitForTimeout(800)
  },
  'operative-reset': async (p) => {
    await p.locator('button', { hasText: 'Send password reset' }).click()
    await p.waitForTimeout(500)
  },
  'operative-delete': async (p) => {
    await p.locator('button', { hasText: 'Delete user' }).click()
    await p.locator('[class*=fixed] button, [role=dialog] button', { hasText: /^Delete$/ }).click()
    await p.waitForTimeout(800)
  },
  pending: async (p) => {
    await p.locator('button', { hasText: 'Resend sign-up email' }).click()
    await p.waitForTimeout(500)
  },
  opsmgr: async (p) => {
    await p.locator('button', { hasText: 'Deactivate operative' }).click()
    await p.waitForTimeout(800)
  },
  allowanceoff: async (p) => {
    await p.click(sw('Annual leave allowance'))
    await p.fill(after('Days per year', 'input'), '20')
    await save(p)
  },
}
const variantOf = { 'admin-type': 'admin', 'manager-to-admin': 'manager', 'manager-type': 'manager', 'manager-type-cancel': 'manager', 'operative-reset': 'operative', 'operative-delete': 'operative' }

const results = {}
for (const [name, run] of Object.entries(scenarios)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z'))
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${port}/?view=edit&variant=${variantOf[name] || name}`)
  await page.waitForTimeout(1200)
  try {
    await run(page)
  } catch (e) {
    errors.push('scenario: ' + e.message.split('\n')[0])
  }
  const state = await page.evaluate(() =>
    JSON.parse(
      JSON.stringify({ saves: window.__SAVES__, writes: window.__WRITES__, nav: window.__NAV__ }, function (k, v) {
        const raw = this[k]
        return raw instanceof Date ? 'Date(' + raw.toISOString() + ')' : v
      })
    )
  )
  const banners = await page.locator('.banner, [data-banner], [role=alert]').allTextContents()
  const rootText = (await page.innerText('#root')).replace(/\s+/g, ' ')
  results[name] = { ...state, banners: banners.map((t) => t.trim()).filter(Boolean), rootText, errors }
  await page.close()
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2))
for (const [k, r] of Object.entries(results)) console.log(k, 'saves', r.saves?.length, 'writes', r.writes?.length, 'nav', JSON.stringify(r.nav), 'errors', r.errors)
await browser.close()
server.close()
