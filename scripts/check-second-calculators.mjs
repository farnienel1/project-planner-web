#!/usr/bin/env node
/**
 * Second-calculator guard (docs/agent-rules/feature-completeness.md, platform-guardrails.md §1–2).
 *
 * Scans components/, app/ and lib/ (not lib/canonical, not tests) for code that re-derives a rule the rulebook owns:
 * own weekend / weekday cut-offs, browser or London-only business dates, and person matching by a single id.
 * Each hit must either be replaced by the rulebook function (`@/lib/canonical`) or be listed in
 * scripts/second-calculator-allowlist.json as { path, pattern, count, reason } with a reason a reviewer can challenge.
 * `count` is the number of hits of that pattern the file may have: a new hit in an allow-listed file fails.
 *
 * The check also fails on a stale entry (fewer hits than `count`, or none), so the list only shrinks: lower the
 * count (or delete the entry) in the same change that removes a hit.
 *
 *   node scripts/check-second-calculators.mjs          # check
 *   node scripts/check-second-calculators.mjs --list   # print every hit, allowed or not
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ALLOWLIST = join(ROOT, 'scripts', 'second-calculator-allowlist.json')
const SCAN_DIRS = ['components', 'app', 'lib']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])

/** Paths (posix, relative to the repo) that are the rulebook or are packed into it. */
const EXCLUDED_PREFIXES = [
  'lib/canonical/',
  // Imported by lib/canonical and packed into canonical-business.js (the organisation zone table and zone maths).
  'lib/orgTime/orgTimeZone.ts',
  'lib/orgTime/zoneTime.ts',
]

/**
 * Each pattern names one smell. `id` is what the allow-list refers to.
 * Category 1: own business calculations. Category 2: person matching by one id. Category 3: business dates from the
 * browser or London instead of the organisation zone. Category 4 (`super-admin-hides-pay-fields`) is found by
 * `superAdminHidesPayFieldHits`, not a one-line regex: a screen that hides pay, employment type or leave fields because
 * the person is the Super Admin.
 */
export const PATTERNS = [
  {
    id: 'weekday-cutoff',
    category: 1,
    regex: /\b(?:weekday|isoWeekday|iso|wd|dow)\s*(?:<|>|<=|>=)\s*[0-7]\b/,
    fix: 'isStandardWorkingWeekday / isWeekendDayKey / unbookedScanDays',
  },
  {
    id: 'getDay',
    category: 3,
    regex: /\.getDay\(\)/,
    fix: 'isoWeekdayOfDayKey(dayKey, organizationTimeZone(...))',
  },
  {
    id: 'getHours',
    category: 3,
    regex: /\.getHours\(\)/,
    fix: 'partsInZone / formatShortTime with the organisation zone',
  },
  {
    id: 'londonMidnight',
    category: 3,
    regex: /\blondonMidnight\(/,
    fix: 'dateFromDayKeyInZone / midnightInZone with the organisation zone',
  },
  {
    id: 'londonIsoWeekday',
    category: 3,
    regex: /\blondonIsoWeekday\(/,
    fix: 'isoWeekdayOfDayKey(dayKey, organizationTimeZone(...))',
  },
  {
    id: 'europe-london-literal',
    category: 3,
    regex: /['"`]Europe\/London['"`]/,
    fix: 'organizationTimeZone(countryCode) / useOrganizationTimeZone() / organizationZoneOr()',
  },
  {
    id: 'london-zone-constant',
    category: 3,
    regex: /\bLONDON_TIME_ZONE\b/,
    fix: 'organizationZoneOr(timeZone) / organizationTimeZone(countryCode)',
  },
  {
    id: 'country-zone-table',
    category: 3,
    regex: /\bianaTimeZoneForCountry\(/,
    fix: 'organizationTimeZone (rulebook §1)',
  },
  {
    id: 'device-week-maths',
    category: 3,
    regex: /\b(?:startOfWeek|endOfWeek|getISODay|isWeekend|isSaturday|isSunday)\(/,
    fix: 'organisation-zone week (startOfLondonWeek with the org zone, isWeekendDayKey, eachDayKey)',
  },
  {
    id: 'toLocaleDateString',
    category: 3,
    regex: /\.toLocaleDateString\(/,
    fix: 'Intl.DateTimeFormat with the organisation zone (display only); dayKey for keys',
  },
  {
    id: 'findOperativeForUser',
    category: 2,
    regex: /\bfindOperativeForUser\(/,
    fix: 'personIdSet / bookingIdsForAccount / rosterPeople userIdAliases (display may keep it)',
  },
  {
    id: 'single-id-person-match',
    category: 2,
    // `x.id === y.operativeId`, `operativeId === x.id`, and any `x.operativeId ===` / `=== x.operativeId` comparison.
    regex:
      /\.id\s*[!=]==\s*[\w.?]*[oO]perativeId\b|[oO]perativeId\s*[!=]==\s*[\w.?]*\.id\b|\.operativeId\s*[!=]==\s*[\w.?'"]|[\w)\]?]\s*[!=]==\s*[\w?]+(?:\.[\w?]+)*\.operativeId\b/,
    fix: 'personIdSet / bookingIdsForAccount (ids compare without case, normalizeDocumentId)',
  },
  {
    id: 'super-admin-hides-pay-fields',
    category: 4,
    // Matched by `superAdminHidesPayFieldHits` (a declaration can span lines); never by this regex.
    regex: /(?!)/,
    fix: 'show the field for every level; decide who may edit with canChangePersonPay / canEditTargetUser (lib/staff/editUserSections.ts)',
  },
]

/**
 * 17 Nov owner bug: web Edit User hid Employment type and the Annual leave allowance with `!target.isSuperAdmin`
 * (commit 69099425), so the Super Admin could never be set to PAYE. The rulebook never hides a person's pay, employment
 * type or leave fields because of their level (§4.4, §8): who may change them is `canChangePersonPay` and the rules.
 *
 * Flags, outside lib/canonical:
 *   - a `const` / `let` whose name or value is about pay, employment type or leave and whose value tests
 *     `!….isSuperAdmin` or `….isSuperAdmin ? … : …` / `isSuperAdmin ||` (the declaration may span lines);
 *   - a line (JSX) that tests `!….isSuperAdmin` or `….isSuperAdmin ?` and names one of those fields.
 */
const PAY_FIELD_WORDS =
  /[Ee]mploymentType|showEmployment|[Pp]ayBasis|PayBasisFields|dayRate|hourlyRate|[Pp]ayRate|[Pp]ayroll|[Aa]nnualLeave|[Ll]eaveAllowance|showPay/
const SUPER_ADMIN_HIDES = /!\s*\(?\s*[\w?.]*\.?isSuperAdmin\b|[\w?.]*\.isSuperAdmin\s*\?(?!\.)/
const DECLARATION_START = /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=/

export function superAdminHidesPayFieldHits(text) {
  const lines = text.split('\n')
  const hits = []
  const covered = new Set()
  for (let i = 0; i < lines.length; i += 1) {
    const match = DECLARATION_START.exec(lines[i])
    if (!match) continue
    let end = i
    // The declaration's value: until a blank line or the next statement at the same or a lower indent.
    const indent = lines[i].search(/\S/)
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j]
      if (!line.trim()) break
      if (line.search(/\S/) <= indent && !/^\s*[)\]}&|?:.]/.test(line)) break
      end = j
    }
    const body = lines.slice(i, end + 1).filter((line) => !isCommentLine(line)).join('\n')
    if (SUPER_ADMIN_HIDES.test(body) && (PAY_FIELD_WORDS.test(match[1]) || PAY_FIELD_WORDS.test(body))) {
      hits.push({ line: i + 1, text: lines[i].trim() })
      for (let k = i; k <= end; k += 1) covered.add(k)
    }
  }
  lines.forEach((line, index) => {
    if (covered.has(index) || isCommentLine(line)) return
    if (SUPER_ADMIN_HIDES.test(line) && PAY_FIELD_WORDS.test(line)) hits.push({ line: index + 1, text: line.trim() })
  })
  return hits
}

function toPosix(path) {
  return path.split(sep).join('/')
}

function isExcluded(rel) {
  if (EXCLUDED_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix))) return true
  if (/\.test\.(?:ts|tsx|js|mjs)$/.test(rel) || /\.spec\.(?:ts|tsx|js|mjs)$/.test(rel)) return true
  if (rel.includes('/__tests__/')) return true
  return false
}

function walk(dir, out) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue
    const full = join(dir, name)
    const stats = statSync(full)
    if (stats.isDirectory()) walk(full, out)
    else if (EXTENSIONS.has(name.slice(name.lastIndexOf('.')))) out.push(full)
  }
  return out
}

/** Comment lines are not code: a rationale that names a pattern is fine. */
function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

export function scan(root = ROOT) {
  const hits = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(root, dir), [])) {
      const rel = toPosix(relative(root, file))
      if (isExcluded(rel)) continue
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n')
      for (const hit of superAdminHidesPayFieldHits(text)) hits.push({ path: rel, line: hit.line, pattern: 'super-admin-hides-pay-fields', text: hit.text })
      lines.forEach((line, index) => {
        if (isCommentLine(line)) return
        for (const pattern of PATTERNS) {
          if (pattern.regex.test(line)) hits.push({ path: rel, line: index + 1, pattern: pattern.id, text: line.trim() })
        }
      })
    }
  }
  return hits
}

export function loadAllowlist(path = ALLOWLIST) {
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(rows)) throw new Error('second-calculator-allowlist.json must be an array')
  const known = new Set(PATTERNS.map((p) => p.id))
  const problems = []
  rows.forEach((row, i) => {
    if (!row || typeof row.path !== 'string' || typeof row.pattern !== 'string') problems.push(`entry ${i}: needs path and pattern`)
    if (!row || !Number.isInteger(row.count) || row.count < 1) problems.push(`entry ${i} (${row?.path}): needs count, a whole number of allowed hits`)
    else if (!known.has(row.pattern)) problems.push(`entry ${i} (${row.path}): unknown pattern "${row.pattern}"`)
    if (!row || typeof row.reason !== 'string' || row.reason.trim().length < 10) {
      problems.push(`entry ${i} (${row?.path}): needs a reason a reviewer can challenge`)
    }
  })
  return { rows, problems }
}

export function evaluate(hits, rows) {
  const counts = new Map()
  for (const hit of hits) {
    const key = `${hit.path}::${hit.pattern}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const allowed = new Map(rows.map((row) => [`${row.path}::${row.pattern}`, row]))
  const violations = []
  const overCount = []
  for (const [key, n] of counts) {
    const row = allowed.get(key)
    const fileHits = hits.filter((hit) => `${hit.path}::${hit.pattern}` === key)
    if (!row) violations.push(...fileHits)
    else if (n > (row.count ?? 0)) {
      violations.push(...fileHits)
      overCount.push({ ...row, actual: n })
    }
  }
  const stale = rows
    .map((row) => ({ ...row, actual: counts.get(`${row.path}::${row.pattern}`) || 0 }))
    .filter((row) => row.actual < row.count)
  return { violations, stale, overCount }
}

function main() {
  const hits = scan()
  if (process.argv.includes('--list')) {
    for (const hit of hits) console.log(`${hit.path}:${hit.line}  [${hit.pattern}]  ${hit.text}`)
    console.log(`\n${hits.length} hit(s).`)
    return
  }
  const { rows, problems } = loadAllowlist()
  const { violations, stale, overCount } = evaluate(hits, rows)
  let failed = false
  if (problems.length) {
    failed = true
    console.error('second-calculator-allowlist.json is malformed:')
    for (const p of problems) console.error(`  ${p}`)
  }
  if (violations.length) {
    failed = true
    console.error('Second calculators outside lib/canonical (call the rulebook function, or allow-list with a reason):')
    for (const o of overCount) console.error(`  ${o.path} [${o.pattern}]: ${o.actual} hits, allow-list permits ${o.count}`)
    for (const v of violations) {
      const pattern = PATTERNS.find((p) => p.id === v.pattern)
      console.error(`  ${v.path}:${v.line}  [${v.pattern}]  ${v.text}`)
      console.error(`      → use ${pattern.fix}`)
    }
  }
  if (stale.length) {
    failed = true
    console.error('Stale allow-list entries (fewer hits than allowed — lower the count or delete the entry):')
    for (const s of stale) console.error(`  ${s.path}  [${s.pattern}]: ${s.actual} hit(s), count ${s.count}`)
  }
  if (failed) process.exit(1)
  console.log(`check-second-calculators: ${hits.length} hit(s), all allow-listed with a reason (${rows.length} entries).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
