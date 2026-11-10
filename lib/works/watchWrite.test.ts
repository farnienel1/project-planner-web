import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WRITE_CONFIRM_TIMEOUT_MS, watchWrite, type WriteStatus } from './watchWrite.ts'

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
