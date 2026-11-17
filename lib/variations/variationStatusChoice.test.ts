import assert from 'node:assert/strict'
import test from 'node:test'
import { variationStatusWriteFields } from '../canonical/variations'
import { VARIATION_STATUS_OPTIONS, variationStatusChoice, variationStatusKeyTarget } from './variationStatusChoice'
import type { VariationStatus } from './variationModel'

const STATUSES: VariationStatus[] = ['open', 'submitted', 'closed']

// What the old <select onChange> handed to setVariationStatus: the chosen option's value, only when it changed.
function dropdownChoice(current: VariationStatus, chosen: VariationStatus): VariationStatus | null {
  return chosen === current ? null : chosen
}

test('status buttons hand the handler exactly what the dropdown did, so the stored write is identical', () => {
  assert.deepEqual(VARIATION_STATUS_OPTIONS.map((o) => o.value), STATUSES)
  for (const current of STATUSES) {
    for (const pressed of STATUSES) {
      const fromButton = variationStatusChoice(current, pressed)
      const fromDropdown = dropdownChoice(current, pressed)
      assert.equal(fromButton, fromDropdown)
      if (fromButton && fromDropdown) {
        const stored = { status: current, voNumberLocked: current !== 'open' }
        assert.deepEqual(variationStatusWriteFields(stored, fromButton), variationStatusWriteFields(stored, fromDropdown))
      }
    }
  }
})

test('1.63.0: reopening clears the number lock in the same write; submit and close lock it', () => {
  assert.deepEqual(variationStatusWriteFields({ status: 'submitted', voNumberLocked: true }, 'open'), { status: 'open', voNumberLocked: false })
  assert.deepEqual(variationStatusWriteFields({ status: 'open' }, 'submitted'), { status: 'submitted', voNumberLocked: true })
  assert.deepEqual(variationStatusWriteFields({ status: 'submitted', voNumberLocked: true }, 'closed'), { status: 'closed', voNumberLocked: true })
})

test('arrow keys, Home and End move along Open / Submitted / Closed', () => {
  assert.equal(variationStatusKeyTarget('open', 'ArrowRight'), 'submitted')
  assert.equal(variationStatusKeyTarget('closed', 'ArrowRight'), 'open')
  assert.equal(variationStatusKeyTarget('open', 'ArrowLeft'), 'closed')
  assert.equal(variationStatusKeyTarget('submitted', 'Home'), 'open')
  assert.equal(variationStatusKeyTarget('open', 'End'), 'closed')
  assert.equal(variationStatusKeyTarget('open', 'a'), null)
})
