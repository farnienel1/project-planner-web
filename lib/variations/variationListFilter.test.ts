import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VARIATION_LIST_FILTERS,
  VARIATION_STATUS_COPY,
  variationMatchesListFilter,
} from './variationModel.ts'

test('variation lists use the iOS Open, Submitted, and Closed filters', () => {
  assert.deepEqual(
    VARIATION_LIST_FILTERS.map((item) => item.label),
    ['All', 'Open', 'Submitted', 'Closed']
  )
  assert.equal(variationMatchesListFilter('open', 'open'), true)
  assert.equal(variationMatchesListFilter('submitted', 'open'), false)
  assert.equal(variationMatchesListFilter('closed', 'all'), true)
  assert.match(VARIATION_STATUS_COPY.open, /not been submitted/)
  assert.match(VARIATION_STATUS_COPY.submitted, /submitted by the QS/)
  assert.match(VARIATION_STATUS_COPY.closed, /no longer required/)
})
