import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PATTERNS, evaluate, loadAllowlist, scan } from './check-second-calculators.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'second-calc-'))
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, text)
  }
  return root
}

test('each smell is caught outside lib/canonical; canonical, tests and comments are not scanned', () => {
  const root = fixture({
    'components/A.tsx': [
      "if (weekday < 1 || weekday > 5) return []",
      'const d = new Date().getDay()',
      "const z = 'Europe/London'",
      'const op = findOperativeForUser(user, operatives)',
      'const mine = user.id === booking.operativeId',
      'const day = londonMidnight(date)',
      'const w = startOfWeek(now, { weekStartsOn: 1 })',
      '// a comment naming londonMidnight( is fine',
    ].join('\n'),
    'lib/canonical/engine.ts': 'if (weekday < 1) return',
    'lib/foo/bar.test.ts': 'new Date().getDay()',
  })
  const hits = scan(root)
  assert.ok(hits.every((hit) => hit.path === 'components/A.tsx'))
  const ids = new Set(hits.map((hit) => hit.pattern))
  for (const id of ['weekday-cutoff', 'getDay', 'europe-london-literal', 'findOperativeForUser', 'single-id-person-match', 'londonMidnight', 'device-week-maths']) {
    assert.ok(ids.has(id), id)
  }
  assert.equal(hits.filter((hit) => hit.line === 8).length, 0)
})

test('allow-listed hits pass up to their count; a new hit, an unlisted hit or a stale entry fails', () => {
  const hits = [
    { path: 'a.ts', line: 1, pattern: 'getDay', text: '' },
    { path: 'a.ts', line: 9, pattern: 'getDay', text: '' },
    { path: 'b.ts', line: 1, pattern: 'getDay', text: '' },
    { path: 'c.ts', line: 1, pattern: 'getDay', text: '' },
  ]
  const rows = [
    { path: 'a.ts', pattern: 'getDay', count: 2, reason: 'display only, reviewed' },
    { path: 'c.ts', pattern: 'getDay', count: 2, reason: 'one hit was removed since' },
    { path: 'gone.ts', pattern: 'getDay', count: 1, reason: 'no longer there at all' },
  ]
  const first = evaluate(hits, rows)
  assert.deepEqual(first.violations.map((v) => v.path), ['b.ts'])
  assert.deepEqual(first.stale.map((s) => s.path).sort(), ['c.ts', 'gone.ts'])
  // A third getDay in an allow-listed file fails even though the file is listed.
  const more = evaluate([...hits, { path: 'a.ts', line: 20, pattern: 'getDay', text: '' }], rows)
  assert.deepEqual(more.overCount.map((o) => [o.path, o.actual, o.count]), [['a.ts', 3, 2]])
  assert.ok(more.violations.some((v) => v.path === 'a.ts'))
})

test('single-id-person-match catches operativeId comparisons in either direction, not normalizeDocumentId calls', () => {
  const pattern = PATTERNS.find((p) => p.id === 'single-id-person-match').regex
  assert.ok(pattern.test('bookings.filter((existing) => existing.operativeId === operativeId)'))
  assert.ok(pattern.test('if (booking.operativeId !== subject.operativeId) continue'))
  assert.ok(pattern.test('const mine = focusId === b.operativeId'))
  assert.ok(pattern.test('operatives.find((o) => o.id === b.operativeId)'))
  assert.equal(pattern.test('normalizeDocumentId(existing.operativeId) === normalizeDocumentId(operativeId)'), false)
  assert.equal(pattern.test('const operativeId = booking.operativeId'), false)
})

test('the committed allow-list is well formed and the repo passes', () => {
  const { rows, problems } = loadAllowlist()
  assert.deepEqual(problems, [])
  const known = new Set(PATTERNS.map((p) => p.id))
  assert.ok(rows.every((row) => known.has(row.pattern)))
  const { violations, stale } = evaluate(scan(), rows)
  assert.deepEqual(violations, [])
  assert.deepEqual(stale, [])
})
