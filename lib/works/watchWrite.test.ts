import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WRITE_CONFIRM_TIMEOUT_MS,
  WRITE_UNCONFIRMED_AFTER_MS,
  confirmWriteWithin,
  watchWrite,
  whenQueued,
  type LaterWriteStatus,
  type WriteStatus,
} from './watchWrite.ts'

// The My Projects / My Small works ⚙ save never blocks the screen (iOS PR #210): the confirmation is bounded and
// reported as saved / pending / refused.

test('a write confirmed in time is saved, with no pending step', async () => {
  const seen: WriteStatus[] = []
  const final = await watchWrite(Promise.resolve(), (s) => seen.push(s), 50)
  assert.deepEqual(final, { status: 'saved' })
  assert.deepEqual(seen, [{ status: 'saved' }])
})

test('a refused write is refused with its message', async () => {
  const seen: WriteStatus[] = []
  const final = await watchWrite(Promise.reject(new Error('Missing or insufficient permissions.')), (s) => seen.push(s), 50)
  assert.deepEqual(final, { status: 'refused', message: 'Missing or insufficient permissions.' })
  assert.deepEqual(seen, [final])
})

test('a slow write is pending after the limit, then saved when the server confirms', async () => {
  const seen: WriteStatus[] = []
  let confirm!: () => void
  const write = new Promise<void>((resolve) => (confirm = resolve))
  const done = watchWrite(write, (s) => seen.push(s), 20)
  await new Promise((r) => setTimeout(r, 40))
  assert.deepEqual(seen, [{ status: 'pending' }])
  confirm()
  assert.deepEqual(await done, { status: 'saved' })
  assert.deepEqual(seen, [{ status: 'pending' }, { status: 'saved' }])
})

test('a slow write refused after the limit ends refused', async () => {
  const seen: WriteStatus[] = []
  let refuse!: (e: Error) => void
  const write = new Promise<void>((_, reject) => (refuse = reject))
  const done = watchWrite(write, (s) => seen.push(s), 20)
  await new Promise((r) => setTimeout(r, 40))
  refuse(new Error('denied'))
  assert.deepEqual(await done, { status: 'refused', message: 'denied' })
  assert.deepEqual(seen, [{ status: 'pending' }, { status: 'refused', message: 'denied' }])
})

test('a write that never settles stays pending and never throws', async () => {
  const seen: WriteStatus[] = []
  void watchWrite(new Promise(() => {}), (s) => seen.push(s), 10)
  await new Promise((r) => setTimeout(r, 30))
  assert.deepEqual(seen, [{ status: 'pending' }])
})

test('the limit is 15 seconds, as on iOS', () => {
  assert.equal(WRITE_CONFIRM_TIMEOUT_MS, 15_000)
})

// Edit user Save (owner bug 17 Nov): a bounded wait — saved, refused (thrown) or pending with the outcome later.

test('confirmWriteWithin: confirmed in time is saved and nothing is reported later', async () => {
  const later: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(Promise.resolve(), (s) => later.push(s), 50), 'saved')
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(later, [])
})

test('confirmWriteWithin: refused in time throws the refusal (the screen shows it, Save comes back)', async () => {
  await assert.rejects(
    confirmWriteWithin(Promise.reject(new Error('Missing or insufficient permissions.')), () => assert.fail('no later'), 50),
    /Missing or insufficient permissions/
  )
})

test('confirmWriteWithin: a write that never answers returns pending in time — never hangs the screen', async () => {
  const later: LaterWriteStatus[] = []
  const started = Date.now()
  assert.equal(await confirmWriteWithin(new Promise(() => {}), (s) => later.push(s), 20), 'pending')
  assert.ok(Date.now() - started < 1000)
  assert.deepEqual(later, [])
})

test('confirmWriteWithin: a slow write is pending, then reported saved or refused once', async () => {
  let resolveWrite!: () => void
  const slow = new Promise<void>((r) => (resolveWrite = r))
  const later: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(slow, (s) => later.push(s), 10), 'pending')
  resolveWrite()
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(later, [{ status: 'saved' }])

  let rejectWrite!: (e: Error) => void
  const refused = new Promise<void>((_, r) => (rejectWrite = r))
  const later2: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(refused, (s) => later2.push(s), 10), 'pending')
  rejectWrite(new Error('nope'))
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(later2, [{ status: 'refused', message: 'nope' }])
})

// Review of #371: Firestore retries some failures for ever, so "waiting" has an upper limit.

test('confirmWriteWithin: a write still not answered at the upper limit is reported unconfirmed, once', async () => {
  const later: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(new Promise(() => {}), (s) => later.push(s), 10, 30), 'pending')
  await new Promise((r) => setTimeout(r, 60))
  assert.deepEqual(later, [{ status: 'unconfirmed' }])
})

test('confirmWriteWithin: an answer after the upper limit is still reported', async () => {
  let resolveWrite!: () => void
  const slow = new Promise<void>((r) => (resolveWrite = r))
  const later: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(slow, (s) => later.push(s), 10, 20), 'pending')
  await new Promise((r) => setTimeout(r, 40))
  resolveWrite()
  await new Promise((r) => setTimeout(r, 5))
  assert.deepEqual(later, [{ status: 'unconfirmed' }, { status: 'saved' }])
})

test('confirmWriteWithin: a write confirmed before the upper limit is never reported unconfirmed', async () => {
  let resolveWrite!: () => void
  const slow = new Promise<void>((r) => (resolveWrite = r))
  const later: LaterWriteStatus[] = []
  assert.equal(await confirmWriteWithin(slow, (s) => later.push(s), 10, 40), 'pending')
  resolveWrite()
  await new Promise((r) => setTimeout(r, 60))
  assert.deepEqual(later, [{ status: 'saved' }])
})

test('the upper limit is 90 seconds', () => {
  assert.equal(WRITE_UNCONFIRMED_AFTER_MS, 90_000)
})

// Review of #371: a write that reads first is only waited on once it is queued.
test('whenQueued resolves only when the write is handed over, and gives back the write to wait on', async () => {
  let release: () => void = () => undefined
  const reads = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = false
  const starting = whenQueued(async (queued) => {
    await reads
    queued()
    await new Promise((resolve) => setTimeout(resolve, 20))
    return 'done'
  }).then((value) => {
    started = true
    return value
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(started, false, 'still reading: nothing to wait on yet')
  release()
  const { write } = await starting
  assert.equal(await write, 'done')
})

test('whenQueued throws a failure that comes before anything is queued', async () => {
  await assert.rejects(
    whenQueued(async () => {
      throw new Error('The super admin cannot be deactivated.')
    }),
    /super admin cannot be deactivated/
  )
})

test('whenQueued also resolves for a write that finishes without queuing (nothing to write)', async () => {
  const { write } = await whenQueued(async () => 7)
  assert.equal(await write, 7)
})
