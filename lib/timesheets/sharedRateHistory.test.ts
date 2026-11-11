import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resetSharedRateHistoryListener,
  resetSharedRateHistoryOutsideCurrentOrganization,
  sharedRateHistoryKey,
  sharedRateHistoryListener,
} from './sharedRateHistory.ts'
import { adoptCurrentOrganization, captureOrganizationContext } from '../canonical/engine.ts'

function subscribeFor(organizationId: string, counter: { starts: number; stops: number }) {
  const key = sharedRateHistoryKey({ organizationId, epoch: captureOrganizationContext().epoch, viewerId: 'adm', plan: { kind: 'all' } })
  return sharedRateHistoryListener.subscribe(
    key,
    () => {
      counter.starts += 1
      return () => {
        counter.stops += 1
      }
    },
    () => undefined
  )
}

test('organisation A → B → A inside the keep-alive: A gets a fresh listener, never the one from before the switch', () => {
  resetSharedRateHistoryListener()
  const a1 = { starts: 0, stops: 0 }
  adoptCurrentOrganization('org-a', 'adm')
  subscribeFor('org-a', a1)() // leave: kept alive for 60 s
  assert.equal(a1.stops, 0)

  adoptCurrentOrganization('org-b', 'adm')
  resetSharedRateHistoryOutsideCurrentOrganization() // what the auth store does after unsubscribeOrgCollectionsOutside
  assert.equal(a1.stops, 1, 'the org-a listener stops on the switch')

  adoptCurrentOrganization('org-a', 'adm')
  resetSharedRateHistoryOutsideCurrentOrganization()
  const a2 = { starts: 0, stops: 0 }
  const leave = subscribeFor('org-a', a2)
  assert.equal(a2.starts, 1, 'fresh listener for org-a')
  // Same organisation context again (no switch): the reset keeps it.
  resetSharedRateHistoryOutsideCurrentOrganization()
  assert.equal(a2.stops, 0)
  leave()
  resetSharedRateHistoryListener()
  assert.equal(a2.stops, 1)
})

test('the key carries the organisation epoch: a stale epoch never matches a fresh subscribe', () => {
  resetSharedRateHistoryListener()
  adoptCurrentOrganization('org-a', 'adm')
  const before = { starts: 0, stops: 0 }
  subscribeFor('org-a', before)()
  adoptCurrentOrganization('org-b', 'adm')
  adoptCurrentOrganization('org-a', 'adm')
  // Even without the reset call, the epoch moved, so the key differs.
  const after = { starts: 0, stops: 0 }
  subscribeFor('org-a', after)()
  assert.equal(after.starts, 1)
  assert.equal(before.stops, 1)
  resetSharedRateHistoryListener()
})
