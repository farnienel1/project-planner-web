import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatLengthSpecification } from './materialLength.ts'

test('catalogue length uses the iOS metre and millimetre suffixes', () => {
  assert.equal(formatLengthSpecification('3', 'M'), '3 m')
  assert.equal(formatLengthSpecification('150', 'MM'), '150 mm')
  assert.equal(formatLengthSpecification('3m', 'M'), '3m m')
  assert.equal(formatLengthSpecification('  100  ', 'metre'), '100 m')
  assert.equal(formatLengthSpecification('2', ''), '2')
  assert.equal(formatLengthSpecification('  ', 'M'), '')
  assert.equal(formatLengthSpecification(null, 'M'), '')
})
