import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPORT_DELIVERY_STALE_MS,
  EXPORT_DELIVERY_TAB_ID,
  exportDeliveryLiveElsewhere,
  exportDeliveryNotice,
  exportDeliveryPending,
  useExportDeliveryStore,
} from './exportDelivery.ts'
import { mapWithConcurrency } from './timesheetExportRun.ts'

test('a delivery is pending until its own run finishes; a second run never overwrites it', () => {
  const store = useExportDeliveryStore.getState()
  store.start('org1', 'run1', '2 exported. Sending the PDFs…')
  // A second start for the same organisation replaces it without stacking guards (nit 6).
  useExportDeliveryStore.getState().start('org1', 'run1', '2 exported. Sending the PDFs…')
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org1'), true)
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org2'), false)
  useExportDeliveryStore.getState().finish('org1', 'run0', 'done', 'old run')
  assert.equal(useExportDeliveryStore.getState().entries.org1.message, '2 exported. Sending the PDFs…')
  useExportDeliveryStore.getState().dismiss('org1')
  assert.ok(useExportDeliveryStore.getState().entries.org1)
  useExportDeliveryStore.getState().finish('org1', 'run1', 'failed', "2 exported. Couldn't send: the email.")
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org1'), false)
  assert.equal(useExportDeliveryStore.getState().entries.org1.status, 'failed')
  useExportDeliveryStore.getState().dismiss('org1')
  assert.equal(useExportDeliveryStore.getState().entries.org1, undefined)
})

test('another tab: live while its heartbeat is recent (Export blocked), stale after; a closed tab reads "may not have been sent"', () => {
  const now = 1_000_000
  const entry = { runKey: 'r', status: 'sending' as const, message: '2 exported. Sending the PDFs…', atMs: now - 1000, ownerTab: 'other-tab', heartbeatMs: now - 1000 }
  assert.equal(exportDeliveryLiveElsewhere(entry, EXPORT_DELIVERY_TAB_ID, now), true)
  assert.equal(exportDeliveryPending({ live: {}, entries: { org: entry }, nowMs: now }, 'org'), true)
  assert.match(exportDeliveryNotice(entry, false, true) ?? '', /another tab/)
  // A hidden sending tab's timers may run once a minute: still live 90 s after its last beat.
  assert.equal(exportDeliveryLiveElsewhere(entry, EXPORT_DELIVERY_TAB_ID, now + 90_000), true)
  assert.ok(EXPORT_DELIVERY_STALE_MS >= 120_000)
  const later = now + EXPORT_DELIVERY_STALE_MS + 1
  assert.equal(exportDeliveryLiveElsewhere(entry, EXPORT_DELIVERY_TAB_ID, later), false)
  assert.equal(exportDeliveryPending({ live: {}, entries: { org: entry }, nowMs: later }, 'org'), false)
  assert.match(exportDeliveryNotice(entry, false, false) ?? '', /may not have been sent.*Download PDF/)
  // Its own tab's entry is never "elsewhere"; a finished entry never blocks.
  assert.equal(exportDeliveryLiveElsewhere({ ...entry, ownerTab: EXPORT_DELIVERY_TAB_ID }, EXPORT_DELIVERY_TAB_ID, now), false)
  assert.equal(exportDeliveryLiveElsewhere({ ...entry, status: 'done' }, EXPORT_DELIVERY_TAB_ID, now), false)
  assert.equal(exportDeliveryNotice(null, false), null)
})

test('mapWithConcurrency caps the work running at once and keeps the input order', async () => {
  let running = 0
  let most = 0
  const out = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (ms, index) => {
    running += 1
    most = Math.max(most, running)
    await new Promise((resolve) => setTimeout(resolve, ms))
    running -= 1
    return index
  })
  assert.equal(most, 2)
  assert.deepEqual(out, [0, 1, 2, 3, 4])
  assert.deepEqual(await mapWithConcurrency([], 3, async () => 1), [])
})

test('two tabs starting at once: a tab that finds another live sender backs off the shared entry', () => {
  const store = new Map<string, string>()
  const fakeWindow = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  const g = globalThis as unknown as { window?: unknown }
  g.window = fakeWindow
  try {
    const other = { runKey: 'theirs', status: 'sending', message: 'Sending…', atMs: Date.now(), ownerTab: 'other-tab', heartbeatMs: Date.now() }
    store.set('pp.timesheetExportDelivery:org9', JSON.stringify(other))
    const shared = useExportDeliveryStore.getState().start('org9', 'mine', 'Sending mine…')
    assert.equal(shared, false)
    assert.equal(JSON.parse(store.get('pp.timesheetExportDelivery:org9')!).runKey, 'theirs', 'the other tab keeps its entry')
    assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org9'), true)
    useExportDeliveryStore.getState().finish('org9', 'mine', 'done', 'done mine')
    assert.equal(JSON.parse(store.get('pp.timesheetExportDelivery:org9')!).runKey, 'theirs', 'never overwritten by the backed-off run')
    // With no live sender elsewhere the tab owns it (and clears its heartbeat on finish).
    store.delete('pp.timesheetExportDelivery:org9')
    assert.equal(useExportDeliveryStore.getState().start('org9', 'mine2', 'Sending…'), true)
    useExportDeliveryStore.getState().finish('org9', 'mine2', 'done', 'Sent.')
    assert.equal(JSON.parse(store.get('pp.timesheetExportDelivery:org9')!).status, 'done')
  } finally {
    delete g.window
  }
})
