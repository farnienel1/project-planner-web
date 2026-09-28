import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEACTIVATED_ACCOUNT_MESSAGE,
  membershipAccountIsActive,
  otherOrganisations,
  SWITCH_ORGANISATION_LABEL,
} from './deactivatedAccount.ts'

test('deactivated gate lists every other organisation and hides the switch when there is only one', () => {
  assert.equal(
    DEACTIVATED_ACCOUNT_MESSAGE,
    'Your account has been deactivated, please contact your organisation'
  )
  assert.equal(SWITCH_ORGANISATION_LABEL, 'Switch organisation')
  const rows = otherOrganisations(
    [
      { organizationId: 'A', organizationName: 'Alpha' },
      { organizationId: 'B', organizationName: 'Beta' },
      { organizationId: 'A', organizationName: 'Alpha duplicate' },
      { organizationId: 'C', organizationName: 'Gamma' },
    ],
    'A'
  )
  assert.deepEqual(
    rows.map((row) => row.organizationId),
    ['B', 'C']
  )
  assert.deepEqual(otherOrganisations([{ organizationId: 'A', organizationName: 'Alpha' }], 'A'), [])
  assert.equal(membershipAccountIsActive(undefined), true)
  assert.equal(membershipAccountIsActive(false), false)
})
