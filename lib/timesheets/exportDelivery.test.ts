import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportDeliveryNotice, exportDeliveryPending, useExportDeliveryStore } from './exportDelivery.ts'
import { mapWithConcurrency } from './timesheetExportRun.ts'

test('a delivery is pending until its own run finishes; a second run never overwrites it', () => {
  const store = useExportDeliveryStore.getState()
  store.start('org1', 'run1', '2 exported. Sending the PDFs…')
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org1'), true)
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org2'), false)
  // A finish from another run is ignored.
  useExportDeliveryStore.getState().finish('org1', 'run0', 'done', 'old run')
  assert.equal(useExportDeliveryStore.getState().entries.org1.message, '2 exported. Sending the PDFs…')
  // Dismiss is refused while sending.
  useExportDeliveryStore.getState().dismiss('org1')
  assert.ok(useExportDeliveryStore.getState().entries.org1)
  useExportDeliveryStore.getState().finish('org1', 'run1', 'failed', "2 exported. Couldn't send: the email.")
  assert.equal(exportDeliveryPending(useExportDeliveryStore.getState(), 'org1'), false)
  assert.equal(useExportDeliveryStore.getState().entries.org1.status, 'failed')
  useExportDeliveryStore.getState().dismiss('org1')
  assert.equal(useExportDeliveryStore.getState().entries.org1, undefined)
})

test('a delivery left "sending" by a closed or reloaded page says it may not have been sent and points to Download PDF', () => {
  const entry = { runKey: 'r', status: 'sending' as const, message: '2 exported. Sending the PDFs…', atMs: 0 }
  assert.equal(exportDeliveryNotice(entry, true), entry.message)
  assert.match(exportDeliveryNotice(entry, false) ?? '', /may not have been sent.*Download PDF/)
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
