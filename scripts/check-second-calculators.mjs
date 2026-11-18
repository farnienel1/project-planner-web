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
    // Never matched by this regex: `superAdminHidesPayFieldHits` finds these (declarations span lines, aliases and
    // early returns need the whole file).
    regex: /(?!)/,
    fix: 'show the field for every level; decide who may edit with canChangePersonPay / canEditTargetUser (lib/staff/editUserSections.ts)',
  },
]

/**
 * 17 Nov owner bug: web Edit User hid Employment type and the Annual leave allowance with `!target.isSuperAdmin`
 * (commit 69099425), so the Super Admin could never be set to PAYE. The rulebook never hides a person's pay, employment
 * type or leave fields because of their level (§4.4, §8): who may change them is `canChangePersonPay` and the rules.
 *
 * "The Super Admin" here is the person shown — a subject such as `target`, `person`, `subject`, `user`, `row` or a bare
 * `isSuperAdmin` prop — never the viewer (`currentUser`, `viewer`, `actor`, `me`, …): a viewer check decides what the
 * viewer may do, which is allowed. A subject test is:
 *   `!x.isSuperAdmin`, `x.isSuperAdmin ? …`, `x.isSuperAdmin !== true` / `=== false` / `!= true` / `== false`,
 *   `!isOrganizationSuperAdmin(x, …)` (also `userIsOrganizationSuperAdmin`, `isSuperAdminAccount`,
 *   `isProtectedSuperAdmin`), and the same through an alias (`const hidePay = target.isSuperAdmin` … `!hidePay &&`).
 *
 * Flags, outside lib/canonical:
 *   - a `const` / `let` whose name or value is about pay, employment type or leave and whose value holds a subject
 *     test (the declaration may span lines);
 *   - a line (JSX) that holds a subject test and names one of those fields;
 *   - an early return on the subject being the Super Admin (`if (target.isSuperAdmin) return null`) in a component or
 *     function that is about those fields (its name, or the next 60 lines).
 */
const PAY_FIELD_WORDS =
  /[Ee]mploymentType|showEmployment|[Pp]ayBasis|PayBasisFields|dayRate|hourlyRate|[Pp]ayRate|[Pp]ayroll|[Aa]nnualLeave|[Ll]eaveAllowance|showPay|hidePay|[Pp]ayFields|[Pp]ayProfile/
const VIEWER_NAMES = new Set([
  'currentuser', 'viewer', 'actor', 'me', 'signedinuser', 'authuser', 'sessionuser', 'writer', 'acting', 'actinguser',
  'current', 'currentperson', 'loggedinuser', 'viewinguser', 'saver',
])
const SUPER_ADMIN_FUNCTIONS = 'isOrganizationSuperAdmin|userIsOrganizationSuperAdmin|isSuperAdminAccount|isProtectedSuperAdmin'
const DECLARATION_START = /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=/
const FUNCTION_START = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\()/

function isViewer(owner) {
  return Boolean(owner) && VIEWER_NAMES.has(owner.toLowerCase())
}

/** Every `isSuperAdmin` read on a subject (not the viewer): `{ index, end, negated, form }`. */
function subjectSuperAdminReads(text, aliases) {
  const reads = []
  const property = /(!\s*\(?\s*)?((?:[A-Za-z_$][\w$]*\s*\??\.\s*)*)isSuperAdmin\b(?!\s*\()/g
  for (let m; (m = property.exec(text)); ) {
    const before = text[m.index - 1] ?? ''
    if (!m[1] && /[\w$.]/.test(before)) continue
    // Any part of the chain naming the viewer (`viewer.role.isSuperAdmin`, `currentUser?.isSuperAdmin`) is not a subject.
    if ((m[2] || '').split(/\s*\??\.\s*/).some(isViewer)) continue
    reads.push({ index: m.index, end: property.lastIndex, negated: Boolean(m[1]) })
  }
  const call = new RegExp(`(!\\s*)?\\b(?:${SUPER_ADMIN_FUNCTIONS})\\(\\s*([A-Za-z_$][\\w$]*)`, 'g')
  for (let m; (m = call.exec(text)); ) {
    if (isViewer(m[2])) continue
    reads.push({ index: m.index, end: call.lastIndex, negated: Boolean(m[1]) })
  }
  for (const alias of aliases) {
    const ref = new RegExp(`(!\\s*)?\\b${alias}\\b(?!\\s*[=:](?!=))`, 'g')
    for (let m; (m = ref.exec(text)); ) reads.push({ index: m.index, end: ref.lastIndex, negated: Boolean(m[1]) })
  }
  return reads
}

/** A read used to hide: negated, a ternary on it, or compared with true / false. */
function hidesOnSubject(text, aliases) {
  for (const read of subjectSuperAdminReads(text, aliases)) {
    if (read.negated) return true
    const after = text.slice(read.end, read.end + 24)
    if (/^\)?\s*\?(?!\.)/.test(after)) return true
    if (/^\s*(?:!==?\s*true|===?\s*false|!=\s*true|==\s*false)\b/.test(after)) return true
  }
  return false
}

/** Names assigned straight from a subject Super Admin test: `const hidePay = target.isSuperAdmin`. */
function superAdminAliases(lines) {
  const aliases = []
  for (const line of lines) {
    const m = /^\s*(?:const|let)\s+(\w+)\s*=\s*([^;]+)$/.exec(line)
    if (!m || /\bisSuperAdmin\b|SuperAdmin\w*\(/.test(m[2]) === false) continue
    const rhs = m[2].trim().replace(/;$/, '')
    if (subjectSuperAdminReads(rhs, []).some((read) => !read.negated) && !/[?&|]/.test(rhs)) aliases.push(m[1])
  }
  return aliases
}

export function superAdminHidesPayFieldHits(text) {
  const lines = text.split('\n')
  const code = lines.map((line) => (isCommentLine(line) ? '' : line))
  const aliases = superAdminAliases(code)
  const hits = []
  const covered = new Set()
  for (let i = 0; i < code.length; i += 1) {
    const match = DECLARATION_START.exec(code[i])
    if (!match || aliases.includes(match[1])) continue
    let end = i
    // The declaration's value: until a blank line or the next statement at the same or a lower indent.
    const indent = code[i].search(/\S/)
    for (let j = i + 1; j < code.length; j += 1) {
      const line = code[j]
      if (!line.trim()) break
      if (line.search(/\S/) <= indent && !/^\s*[)\]}&|?:.]/.test(line)) break
      end = j
    }
    const body = code.slice(i, end + 1).join('\n')
    if (hidesOnSubject(body, aliases) && (PAY_FIELD_WORDS.test(match[1]) || PAY_FIELD_WORDS.test(body))) {
      hits.push({ line: i + 1, text: lines[i].trim() })
      for (let k = i; k <= end; k += 1) covered.add(k)
    }
  }
  code.forEach((line, index) => {
    if (covered.has(index) || !line.trim()) return
    if (hidesOnSubject(line, aliases) && PAY_FIELD_WORDS.test(line)) {
      hits.push({ line: index + 1, text: lines[index].trim() })
      covered.add(index)
      return
    }
    // An early return because the subject is the Super Admin, in a function about pay, employment or leave.
    // Only a condition that is the subject test alone, returning nothing (`return null`, `return`, `return <></>`).
    const early = /^\s*if\s*\((.*)\)\s*(?:\{\s*)?return\s*(?:null|false|undefined|<>\s*<\/>)?\s*;?\s*\}?\s*$/.exec(line)
    if (!early) return
    const condition = early[1].trim()
    if (/&&|\|\||[=!]==?|[<>?]/.test(condition.replace(/^!/, '').replace(/\?\./g, '.'))) return
    const reads = subjectSuperAdminReads(condition, aliases)
    if (reads.length !== 1 || reads[0].negated) return
    let name = ''
    for (let k = index; k >= 0 && k > index - 200; k -= 1) {
      const fn = FUNCTION_START.exec(code[k])
      if (fn) { name = fn[1] || fn[2] || ''; break }
    }
    const ahead = code.slice(index + 1, index + 61).join('\n')
    if (PAY_FIELD_WORDS.test(name) || PAY_FIELD_WORDS.test(ahead)) hits.push({ line: index + 1, text: lines[index].trim() })
  })
  return hits.sort((a, b) => a.line - b.line)
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
