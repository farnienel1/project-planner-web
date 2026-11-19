import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ProfileSaveStageError, sequenceProfileSave } from './profileSaveSequence.ts'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('the profile batch is queued only after the type batch is confirmed', async () => {
  const type = deferred()
  const profile = deferred()
  const seq = sequenceProfileSave({ type: () => type.promise, profile: () => profile.promise })
  await tick()
  assert.deepEqual(seq.queued(), ['type'])
  type.resolve()
  await tick()
  assert.deepEqual(seq.queued(), ['type', 'profile'])
  profile.resolve()
  await seq.all
})

test('a refused type batch never queues the profile batch (no half-applied type) and is not partial', async () => {
  let profileQueued = false
  const seq = sequenceProfileSave({
    type: () => Promise.reject(new Error('Missing or insufficient permissions.')),
    profile: async () => {
      profileQueued = true
    },
    tax: async () => undefined,
  })
  await assert.rejects(seq.all, (error: unknown) => {
    assert.ok(error instanceof ProfileSaveStageError)
    assert.equal(error.stage, 'type')
    assert.equal(error.partial, false)
    assert.equal(error.message, 'Missing or insufficient permissions.')
    return true
  })
  await assert.rejects(seq.profile)
  assert.equal(profileQueued, false)
  assert.deepEqual(seq.queued(), ['type'])
})

test('a type batch that never answers never queues the profile batch', async () => {
  const type = deferred()
  const seq = sequenceProfileSave({ type: () => type.promise, profile: async () => undefined })
  await tick()
  await tick()
  assert.deepEqual(seq.queued(), ['type'])
})

test('a refused profile after a confirmed type is partial', async () => {
  const seq = sequenceProfileSave({
    type: async () => undefined,
    profile: () => Promise.reject(new Error('refused')),
  })
  await assert.rejects(seq.all, (error: unknown) => {
    assert.ok(error instanceof ProfileSaveStageError)
    assert.equal(error.stage, 'profile')
    assert.equal(error.partial, true)
    assert.match(error.message, /Some changes may have saved/)
    return true
  })
})

test('without a type change the profile is queued at once and is not partial when refused', async () => {
  const seq = sequenceProfileSave({ profile: () => Promise.reject(new Error('nope')) })
  await assert.rejects(seq.all, (error: unknown) => error instanceof ProfileSaveStageError && !error.partial)
})

test('tax ids are written only after the profile is confirmed; their refusal is partial and leaves the profile confirmed', async () => {
  const profile = deferred()
  let taxQueued = false
  const seq = sequenceProfileSave({
    profile: () => profile.promise,
    tax: async () => {
      taxQueued = true
      throw new Error('tax refused')
    },
  })
  await tick()
  assert.equal(taxQueued, false)
  profile.resolve()
  await seq.profile
  await assert.rejects(seq.all, (error: unknown) => error instanceof ProfileSaveStageError && error.stage === 'tax' && error.partial)
  assert.equal(taxQueued, true)
})

test('a step that throws synchronously is a refusal of that stage', async () => {
  const seq = sequenceProfileSave({
    profile: () => {
      throw new Error('bad')
    },
  })
  await assert.rejects(seq.all, (error: unknown) => error instanceof ProfileSaveStageError && error.stage === 'profile')
})
