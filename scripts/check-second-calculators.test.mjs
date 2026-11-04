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

test('allow-listed hits pass, unlisted hits fail, stale entries fail', () => {
  const hits = [
    { path: 'a.ts', line: 1, pattern: 'getDay', text: '' },
    { path: 'b.ts', line: 1, pattern: 'getDay', text: '' },
  ]
  const rows = [
    { path: 'a.ts', pattern: 'getDay', reason: 'display only, reviewed' },
    { path: 'gone.ts', pattern: 'getDay', reason: 'no longer there at all' },
  ]
  const { violations, stale } = evaluate(hits, rows)
  assert.deepEqual(violations.map((v) => v.path), ['b.ts'])
  assert.deepEqual(stale.map((s) => s.path), ['gone.ts'])
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
