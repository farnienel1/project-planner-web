/**
 * Review of #356 (third): store-level tests of the leave listener plan — a subscribe that stays pending never makes
 * `loadBookings` re-enter itself (bounded calls, timers still fire), and a company switch never re-opens the old
 * company or lets its error / loading touch the new one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adoptCurrentOrganization } from '../canonical/index.ts'
import { useAuthStore } from './authStore.ts'
import { useOperativeStore } from './operativeStore.ts'
import { replanHolidayBookings, setHolidayListenersForTests, useHolidayStore } from './holidayStore.ts'

type Calls = { ready: number; collection: string[]; plan: string[] }

function harness(options: { ownLeave: boolean }) {
  const calls: Calls = { ready: 0, collection: [], plan: [] }
  const pending: Array<{ reject: (error: Error) => void; onError?: (error: { message: string }) => void }> = []
  const restore = setHolidayListenersForTests({
    switchesReady: async () => {
      calls.ready += 1
    },
    operativeOwnLeave: () => options.ownLeave,
    subscribeCollectionLoaded: ((_key: string, organizationId: string) => {
      calls.collection.push(organizationId)
      return new Promise<void>((_resolve, reject) => pending.push({ reject }))
    }) as never,
    subscribePlan: ((_key: string, organizationId: string, _name: string, _parts: unknown, _onDocs: unknown, onError: (e: { message: string }) => void) => {
      calls.plan.push(organizationId)
      return new Promise<void>((_resolve, reject) => pending.push({ reject, onError }))
    }) as never,
    unsubscribeCollection: () => undefined,
    unsubscribePlan: () => undefined,
  })
  return { calls, pending, restore }
}

const operative = { id: 'UID-OP', email: 'op@x.com', role: 'operative', operativeMode: true }
const manager = { id: 'UID-OP', email: 'op@x.com', role: 'manager', manager: true }

async function settle(ms = 30): Promise<boolean> {
  let fired = false
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      fired = true
      resolve()
    }, ms)
  )
  return fired
}

test('1.56.0 holiday store: a pending subscribe never makes loadBookings re-enter (bounded calls, timers fire)', async () => {
  adoptCurrentOrganization('ORG-A', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, restore } = harness({ ownLeave: false })
  try {
    void useHolidayStore.getState().loadBookings('ORG-A')
    // Re-plans while the first load is pending (the readPlanSync start, roster and config events) start nothing.
    for (let i = 0; i < 100; i += 1) replanHolidayBookings()
    assert.equal(await settle(), true, 'a timer still fires')
    assert.equal(calls.ready, 1, 'loadBookings ran once')
    assert.deepEqual(calls.collection, ['ORG-A'])
    assert.equal(calls.plan.length, 0)
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: with the switch on an operative plans own leave once, however many re-plans arrive', async () => {
  adoptCurrentOrganization('ORG-A', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, restore } = harness({ ownLeave: true })
  try {
    void useHolidayStore.getState().loadBookings('ORG-A')
    for (let i = 0; i < 100; i += 1) replanHolidayBookings()
    assert.equal(await settle(), true)
    assert.equal(calls.ready, 1)
    assert.deepEqual(calls.plan, ['ORG-A'])
    assert.equal(calls.collection.length, 0)
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: user changes before loadBookings(B) — operative in A, manager in B — A is never re-opened and its error never touches B', async () => {
  adoptCurrentOrganization('ORG-A', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  useHolidayStore.setState({ error: null, loading: false, loadedOrgId: null, bookings: [] })
  const { calls, pending, restore } = harness({ ownLeave: true })
  try {
    void useHolidayStore.getState().loadBookings('ORG-A')
    await settle(5)
    assert.deepEqual(calls.plan, ['ORG-A'])
    // Switch company to B; the user document for B arrives (manager) before B's loadBookings is called.
    adoptCurrentOrganization('ORG-B', 'UID-OP')
    useAuthStore.setState({ user: manager as never })
    replanHolidayBookings()
    await settle(5)
    assert.equal(calls.ready, 1, 'A is not re-opened')
    assert.deepEqual(calls.collection, [])
    // A's pending subscribe now fails, and A's listener reports a later error: B's screen is untouched.
    pending[0].onError?.({ message: 'refused in A' })
    pending[0].reject(new Error('refused in A'))
    await settle(5)
    assert.equal(useHolidayStore.getState().error, null)
    // B's own load plans B (manager: whole collection).
    useHolidayStore.setState({ loading: false })
    void useHolidayStore.getState().loadBookings('ORG-B')
    await settle(5)
    assert.deepEqual(calls.collection, ['ORG-B'])
    assert.deepEqual(calls.plan, ['ORG-A'])
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: a later listener error on the current company reaches the screen', async () => {
  adoptCurrentOrganization('ORG-C', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  useHolidayStore.setState({ error: null })
  const { pending, restore } = harness({ ownLeave: true })
  try {
    void useHolidayStore.getState().loadBookings('ORG-C')
    await settle(5)
    pending[0].onError?.({ message: 'Missing or insufficient permissions.' })
    assert.equal(useHolidayStore.getState().error, 'Missing or insufficient permissions.')
  } finally {
    restore()
  }
})
