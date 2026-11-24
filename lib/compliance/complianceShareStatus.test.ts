import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMPLIANCE_SHARE_CREATOR_STOPPED_TEXT, complianceShareLinkStatusText } from './complianceShareStatus.ts'

test('a link whose creator stopped being an admin reads Stopped', () => {
  assert.equal(complianceShareLinkStatusText({ state: 'active', creatorStopped: true }), COMPLIANCE_SHARE_CREATOR_STOPPED_TEXT)
  assert.equal(COMPLIANCE_SHARE_CREATOR_STOPPED_TEXT, 'Stopped — creator is no longer an admin')
  assert.equal(complianceShareLinkStatusText({ state: 'active', creatorStopped: false }), null)
  assert.equal(complianceShareLinkStatusText({ state: 'active' }), null)
  assert.equal(complianceShareLinkStatusText({ state: 'revoked', creatorStopped: true }), null)
})
