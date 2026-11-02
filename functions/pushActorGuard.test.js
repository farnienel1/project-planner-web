'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { skipPushForActor } = require('./pushActorGuard')
const canonicalModule = require('./loadCanonical')

test('push_test pushes to its actor; timesheet_pending_manager_signoff still never does', () => {
  const canonical = canonicalModule
  assert.equal(skipPushForActor(canonical, 'push_test', 'U1', 'U1', null), false)
  assert.equal(skipPushForActor(canonical, 'timesheet_pending_manager_signoff', 'U1', 'U1', null), true)
  assert.equal(skipPushForActor(canonical, 'timesheet_pending_manager_signoff', 'old', 'U1', { formerUserIds: ['OLD'] }), true)
  assert.equal(skipPushForActor(canonical, 'timesheet_pending_manager_signoff', 'U2', 'U1', null), false)
  assert.equal(skipPushForActor(canonical, 'client_created', '', 'U1', null), false)
})
