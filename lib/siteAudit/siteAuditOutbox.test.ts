import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyUploadError, runPhotoUploads, uploadSummary, type PhotoUpload } from './auditPhotoUploads'
import {
  indexedDbOutboxStore,
  memoryOutboxStore,
  outboxRecordsToPrune,
  resilientOutboxStore,
  sendSiteAuditOutbox,
  type SiteAuditOutboxRecord,
  type SiteAuditOutboxStore,
} from './siteAuditOutbox'

const noSleep = async () => {}
const pending = (itemId: string): PhotoUpload => ({ itemId, status: 'pending', progress: 0, attempts: 0 })

function record(count: number, overrides: Partial<SiteAuditOutboxRecord> = {}): SiteAuditOutboxRecord {
  return {
    id: 'audit-1',
    kind: 'project',
    organizationId: 'org-a',
    userId: 'u1',
    createdAtMs: 1,
    updatedAtMs: 1,
    project: { id: 'p1', jobNumber: 'C646', siteName: 'Site' },
    meta: { type: 'General', customTitle: '', date: '2026-11-17', authorName: 'Test Admin', visibleToOperatives: true },
    items: Array.from({ length: count }, (_, index) => ({
      id: `i${index + 1}`,
      title: `Item ${index + 1}`,
      location: '',
      comments: 'x'.repeat(index === 0 ? 5000 : 10),
      assignee: '',
      annotations: '',
      takenAtMs: 1_700_000_000_000,
      photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
      fileName: `p${index + 1}.jpg`,
      upload: pending(`i${index + 1}`),
    })),
    ...overrides,
  }
}

test('classifyUploadError: refusals are final with the real reason; stalls and network errors retry', () => {
  assert.equal(classifyUploadError({ code: 'storage/unauthorized', message: 'x' }).final, true)
  assert.match(classifyUploadError({ code: 'storage/unauthorized' }).message, /refused/)
  assert.equal(classifyUploadError({ code: 'storage/unauthenticated' }).final, true)
  const refused = Object.assign(new Error('This type of file cannot be uploaded.'), { name: 'UploadRefusedError' })
  assert.deepEqual(classifyUploadError(refused), { final: true, message: 'This type of file cannot be uploaded.' })
  assert.equal(classifyUploadError(Object.assign(new Error('stopped'), { code: 'upload/stalled' })).final, false)
  assert.equal(classifyUploadError({ code: 'storage/retry-limit-exceeded' }).final, false)
})

test('a stalled photo is retried and succeeds; others are not held up', async () => {
  const calls: Record<string, number> = {}
  const result = await runPhotoUploads({
    photos: ['a', 'b', 'c'].map(pending),
    sleep: noSleep,
    online: () => true,
    upload: async (id) => {
      calls[id] = (calls[id] ?? 0) + 1
      if (id === 'a' && calls[id] === 1) throw Object.assign(new Error('The photo upload stopped'), { code: 'upload/stalled' })
      return { imageURL: `https://x/${id}`, storagePath: `p/${id}` }
    },
  })
  assert.deepEqual(result.map((photo) => photo.status), ['done', 'done', 'done'])
  assert.equal(calls.a, 2)
  assert.equal(uploadSummary(result).label, 'All photos uploaded')
})

test('a refusal fails at once (no retries) and shows the real reason', async () => {
  let attempts = 0
  const result = await runPhotoUploads({
    photos: [pending('a')],
    sleep: noSleep,
    online: () => true,
    upload: async () => {
      attempts += 1
      throw Object.assign(new Error('User does not have permission'), { code: 'storage/unauthorized' })
    },
  })
  assert.equal(attempts, 1)
  assert.equal(result[0].status, 'failed')
  assert.equal(result[0].final, true)
  assert.match(result[0].error ?? '', /refused/)
  assert.equal(uploadSummary(result).label, '1 photo failed — Retry')
})

test('offline: photos fail at once with "No connection", never a long wait', async () => {
  let attempts = 0
  const result = await runPhotoUploads({
    photos: [pending('a'), pending('b')],
    sleep: noSleep,
    online: () => false,
    upload: async () => {
      attempts += 1
      return { imageURL: 'u', storagePath: 'p' }
    },
  })
  assert.equal(attempts, 0)
  assert.deepEqual(result.map((photo) => photo.status), ['failed', 'failed'])
  assert.match(result[0].error ?? '', /No connection/)
})

test('runs a few uploads at a time and handles 36 photos', async () => {
  let running = 0
  let peak = 0
  const result = await runPhotoUploads({
    photos: Array.from({ length: 36 }, (_, i) => pending(`i${i}`)),
    concurrency: 3,
    sleep: noSleep,
    online: () => true,
    upload: async (id) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running -= 1
      return { imageURL: `https://x/${id}`, storagePath: id }
    },
  })
  assert.equal(peak, 3)
  assert.equal(result.filter((photo) => photo.status === 'done').length, 36)
})

test('outbox: the audit is stored before any upload and kept when a photo fails; nothing is saved', async () => {
  const store = memoryOutboxStore()
  let storedBeforeUpload = false
  let saved = 0
  const result = await sendSiteAuditOutbox(record(3), {
    store,
    sleep: noSleep,
    online: () => true,
    uploadPhoto: async (_record, item) => {
      storedBeforeUpload ||= store.records.has('audit-1')
      if (item.id === 'i2') throw Object.assign(new Error('network'), { code: 'storage/retry-limit-exceeded' })
      return { imageURL: `https://x/${item.id}`, storagePath: `p/${item.id}` }
    },
    save: async () => {
      saved += 1
    },
  })
  assert.equal(storedBeforeUpload, true)
  assert.equal(saved, 0)
  assert.equal(result.saved, false)
  assert.match(result.error ?? '', /1 photo failed — Retry/)
  const kept = store.records.get('audit-1')
  assert.ok(kept, 'the audit is still listed after the failure')
  assert.deepEqual(kept!.items.map((item) => item.upload.status), ['done', 'failed', 'done'])
  assert.equal(kept!.items[0].comments.length, 5000, 'long detail text is kept')
})

test('outbox: Retry sends only the failed photo, then saves and removes the record', async () => {
  const store = memoryOutboxStore()
  const first = record(3)
  first.items[0].upload = { itemId: 'i1', status: 'done', progress: 1, attempts: 1, imageURL: 'https://x/i1', storagePath: 'p/i1' }
  first.items[2].upload = { itemId: 'i3', status: 'done', progress: 1, attempts: 1, imageURL: 'https://x/i3', storagePath: 'p/i3' }
  first.items[1].upload = { itemId: 'i2', status: 'failed', progress: 0, attempts: 3, error: 'network' }
  const sent: string[] = []
  let savedRecord: SiteAuditOutboxRecord | null = null
  const result = await sendSiteAuditOutbox(first, {
    store,
    sleep: noSleep,
    online: () => true,
    uploadPhoto: async (_record, item) => {
      sent.push(item.id)
      return { imageURL: `https://x/${item.id}`, storagePath: `p/${item.id}` }
    },
    save: async (rec) => {
      savedRecord = rec
    },
  })
  assert.deepEqual(sent, ['i2'])
  assert.equal(result.saved, true)
  assert.equal(store.records.has('audit-1'), false)
  assert.deepEqual(savedRecord!.items.map((item) => item.upload.imageURL), ['https://x/i1', 'https://x/i2', 'https://x/i3'])
})

test('outbox: a failed save keeps the record with every photo uploaded, so Retry only saves', async () => {
  const store = memoryOutboxStore()
  const result = await sendSiteAuditOutbox(record(2), {
    store,
    sleep: noSleep,
    online: () => true,
    uploadPhoto: async (_record, item) => ({ imageURL: `https://x/${item.id}`, storagePath: `p/${item.id}` }),
    save: async () => {
      throw new Error('Missing or insufficient permissions.')
    },
  })
  assert.equal(result.saved, false)
  assert.match(result.error ?? '', /not saved: Missing or insufficient permissions/)
  assert.deepEqual(store.records.get('audit-1')!.items.map((item) => item.upload.status), ['done', 'done'])
})

test('outbox list is per organisation and user', async () => {
  const store = memoryOutboxStore()
  await store.put(record(1))
  await store.put(record(1, { id: 'audit-2', userId: 'u2' }))
  await store.put(record(1, { id: 'audit-3', organizationId: 'org-b' }))
  assert.deepEqual((await store.list('org-a', 'u1')).map((r) => r.id), ['audit-1'])
})


// Review of #389 ---------------------------------------------------------------------------------------------------

/** A fake IndexedDB whose transactions end with `ending` (complete, error or abort), to test the browser store. */
function fakeIndexedDb(ending: 'complete' | 'abort' | 'requestError') {
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const transaction: Record<string, unknown> = { error: null }
      const request: Record<string, unknown> = { result: undefined, error: null }
      const store = { put: () => request, get: () => request, getAll: () => request, delete: () => request }
      transaction.objectStore = () => store
      setTimeout(() => {
        if (ending === 'complete') (transaction.oncomplete as () => void)?.()
        else if (ending === 'abort') {
          transaction.error = new DOMException('Quota exceeded', 'QuotaExceededError')
          ;(transaction.onabort as () => void)?.()
        } else {
          request.error = new Error('request failed')
          ;(request.onerror as () => void)?.()
        }
      }, 0)
      return transaction
    },
  }
  return {
    open() {
      const request: Record<string, unknown> = { result: db }
      setTimeout(() => (request.onsuccess as () => void)?.(), 0)
      return request
    },
  }
}

test('browser store: a quota-full abort or a failed request rejects (so the memory fallback takes over)', async () => {
  const original = (globalThis as { indexedDB?: unknown }).indexedDB
  try {
    for (const ending of ['abort', 'requestError'] as const) {
      ;(globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDb(ending)
      await assert.rejects(indexedDbOutboxStore().put(record(1)), ending)
    }
    ;(globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDb('complete')
    await indexedDbOutboxStore().put(record(1))
  } finally {
    ;(globalThis as { indexedDB?: unknown }).indexedDB = original
  }
})

function failingStore(): SiteAuditOutboxStore & { fail: boolean } {
  const inner = memoryOutboxStore()
  const wrap = <A extends unknown[], R>(run: (...args: A) => Promise<R>) => async (...args: A) => {
    if (state.fail) throw new DOMException('Quota exceeded', 'QuotaExceededError')
    return run(...args)
  }
  const state = {
    fail: true,
    put: wrap(inner.put),
    get: wrap(inner.get),
    list: wrap(inner.list),
    listAll: wrap(inner.listAll),
    remove: wrap(inner.remove),
  }
  return state
}

test('fallback is per record: a refused write stays in this tab; removes reach both copies; later writes go back to the browser', async () => {
  const primary = failingStore()
  const memoryOnly = new Set<string>()
  const store = resilientOutboxStore(primary, memoryOutboxStore(), memoryOnly)
  await store.put(record(1, { id: 'a' }))
  assert.deepEqual([...memoryOnly], ['a'])
  assert.equal((await store.list('org-a', 'u1')).length, 1)
  primary.fail = false
  await store.put(record(1, { id: 'b' }))
  assert.deepEqual([...memoryOnly], ['a'])
  await store.put(record(1, { id: 'a', updatedAtMs: 5 }))
  assert.deepEqual([...memoryOnly], [])
  await store.remove('a')
  assert.equal(await store.get('a'), null, 'removed from both copies: never comes back')
  assert.deepEqual((await store.list('org-a', 'u1')).map((row) => row.id), ['b'])
})

test('a record whose audit is already saved is removed, never written again (no stale overwrite)', async () => {
  const store = memoryOutboxStore()
  let saves = 0
  const result = await sendSiteAuditOutbox(record(2), {
    store,
    sleep: noSleep,
    online: () => true,
    uploadPhoto: async () => ({ imageURL: 'u', storagePath: 'p' }),
    save: async () => {
      saves += 1
    },
    savedAlready: async () => true,
  })
  assert.equal(result.saved, true)
  assert.equal(saves, 0)
  assert.equal(store.records.size, 0)
})

test('when it cannot tell whether the audit is saved (offline), it does not save: the record waits for Retry', async () => {
  const store = memoryOutboxStore()
  let checks = 0
  const result = await sendSiteAuditOutbox(record(1), {
    store,
    sleep: noSleep,
    online: () => true,
    uploadPhoto: async () => ({ imageURL: 'u', storagePath: 'p' }),
    save: async () => assert.fail('must not save'),
    savedAlready: async () => {
      checks += 1
      if (checks === 1) return false
      throw new Error('offline')
    },
  })
  assert.equal(result.saved, false)
  assert.equal(store.records.size, 1)
  assert.equal(store.records.get('audit-1')?.items[0].upload.status, 'done', 'the uploaded photo is kept done for Retry')
})

test('pruning: older than 30 days, and this person\'s records in companies they left (complete list only)', () => {
  const day = 24 * 60 * 60 * 1000
  const now = 100 * day
  const rows = [
    { id: 'old', organizationId: 'org-a', userId: 'u1', createdAtMs: now - 40 * day, updatedAtMs: now - 31 * day },
    { id: 'fresh', organizationId: 'org-a', userId: 'u1', createdAtMs: now - day, updatedAtMs: now - day },
    { id: 'left', organizationId: 'org-x', userId: 'u1', createdAtMs: now - day, updatedAtMs: now - day },
    { id: 'other-user', organizationId: 'org-x', userId: 'u2', createdAtMs: now - day, updatedAtMs: now - day },
  ]
  assert.deepEqual(outboxRecordsToPrune(rows, { nowMs: now }), ['old'])
  assert.deepEqual(outboxRecordsToPrune(rows, { nowMs: now, userId: 'u1', memberOrganizationIds: ['org-a'] }), ['old', 'left'])
})

test('after a stall the rest go one at a time', async () => {
  let stalledYet = false
  let late = 0
  let lateMost = 0
  const order: string[] = []
  await runPhotoUploads({
    photos: ['a', 'b', 'c', 'd', 'e', 'f'].map(pending),
    sleep: noSleep,
    online: () => true,
    upload: async (id, { attempt }) => {
      if (id === 'a' && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 2))
        stalledYet = true
        throw Object.assign(new Error('stopped'), { code: 'upload/stalled' })
      }
      const startedLate = stalledYet && ['d', 'e', 'f'].includes(id)
      if (startedLate) {
        late += 1
        lateMost = Math.max(lateMost, late)
      }
      order.push(id)
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (startedLate) late -= 1
      return { imageURL: `https://x/${id}`, storagePath: id }
    },
  })
  assert.equal(order.length, 6)
  assert.equal(lateMost, 1, 'photos after the stall upload one at a time')
})
