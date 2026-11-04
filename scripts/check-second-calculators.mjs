#!/usr/bin/env node
/**
 * Second-calculator guard (docs/agent-rules/feature-completeness.md, platform-guardrails.md §1–2).
 *
 * Scans components/, app/ and lib/ (not lib/canonical, not tests) for code that re-derives a rule the rulebook owns:
 * own weekend / weekday cut-offs, browser or London-only business dates, and person matching by a single id.
 * Each hit must either be replaced by the rulebook function (`@/lib/canonical`) or be listed in
 * scripts/second-calculator-allowlist.json as { path, pattern, reason } with a reason a reviewer can challenge.
 *
 * The check also fails on a stale allow-list entry (the file no longer has that pattern), so the list only shrinks.
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
 * browser or London instead of the organisation zone.
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
    regex: /\.id\s*===\s*[\w.?]*[oO]perativeId\b|[oO]perativeId\s*===\s*[\w.?]*\.id\b/,
    fix: 'personIdSet / bookingIdsForAccount (ids compare without case, normalizeDocumentId)',
  },
]

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
      const lines = readFileSync(file, 'utf8').split('\n')
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
    else if (!known.has(row.pattern)) problems.push(`entry ${i} (${row.path}): unknown pattern "${row.pattern}"`)
    if (!row || typeof row.reason !== 'string' || row.reason.trim().length < 10) {
      problems.push(`entry ${i} (${row?.path}): needs a reason a reviewer can challenge`)
    }
  })
  return { rows, problems }
}

export function evaluate(hits, rows) {
  const allowed = new Set(rows.map((row) => `${row.path}::${row.pattern}`))
  const violations = hits.filter((hit) => !allowed.has(`${hit.path}::${hit.pattern}`))
  const used = new Set(hits.map((hit) => `${hit.path}::${hit.pattern}`))
  const stale = rows.filter((row) => !used.has(`${row.path}::${row.pattern}`))
  return { violations, stale }
}

function main() {
  const hits = scan()
  if (process.argv.includes('--list')) {
    for (const hit of hits) console.log(`${hit.path}:${hit.line}  [${hit.pattern}]  ${hit.text}`)
    console.log(`\n${hits.length} hit(s).`)
    return
  }
  const { rows, problems } = loadAllowlist()
  const { violations, stale } = evaluate(hits, rows)
  let failed = false
  if (problems.length) {
    failed = true
    console.error('second-calculator-allowlist.json is malformed:')
    for (const p of problems) console.error(`  ${p}`)
  }
  if (violations.length) {
    failed = true
    console.error('Second calculators outside lib/canonical (call the rulebook function, or allow-list with a reason):')
    for (const v of violations) {
      const pattern = PATTERNS.find((p) => p.id === v.pattern)
      console.error(`  ${v.path}:${v.line}  [${v.pattern}]  ${v.text}`)
      console.error(`      → use ${pattern.fix}`)
    }
  }
  if (stale.length) {
    failed = true
    console.error('Stale allow-list entries (the pattern is gone from the file — delete the entry):')
    for (const s of stale) console.error(`  ${s.path}  [${s.pattern}]`)
  }
  if (failed) process.exit(1)
  console.log(`check-second-calculators: ${hits.length} hit(s), all allow-listed with a reason (${rows.length} entries).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
