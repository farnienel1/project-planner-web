import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notificationPushesToActor, notificationDeliversDevicePush } from '@/lib/canonical'
import { sendPushTestToSelf, PUSH_TEST_TITLE } from './pushTest'

test('push test writes one push_test row to the signed-in user only', async () => {
  const rows: Array<Record<string, unknown>> = []
  const count = await sendPushTestToSelf({ organizationId: 'ORG', userId: 'U1' }, async (input) => {
    rows.push(input as Record<string, unknown>)
  })
  assert.equal(count, 1)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'push_test')
  assert.equal(rows[0].userId, 'U1')
  assert.equal(rows[0].organizationId, 'ORG')
  assert.equal(rows[0].title, PUSH_TEST_TITLE)
  // Rulebook §13: the actor is not passed, so it defaults to the signed-in uid; push_test still pushes to the actor.
  assert.equal('actorUserId' in rows[0], false)
  assert.equal(notificationDeliversDevicePush('push_test'), true)
  assert.equal(notificationPushesToActor('push_test'), true)
})

test('push test writes nothing without a signed-in user and refuses without an organisation', async () => {
  const rows: unknown[] = []
  assert.equal(await sendPushTestToSelf({ organizationId: 'ORG', userId: '' }, async (i) => void rows.push(i)), 0)
  assert.equal(rows.length, 0)
  await assert.rejects(sendPushTestToSelf({ organizationId: '', userId: 'U1' }, async () => undefined))
})
