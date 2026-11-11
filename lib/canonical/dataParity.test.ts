/**
 * Rulebook 1.38.0 §27 (owner decision 11 Nov): the in-app data check.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DATA_PARITY_CHECKS,
  DATA_PARITY_MIN_INTERVAL_MS,
  dataParityCheck,
  dataParityCheckDue,
  dataParityLogAppend,
  dataParityLogEntry,
  dataParitySumCounts,
  dataParitySummary,
} from './dataParity'

test('1.38.0 data check: every list the owner named is checked', () => {
  assert.deepEqual(
    DATA_PARITY_CHECKS.map((check) => check.key),
    ['projects', 'smallWorks', 'users', 'operatives', 'managers', 'clients', 'bookings', 'managerSiteBookings', 'holidayBookings', 'tasks']
  )
  assert.equal(DATA_PARITY_CHECKS.find((c) => c.key === 'users')?.scope, 'users')
  assert.equal(DATA_PARITY_CHECKS.find((c) => c.key === 'bookings')?.windowed, true)
})

test('1.38.0 data check: 7 on the server and 6 on the device is a reload of projects (the Carnaby Street case)', () => {
  const result = dataParityCheck({
    lists: [
      { key: 'projects', serverCount: 7, localCount: 6 },
      { key: 'smallWorks', serverCount: 3, localIds: ['a', 'b', 'c'] },
    ],
  })
  assert.equal(result.ok, false)
  assert.equal(result.action, 'reload')
  assert.deepEqual(result.reloadKeys, ['projects'])
  assert.deepEqual(result.checked, ['projects', 'smallWorks'])
  assert.deepEqual(result.mismatches[0], {
    key: 'projects', label: 'Projects', serverCount: 7, localCount: 6, difference: -1, direction: 'missingOnDevice',
  })
})

test('1.38.0 data check: extra held rows, duplicate ids, the placeholder and skipped lists', () => {
  const result = dataParityCheck({
    lists: [
      { key: 'bookings', serverCount: 2, localIds: ['x', 'x', 'y', 'z'] },
      { key: 'projects', serverCount: 5, localCount: 4, readerDroppedCount: 1 },
      { key: 'users', serverCount: null, localCount: 3 },
      { key: 'tasks', skipped: 'documentReads' },
      { key: 'nonsense', serverCount: 1, localCount: 1 },
    ],
  })
  assert.deepEqual(result.reloadKeys, ['bookings'])
  assert.equal(result.mismatches[0].direction, 'extraOnDevice')
  assert.equal(result.mismatches[0].localCount, 3)
  assert.deepEqual(result.checked, ['projects', 'bookings'])
  assert.deepEqual(
    result.skipped.map((s) => `${s.key}:${s.reason}`).sort(),
    ['nonsense:unknownList', 'tasks:documentReads', 'users:serverCountUnavailable']
  )
  assert.deepEqual(dataParityCheck({ lists: [] }), {
    ok: true, action: 'none', mismatches: [], reloadKeys: [], checked: [], skipped: [],
  })
})

test('1.38.0 data check: throttle, offline and Check now', () => {
  const now = 1_800_000_000_000
  assert.equal(dataParityCheckDue({ trigger: 'open', nowMs: now, online: true }), true)
  assert.equal(dataParityCheckDue({ trigger: 'foreground', lastCheckedMs: now - 60_000, nowMs: now, online: true }), false)
  assert.equal(dataParityCheckDue({ trigger: 'timer', lastCheckedMs: now - DATA_PARITY_MIN_INTERVAL_MS, nowMs: now, online: true }), true)
  assert.equal(dataParityCheckDue({ trigger: 'manual', lastCheckedMs: now - 1, nowMs: now, online: true }), true)
  assert.equal(dataParityCheckDue({ trigger: 'manual', nowMs: now, online: false }), false)
  assert.equal(dataParityCheckDue({ trigger: 'open', lastCheckedMs: now + 60_000, nowMs: now, online: true }), true)
  assert.equal(dataParityCheckDue({ trigger: 'other', nowMs: now, online: true }), false)
})

test('1.38.0 data check: log entry, heal outcome, cap and summary text', () => {
  const first = dataParityCheck({
    lists: [
      { key: 'projects', serverCount: 7, localCount: 6 },
      { key: 'clients', serverCount: 4, localCount: 5 },
    ],
  })
  const recheck = dataParityCheck({
    lists: [
      { key: 'projects', serverCount: 7, localCount: 7 },
      { key: 'clients', serverCount: 4, localCount: 5 },
    ],
  })
  // 14:05 London (GMT in November).
  const atMs = Date.UTC(2026, 10, 11, 14, 5)
  const entry = dataParityLogEntry({ atMs, trigger: 'foreground', first, recheck })
  assert.equal(entry.ok, false)
  assert.deepEqual(entry.mismatches.map((m) => [m.key, m.healed]), [['projects', true], ['clients', false]])
  const summary = dataParitySummary({ entry, timeZone: 'Europe/London' })
  assert.equal(summary.tone, 'warning')
  assert.equal(summary.title, 'Data check: 1 list does not match the server (checked 14:05)')
  assert.deepEqual(summary.lines, [
    'Projects: server 7, this device 6 — reloaded, now matches',
    'Clients: server 4, this device 5 — reloaded, still differs (server 4, this device 5)',
  ])
  const clean = dataParityLogEntry({ atMs, trigger: 'manual', first: dataParityCheck({ lists: [{ key: 'tasks', serverCount: 1, localCount: 1 }] }) })
  assert.equal(dataParitySummary({ entry: clean, timeZone: 'Europe/London' }).title, 'Data check: all lists match (checked 14:05)')
  const healedOnly = dataParityLogEntry({ atMs, trigger: 'timer', first, recheck: dataParityCheck({ lists: [{ key: 'projects', serverCount: 7, localCount: 7 }, { key: 'clients', serverCount: 4, localCount: 4 }] }) })
  assert.equal(healedOnly.ok, true)
  assert.equal(dataParitySummary({ entry: healedOnly, timeZone: 'Europe/London' }).title, 'Data check: 2 lists were reloaded and now match (checked 14:05)')
  assert.equal(dataParitySummary({ entry: null }).tone, 'none')
  let log = [] as ReturnType<typeof dataParityLogAppend>
  for (let i = 0; i < 25; i += 1) log = dataParityLogAppend(log, { ...clean, atMs: i })
  assert.equal(log.length, 20)
  assert.equal(log[0].atMs, 5)
  assert.equal(log[19].atMs, 24)
})

test('1.38.0 data check: counts of disjoint plan parts are summed; one unknown part makes the total unknown', () => {
  assert.equal(dataParitySumCounts([2, 3, 0]), 5)
  assert.equal(dataParitySumCounts([2, null]), null)
  assert.equal(dataParitySumCounts([]), 0)
})

import fixture from './data-parity-fixture.json'

type FixtureDoc = { id: string; data: Record<string, unknown> }
type FixtureStep = {
  id: string
  writes: Array<{ op: 'set' | 'delete'; list: string; id: string; data?: Record<string, unknown> }>
  events: Array<{ list: string; source: 'server' | 'cache' | 'refused'; ids?: string[] }>
  expectedHeld: Record<string, string[]>
  expectedVisible: Record<string, string[]>
  expectedParityMismatches: string[]
}

test('1.38.0 data-parity fixture: every server snapshot leaves exactly the database held, and the check finds the refused listener', () => {
  const db: Record<string, FixtureDoc[]> = JSON.parse(JSON.stringify(fixture.initialDatabase))
  const steps = fixture.steps as unknown as FixtureStep[]
  assert.deepEqual(steps.map((s) => s.id), ['initial-server', 'cache-partial', 'cache-empty', 'server-changes', 'refused', 'reattach', 'twin-removal'])
  const real = (list: string) => db[list].map((d) => d.id).filter((id) => id !== 'INITIAL-PLACEHOLDER').sort()
  for (const step of steps) {
    for (const write of step.writes) {
      db[write.list] = db[write.list].filter((d) => d.id !== write.id)
      if (write.op === 'set') db[write.list].push({ id: write.id, data: write.data as Record<string, unknown> })
    }
    for (const event of step.events) {
      if (event.source === 'server') assert.deepEqual(step.expectedHeld[event.list], real(event.list), `${step.id} ${event.list}`)
    }
    const result = dataParityCheck({
      lists: fixture.lists.map((key) => ({
        key,
        serverCount: db[key].length,
        localIds: step.expectedHeld[key],
        readerDroppedCount: db[key].filter((d) => d.id === 'INITIAL-PLACEHOLDER').length,
      })),
    })
    assert.deepEqual(result.reloadKeys, step.expectedParityMismatches, step.id)
  }
  // The twin id is held on both lists until the small works copy is removed.
  const twin = 'B2000000-0000-4000-8000-0000000000AA'
  assert.ok(steps[0].expectedHeld.projects.includes(twin) && steps[0].expectedHeld.smallWorks.includes(twin))
  assert.ok(steps[6].expectedHeld.projects.includes(twin) && !steps[6].expectedHeld.smallWorks.includes(twin))
})

import { dataCheckPanelEnabled, dataCheckPanelVisible } from './platformConfig'

test('1.38.0 (owner change 11 Nov): the Data check panel is hidden unless platformConfig/app.dataCheckPanel turns it on', () => {
  assert.equal(dataCheckPanelEnabled(null, 'org-1'), false)
  assert.equal(dataCheckPanelEnabled({}, 'org-1'), false)
  assert.equal(dataCheckPanelEnabled({ dataCheckPanel: 'true' }, 'org-1'), false)
  assert.equal(dataCheckPanelEnabled({ dataCheckPanel: true }, 'org-1'), true)
  assert.equal(dataCheckPanelEnabled({ dataCheckPanelOrganizationIds: ['org-1'] }, 'org-1'), true)
  assert.equal(dataCheckPanelEnabled({ dataCheckPanelOrganizationIds: ['org-2'] }, 'org-1'), false)
  assert.equal(dataCheckPanelVisible({ viewerIsAdmin: true, dataCheckPanelEnabled: true }), true)
  assert.equal(dataCheckPanelVisible({ viewerIsAdmin: true, dataCheckPanelEnabled: false }), false)
  assert.equal(dataCheckPanelVisible({ viewerIsAdmin: false, dataCheckPanelEnabled: true }), false)
})
