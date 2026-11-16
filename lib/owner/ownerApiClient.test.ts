import { test } from 'node:test'
import assert from 'node:assert/strict'

test('re-review of #348: after an owner change, only the directory routes ask for fresh rows', async () => {
  const { ownerQueryParams, readsOwnerDirectory } = await import('./client/ownerApi.ts')
  assert.equal(readsOwnerDirectory('/api/owner/search'), true)
  assert.equal(readsOwnerDirectory('/api/owner/directory/people'), true)
  assert.equal(readsOwnerDirectory('/api/owner/counts'), false)
  assert.deepEqual(ownerQueryParams('/api/owner/search', { q: 'x' }, true), { q: 'x', refresh: true })
  assert.deepEqual(ownerQueryParams('/api/owner/search', { q: 'x' }, false), { q: 'x' })
  assert.deepEqual(ownerQueryParams('/api/owner/counts', {}, true), {})
})
