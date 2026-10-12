import assert from 'node:assert/strict'
import test from 'node:test'
import { settingsDraftIsDirty } from './settingsDirty.ts'

test('settings draft dirty compare treats matching snapshots as clean', () => {
  assert.equal(settingsDraftIsDirty({ name: 'Acme' }, { name: 'Acme' }), false)
  assert.equal(settingsDraftIsDirty({ name: 'Acme' }, { name: 'Other' }), true)
})
