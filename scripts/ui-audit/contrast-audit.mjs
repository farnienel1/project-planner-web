#!/usr/bin/env node
/**
 * Contrast audit (WCAG 2.1 AA) of the web app's public pages, setup flow and public app pages.
 * Dev-only: needs a running dev server and Playwright (see README.md). Not part of CI.
 *
 *   node scripts/ui-audit/contrast-audit.mjs [--base http://localhost:3000] [--out ui-audit-out]
 *     [--widths 1280,390] [--only /register-interest,/setup] [--screenshots] [--strict-app]
 *
 * For every page it is opened with the system theme light AND dark (always-dark pages must not
 * change) and, for the signed-in app's public pages, with the app's own theme light and dark.
 * Checks, per page:
 *   - text: every visible element with its own text, against its real background (ancestor colours
 *     composited over the canvas; for an opaque gradient every colour stop is tried and the worst
 *     kept; see-through pattern layers are ignored). 4.5:1, or 3:1 for large text (24px, or 18.66px
 *     bold). Disabled controls are listed separately (WCAG exempt).
 *   - placeholders (4.5:1), form-field borders against their surroundings (3:1, reported),
 *     focus indicators of the first three fields (3:1), horizontal page overflow (0).
 * Setup wizard: every step and sub-step, opened through the wizard's own session draft (no
 * sign-in, nothing saved), the account step with its validation errors and the logo crop dialog.
 * Exits 1 when a text, placeholder, focus indicator or overflow check fails on an always-dark
 * surface, or an app page does not follow the app theme. App-page findings are listed separately
 * and fail the run only with --strict-app.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true])
    return acc
  }, []),
)
const BASE = String(args.base || 'http://localhost:3000').replace(/\/$/, '')
const OUT = String(args.out || 'ui-audit-out')
const WIDTHS = String(args.widths || '1280,390').split(',').map(Number)
const SHOTS = Boolean(args.screenshots)
const ONLY = args.only ? String(args.only).split(',') : null

/** Always-dark pages: public website, register-interest, setup flow (owner, 14 Nov). */
const SITE_PAGES = [
  '/', '/features', '/features/scheduling', '/pricing', '/about', '/support', '/download',
  '/privacy', '/terms', '/processors', '/register-interest', '/setup/cancel', '/setup/check-email',
  '/setup/success', '/setup/verify-email', '/setup/email-preview', '/this-page-does-not-exist',
]
/** Signed-in app pages reachable signed out; they follow the app's own light/dark theme. */
const APP_PAGES = ['/login', '/reset-password', '/setup-password', '/developer-login']
const WIZARD_STEPS = ['account', 'organization', 'explore', 'org-details', 'org-features', 'guided', 'plan', 'review']
const WIZARD_DRAFT_KEY = 'pp.setupWizard.v1'
const THEME_KEY = 'pp-theme'
const LOGO_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAOklEQVR42u3OMQ0AAAgDIN8/9K3hHFjMOQ0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4cBEBAAHHNSd6AAAAAElFTkSuQmCC'

/* ---------- runs in the page ---------- */
function auditPage() {
  const parse = (s) => {
    if (!s) return null
    let m = s.match(/color\(srgb ([^)]+)\)/)
    if (m) { const p = m[1].split(/[ /]+/).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1] }
    m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
  }
  const colorsIn = (img) => {
    const out = []
    const re = /(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}\b|color\(srgb[^)]+\))/g
    let m
    while ((m = re.exec(img))) {
      const v = m[1]
      if (v.startsWith('#')) {
        let h = v.slice(1)
        if (h.length === 3) h = h.split('').map((c) => c + c).join('')
        out.push([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1])
      } else out.push(parse(v))
    }
    return out.filter(Boolean)
  }
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1]
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const canvasRaw = parse(getComputedStyle(document.documentElement).backgroundColor)
  const canvas = canvasRaw && canvasRaw[3] > 0 ? canvasRaw : parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]
  const backgrounds = (el) => {
    const layers = []
    let image = false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      const img = cs.backgroundImage
      if (img && img !== 'none') {
        if (/url\(/.test(img)) image = true
        const parts = []; let depth = 0, cur = ''
        for (const ch of img) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch }
        parts.push(cur)
        const opaque = parts.map(colorsIn).find((stops) => stops.length && stops.every((s) => s[3] >= 0.99))
        if (opaque) { layers.push(opaque); break }
      }
      const c = parse(cs.backgroundColor)
      if (c && c[3] > 0) { layers.push([c]); if (c[3] >= 0.99) break }
    }
    let cands = [canvas]
    for (let i = layers.length - 1; i >= 0; i--) {
      const next = []
      for (const s of layers[i]) for (const b of cands) next.push(over(s, b))
      cands = next.slice(0, 40)
    }
    return { cands, image }
  }
  const disabled = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.matches(':disabled, [aria-disabled="true"]')) return true
      if (parseFloat(getComputedStyle(n).opacity) < 0.6) return true
    }
    return false
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (r.right < 0 || r.left > document.documentElement.clientWidth + 2) return false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false
      if (n.getAttribute('aria-hidden') === 'true' && !n.closest('.ds-snap')) return false
    }
    return true
  }
  const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''}`
  const res = { texts: 0, fails: [], disabledFails: [], placeholders: [], fields: [] }
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, script, style, noscript, nextjs-portal')) continue
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
    if (!own || !visible(el)) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    if (!fg || fg[3] === 0 || cs.backgroundClip === 'text') continue
    res.texts++
    const { cands, image } = backgrounds(el)
    let worst = Infinity, worstBg = null
    for (const b of cands) { const r = ratio(over(fg, b), b); if (r < worst) { worst = r; worstBg = b } }
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
    if (worst < need) {
      const row = { el: describe(el), text: own.slice(0, 60), ratio: +worst.toFixed(2), need, fg: cs.color, bg: `rgb(${worstBg.slice(0, 3).map(Math.round).join(', ')})`, image }
      ;(disabled(el) ? res.disabledFails : res.fails).push(row)
    }
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const own = backgrounds(el).cands[0]
    const around = backgrounds(el.parentElement).cands[0]
    const border = parse(cs.borderTopColor)
    const id = el.id || el.name || el.placeholder || el.type
    const ring = /inset/.test(cs.boxShadow || '')
    res.fields.push({ id, el: describe(el), border: border && parseFloat(cs.borderTopWidth) > 0 ? +ratio(over(border, around), around).toFixed(2) : 0, fill: +ratio(own, around).toFixed(2), ring })
    if (el.placeholder) res.placeholders.push({ id, ratio: +ratio(over(parse(getComputedStyle(el, '::placeholder').color), own), own).toFixed(2) })
  }
  res.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
  return res
}

function focusIndicator(index) {
  const sel = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea'
  const els = [...document.querySelectorAll(sel)].filter((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().left >= 0)
  const el = els[index]
  if (!el) return null
  el.focus()
  const parse = (s) => {
    let m = s && s.match(/color\(srgb ([^)]+)\)/)
    if (m) { const p = m[1].split(/[ /]+/).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1] }
    m = s && s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
  }
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const over = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1]
  let bg = null
  for (let n = el.parentElement; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0.99) { bg = c; break } }
  bg = bg || parse(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 1]
  const cs = getComputedStyle(el)
  const ratios = [0]
  const bc = parse(cs.borderTopColor)
  if (bc && parseFloat(cs.borderTopWidth) >= 1) ratios.push(ratio(over(bc, bg), bg))
  const oc = parse(cs.outlineColor)
  if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && oc) ratios.push(ratio(over(oc, bg), bg))
  for (const s of (cs.boxShadow || '').match(/(rgba?\([^)]+\)|color\(srgb[^)]+\))/g) || []) { const c = parse(s); if (c) ratios.push(ratio(over(c, bg), bg)) }
  return { id: el.id || el.name || el.placeholder || el.type, indicator: +Math.max(...ratios).toFixed(2) }
}

/* ---------- runner ---------- */
let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  try {
    // A global install (NODE_PATH) is found by require, not by import.
    ;({ chromium } = createRequire(import.meta.url)('playwright'))
  } catch {
    chromium = null
  }
}
if (!chromium) {
  console.error('Playwright is not installed. See scripts/ui-audit/README.md (npx playwright install chromium; npm i -D --no-save playwright).')
  process.exit(2)
}

fs.mkdirSync(OUT, { recursive: true })
const results = []
const want = (p) => !ONLY || ONLY.some((o) => p.startsWith(o))
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `${name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}.png`), fullPage: true })
}
const scrollThrough = async (page) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(60) }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
}
const record = async (page, name, mode, focus = false) => {
  const r = await page.evaluate(auditPage)
  if (focus) {
    r.focus = []
    for (let i = 0; i < 3; i++) { const f = await page.evaluate(focusIndicator, i); if (f) r.focus.push(f) }
  }
  results.push({ name, mode, ...r })
}

const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const mode = `system ${scheme} @${width}`
    for (const p of SITE_PAGES.filter(want)) {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 180000 })
      await scrollThrough(page)
      await record(page, p, mode, width === WIDTHS[0])
      if (width === WIDTHS[0] && scheme === 'light') await shot(page, `site${p}`)
      if (p === '/register-interest' && width === WIDTHS[0]) {
        const submit = await page.$('form button[type=submit]')
        if (submit) { await submit.click(); await page.waitForTimeout(400); await record(page, `${p} (errors)`, mode) }
      }
    }
    // Client-side navigation: React writes inline styles in its own form (rgb(), not the source
    // hex), so styles that only hold for server-rendered HTML show up here.
    if (want('/') && want('/features')) {
      await page.goto(BASE + '/privacy', { waitUntil: 'networkidle', timeout: 180000 })
      for (const [href, name] of [['/', '/ (client nav from /privacy)'], ['/features', '/features (client nav from /)']]) {
        await page.locator(`.mkt a[href="${href}"]:visible`).first().click() // the nav, or the footer on a phone
        await page.waitForURL((u) => new URL(u).pathname === href, { timeout: 60000 })
        await page.waitForLoadState('networkidle')
        await scrollThrough(page)
        await record(page, name, mode)
      }
    }
    if (want('/setup')) {
      for (const step of WIZARD_STEPS) {
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
        await page.evaluate(([k, s]) => sessionStorage.setItem(k, JSON.stringify({ step: s, firstName: 'Sam', surname: 'Test', email: 'sam@example.com', organizationName: 'Audit Ltd' })), [WIZARD_DRAFT_KEY, step])
        await page.goto(BASE + '/setup', { waitUntil: 'networkidle', timeout: 180000 })
        await page.waitForTimeout(1000)
        const subs = ['org-features', 'guided'].includes(step)
          ? await page.$$eval('.wz-rail .subs', (ls) => { const l = ls.find((x) => x.querySelector('button.on')); return l ? [...l.querySelectorAll('button')].map((x) => x.textContent.trim()) : [] })
          : []
        for (const sub of subs.length ? subs : [null]) {
          if (sub) {
            await page.evaluate((t) => { const l = [...document.querySelectorAll('.wz-rail .subs')].find((x) => x.querySelector('button.on')); const b = l && [...l.querySelectorAll('button')].find((x) => x.textContent.trim() === t); if (b) b.click() }, sub)
            await page.waitForTimeout(400)
          }
          const name = `/setup ${step}${sub ? ` › ${sub}` : ''}`
          await record(page, name, mode, width === WIDTHS[0])
          if (width === WIDTHS[0] && scheme === 'light') await shot(page, name)
        }
        if (width !== WIDTHS[0]) continue
        if (step === 'account') {
          const cont = await page.$('button:has-text("Continue")')
          if (cont) { await cont.click(); await page.waitForTimeout(500); await record(page, '/setup account (errors)', mode) }
        }
        if (step === 'org-details') {
          const file = await page.$('input[type=file]')
          if (file) {
            await file.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(LOGO_PNG, 'base64') })
            await page.waitForTimeout(1000)
            if (await page.$('text=Adjust organisation logo')) {
              await record(page, '/setup logo crop dialog', mode)
              if (scheme === 'light') await page.screenshot({ path: path.join(OUT, 'setup_logo_crop_dialog.png') }).catch(() => {})
            } else results.push({ name: '/setup logo crop dialog', mode, error: 'did not open' })
          }
        }
      }
    }
    await ctx.close()
  }
}
// The signed-in app's public pages follow the app's own theme: audit them in the app's light and dark.
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 }, colorScheme: theme })
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch {} }, [THEME_KEY, theme])
  const page = await ctx.newPage()
  for (const p of APP_PAGES.filter(want)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 180000 })
    const state = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), forcedDark: !!document.querySelector('.mkt, .pp-site-dark') }))
    await record(page, p, `app ${theme}`, true)
    results[results.length - 1].themeState = state
    await shot(page, `app${p}-${theme}`)
  }
  await ctx.close()
}
await browser.close()

fs.writeFileSync(path.join(OUT, 'contrast-audit.json'), JSON.stringify(results, null, 1))
// Two groups: the always-dark surfaces (they fail the run) and the signed-in app's public pages
// (they follow the app's own theme; reported, and they fail the run only with --strict-app).
const isApp = (r) => r.mode.startsWith('app ')
const summarise = (rs) => {
  const uniq = new Map()
  for (const r of rs) for (const f of r.fails || []) {
    const k = `${f.el}|${f.text}|${f.ratio}`
    if (!uniq.has(k)) uniq.set(k, { ...f, where: [] })
    uniq.get(k).where.push(`${r.name} (${r.mode})`)
  }
  return {
    uniq,
    disabled: new Set(rs.flatMap((r) => (r.disabledFails || []).map((f) => `${f.ratio} ${f.el} "${f.text}"`))),
    placeholders: [...new Set(rs.flatMap((r) => (r.placeholders || []).filter((x) => x.ratio < 4.5).map((x) => `${r.name} ${x.id}: ${x.ratio}`)))],
    focus: rs.flatMap((r) => (r.focus || []).filter((x) => x.indicator < 3).map((x) => `${r.name} (${r.mode}) ${x.id}: ${x.indicator}`)),
    focusChecked: rs.reduce((a, r) => a + (r.focus || []).length, 0),
    fields: [...new Set(rs.flatMap((r) => (r.fields || []).filter((x) => x.border < 3 && x.fill < 3 && !x.ring).map((x) => `${r.name} ${x.id}: border ${x.border}, fill ${x.fill}`)))],
    overflow: rs.filter((r) => r.overflow > 0).map((r) => `${r.name} (${r.mode}): ${r.overflow}px`),
    texts: rs.reduce((a, r) => a + (r.texts || 0), 0),
    count: rs.length,
  }
}
const print = (title, g) => {
  console.log(`\n== ${title}: ${g.count} page states, ${g.texts} text elements`)
  console.log(`text below AA: ${g.uniq.size}`)
  for (const f of g.uniq.values()) console.log(`  ${f.ratio} < ${f.need}  ${f.el} "${f.text}"  ${f.fg} on ${f.bg}${f.image ? ' [over image]' : ''}  — ${f.where.slice(0, 3).join('; ')}${f.where.length > 3 ? ` +${f.where.length - 3}` : ''}`)
  console.log(`disabled-control text below AA (WCAG exempt): ${g.disabled.size}`)
  console.log(`placeholders below 4.5: ${g.placeholders.length ? g.placeholders.join(' | ') : 'none'}`)
  console.log(`focus indicators below 3: ${g.focus.length ? g.focus.join(' | ') : 'none'} (checked ${g.focusChecked})`)
  console.log(`fields with no 3:1 boundary (warning): ${g.fields.length ? g.fields.join(' | ') : 'none'}`)
  console.log(`horizontal overflow: ${g.overflow.length ? g.overflow.join(' | ') : 'none'}`)
}
const site = summarise(results.filter((r) => !isApp(r) && !r.error))
const app = summarise(results.filter((r) => isApp(r) && !r.error))
const appTheme = results.filter((r) => r.themeState && (r.themeState.forcedDark || !r.mode.endsWith(r.themeState.theme))).map((r) => `${r.name} (${r.mode}): ${JSON.stringify(r.themeState)}`)
const errors = results.filter((r) => r.error).map((r) => `${r.name} (${r.mode}): ${r.error}`)
print('Always-dark surfaces (website, register-interest, setup flow)', site)
print("Signed-in app's public pages (the app's own light and dark)", app)
console.log(`\napp pages not following the app theme: ${appTheme.length ? appTheme.join(' | ') : 'none'}`)
if (errors.length) console.log(`errors: ${errors.join(' | ')}`)
console.log(`details: ${path.join(OUT, 'contrast-audit.json')}`)
const fails = (g) => g.uniq.size + g.placeholders.length + g.focus.length + g.overflow.length
process.exit(fails(site) || appTheme.length || errors.length || (args['strict-app'] && fails(app)) ? 1 : 0)
