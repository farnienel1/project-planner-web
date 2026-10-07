import assert from 'node:assert/strict'
import test from 'node:test'
import { optionsForUnappliedOrg, OrgLoadNotCached, runOrgLoad, shouldSkipOrgLoad } from './orgLoadCache.ts'

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

test('a second caller joins the in-flight load before the organisation id is recorded', async () => {
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const key = `join-${Date.now()}-a`
  const first = runOrgLoad(key, 'org-1', async () => {
    calls += 1
    await gate
  })
  const second = runOrgLoad(key, 'org-1', async () => {
    calls += 1
    await gate
  })
  for (let i = 0; i < 5 && calls === 0; i += 1) await flush()
  assert.equal(calls, 1)
  release()
  await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.equal(shouldSkipOrgLoad(key, 'org-1', { ttlMs: 60_000 }), true)
})

test('a load that applies nothing is not cached as an empty company', async () => {
  const key = `uncached-${Date.now()}`
  await runOrgLoad(key, 'org-1', async () => {
    throw new OrgLoadNotCached()
  })
  assert.equal(shouldSkipOrgLoad(key, 'org-1'), false)
  let calls = 0
  await runOrgLoad(key, 'org-1', async () => {
    calls += 1
  })
  assert.equal(calls, 1)
  assert.equal(shouldSkipOrgLoad(key, 'org-1'), true)
})

test('a warm load cache still refetches when the store has not applied that organisation', async () => {
  const key = `unapplied-${Date.now()}`
  await runOrgLoad(key, 'org-1', async () => {})
  assert.equal(shouldSkipOrgLoad(key, 'org-1'), true)
  const forced = optionsForUnappliedOrg(key, 'org-1', false, undefined)
  assert.equal(forced?.force, true)
  const kept = optionsForUnappliedOrg(key, 'org-1', true, undefined)
  assert.equal(kept, undefined)
})

test('a finished load is reused until the ttl expires', async () => {
  const key = `ttl-${Date.now()}`
  let calls = 0
  await runOrgLoad(key, 'org-1', async () => {
    calls += 1
  })
  await runOrgLoad(key, 'org-1', async () => {
    calls += 1
  })
  assert.equal(calls, 1)
  await runOrgLoad(key, 'org-1', async () => {
    calls += 1
  }, { force: true })
  assert.equal(calls, 2)
})
