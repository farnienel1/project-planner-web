import assert from 'node:assert/strict'
import test from 'node:test'
import { orgBadgeText } from './orgHubUtils'

test('the organisation badge uses the stored document abbreviation first, initials only when none', () => {
  assert.equal(orgBadgeText('rmp', 'Raccord Mechanical'), 'RMP')
  assert.equal(orgBadgeText('', 'Raccord Mechanical'), 'RM')
  assert.equal(orgBadgeText(undefined, 'Acme'), 'AC')
  assert.equal(orgBadgeText('  ', ''), 'OR')
})
