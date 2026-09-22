import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MATERIAL_CATEGORY_SUGGESTIONS } from './materialCategorySuggestions.ts'

test('material category suggestions keep the requested section order', () => {
  assert.deepEqual(
    MATERIAL_CATEGORY_SUGGESTIONS.map((group) => group.section),
    [
      'Electrical',
      'Mechanical',
      'Plumbing',
      'Building Materials',
      'Finishes',
      'Fire & Security',
      'Technology & Controls',
      'Site',
      'Specialist',
      'Other',
    ]
  )
  assert.equal(MATERIAL_CATEGORY_SUGGESTIONS[0].items[0], 'Cable')
  assert.equal(MATERIAL_CATEGORY_SUGGESTIONS.at(-1)?.items[0], 'Other')
})
