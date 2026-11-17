import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mineChangedKey, mineChangedShown, useMineChangedStore } from './mineChangedStore.ts'

test('sidebar triangle follows the hub result for the same organisation and person only', () => {
  const key = mineChangedKey('org1', 'u1')
  assert.equal(mineChangedShown(useMineChangedStore.getState(), key), false)
  useMineChangedStore.getState().publish(key, true)
  assert.equal(mineChangedShown(useMineChangedStore.getState(), key), true)
  // Another company or person never shows it.
  assert.equal(mineChangedShown(useMineChangedStore.getState(), mineChangedKey('org2', 'u1')), false)
  assert.equal(mineChangedShown(useMineChangedStore.getState(), mineChangedKey('org1', 'u2')), false)
  assert.equal(mineChangedShown(useMineChangedStore.getState(), null), false)
  // The hub's next answer replaces it.
  useMineChangedStore.getState().publish(key, false)
  assert.equal(mineChangedShown(useMineChangedStore.getState(), key), false)
  assert.equal(mineChangedKey('', 'u1'), null)
})
