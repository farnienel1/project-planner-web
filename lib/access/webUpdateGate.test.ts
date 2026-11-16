import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setSecuritySwitchConfigForTests, webUpdateRequiredFor } from './securitySwitches.ts'

test('scan 16 Nov: web forced update follows platformConfig/app.minimumWebVersion (rulebook §18)', () => {
  setSecuritySwitchConfigForTests(null)
  assert.equal(webUpdateRequiredFor('1.54.0'), false, 'no document never blocks')
  setSecuritySwitchConfigForTests({ minimumWebVersion: '1.55.0' })
  assert.equal(webUpdateRequiredFor('1.54.0'), true)
  assert.equal(webUpdateRequiredFor('1.55.0'), false)
  assert.equal(webUpdateRequiredFor('1.56.1'), false)
  assert.equal(webUpdateRequiredFor(''), false, 'an unreadable running build never blocks')
  setSecuritySwitchConfigForTests({ minimumWebVersion: 'soon' })
  assert.equal(webUpdateRequiredFor('1.0.0'), false, 'a value that is not a dotted version never blocks')
  setSecuritySwitchConfigForTests({ minimumIosBuild: 999 })
  assert.equal(webUpdateRequiredFor('1.0.0'), false, 'the iOS minimum never blocks web')
  setSecuritySwitchConfigForTests(null)
})

test('review L1: the verified platform owner never sees the reload gate', async () => {
  const { webUpdateGateShown } = await import('../app/webUpdateGate.ts')
  assert.equal(webUpdateGateShown(true, { email: 'someone@x.com', emailVerified: true }), true)
  assert.equal(webUpdateGateShown(true, null), true)
  assert.equal(webUpdateGateShown(true, { email: 'info@projectplanner.us', emailVerified: true }), false)
  assert.equal(webUpdateGateShown(true, { email: 'info@projectplanner.us', emailVerified: false }), true)
  assert.equal(webUpdateGateShown(false, { email: 'someone@x.com', emailVerified: true }), false)
})
