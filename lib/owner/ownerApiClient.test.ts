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

test('final check of #348: after an owner change each directory path refreshes once, independently', async () => {
  const api = await import('./client/ownerApi.ts')
  api.resetOwnerDirectoryStaleForTests()
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/search'), false)
  api.markOwnerDirectoryStale()
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/directory/orgs'), true)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/directory/people'), true)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/search'), true)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/counts'), false)
  api.ownerPathRefreshed('/api/owner/search', 1)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/search'), false)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/directory/people'), true, 'search did not clear people')
  api.ownerPathRefreshed('/api/owner/directory/people', 1)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/directory/orgs'), true)
  api.markOwnerDirectoryStale()
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/search'), true, 'a second change refreshes again')
  api.ownerPathRefreshed('/api/owner/search', 1)
  assert.equal(api.ownerPathNeedsRefresh('/api/owner/search'), true, 'an older answer does not clear a newer change')
  api.resetOwnerDirectoryStaleForTests()
})
