import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyFirebaseIdToken } from './apiGuard.ts'

const realFetch = globalThis.fetch
const realKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  globalThis.fetch = realFetch
  restoreEnv('NEXT_PUBLIC_FIREBASE_API_KEY', realKey)
})

function stubLookup(user: Record<string, unknown>) {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ users: [user] }), { status: 200 })) as typeof fetch
}

test('verifyFirebaseIdToken returns the Auth account creation time from accounts:lookup', async () => {
  stubLookup({ localId: 'u1', email: 'A@Example.com', emailVerified: true, createdAt: '1760432400000' })
  const user = await verifyFirebaseIdToken('token')
  assert.deepEqual(user, { uid: 'u1', email: 'a@example.com', emailVerified: true, createdAtMs: 1760432400000 })
})

test('verifyFirebaseIdToken reads a missing or malformed creation time as null', async () => {
  stubLookup({ localId: 'u1' })
  assert.equal((await verifyFirebaseIdToken('token'))?.createdAtMs, null)
  stubLookup({ localId: 'u1', createdAt: 'yesterday' })
  assert.equal((await verifyFirebaseIdToken('token'))?.createdAtMs, null)
  stubLookup({ localId: 'u1', createdAt: '-5' })
  assert.equal((await verifyFirebaseIdToken('token'))?.createdAtMs, null)
})
