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
import { HOLIDAY_RETRY_BACKOFF_MS, replanHolidayBookings, setHolidayListenersForTests, useHolidayStore } from './holidayStore.ts'

type Calls = { ready: number; collection: string[]; plan: string[] }

type Pending = { resolve: () => void; reject: (error: Error) => void; onError?: (error: { message: string }) => void }

function harness(options: { ownLeave: boolean; refusePlan?: boolean; clock?: { now: number } }) {
  const calls: Calls = { ready: 0, collection: [], plan: [] }
  const pending: Pending[] = []
  const restore = setHolidayListenersForTests({
    now: () => options.clock?.now ?? Date.now(),
    switchesReady: async () => {
      calls.ready += 1
    },
    operativeOwnLeave: () => options.ownLeave,
    subscribeCollectionLoaded: ((_key: string, organizationId: string) => {
      calls.collection.push(organizationId)
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
    }) as never,
    subscribePlan: ((_key: string, organizationId: string, _name: string, _parts: unknown, _onDocs: unknown, onError: (e: { message: string }) => void) => {
      calls.plan.push(organizationId)
      if (options.refusePlan) return Promise.reject(new Error('Missing or insufficient permissions.'))
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject, onError }))
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

test('1.56.0 holiday store: a superseded load settles only when the newer load settles (refresh is not told "done" early)', async () => {
  adoptCurrentOrganization('ORG-D', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { pending, restore } = harness({ ownLeave: false })
  try {
    let firstDone = false
    let secondDone = false
    void useHolidayStore.getState().loadBookings('ORG-D').then(() => {
      firstDone = true
    })
    await settle(5)
    void useHolidayStore.getState().loadBookings('ORG-D').then(() => {
      secondDone = true
    })
    await settle(5)
    pending[0].resolve()
    await settle(10)
    assert.equal(firstDone, false, 'the superseded load waits for the newer one')
    pending[1].resolve()
    await settle(10)
    assert.equal(secondDone, true)
    assert.equal(firstDone, true)
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: a load that finishes after a company switch records no plan; switching back re-plans and restarts the listener', async () => {
  adoptCurrentOrganization('ORG-E', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, pending, restore } = harness({ ownLeave: false })
  try {
    void useHolidayStore.getState().loadBookings('ORG-E')
    await settle(5)
    adoptCurrentOrganization('ORG-F', 'UID-OP')
    pending[0].resolve() // the old company's load finishes after the switch
    await settle(10)
    adoptCurrentOrganization('ORG-E', 'UID-OP') // switch back (a new epoch)
    replanHolidayBookings() // e.g. the operatives rows or platformConfig/app arrive
    await settle(10)
    assert.deepEqual(calls.collection, ['ORG-E', 'ORG-E'], 'the listener is started again')
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: retries after a refusal are capped — 30 s, then 2 min, then none until the inputs change', async () => {
  const clock = { now: 1_000_000 }
  adoptCurrentOrganization('ORG-G', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, restore } = harness({ ownLeave: true, refusePlan: true, clock })
  const replanMany = async () => {
    for (let i = 0; i < 20; i += 1) replanHolidayBookings()
    await settle(10)
  }
  try {
    await useHolidayStore.getState().loadBookings('ORG-G')
    assert.equal(calls.plan.length, 1)
    await replanMany()
    assert.equal(calls.plan.length, 1, 'no retry before the first backoff')
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[0] + 1
    await replanMany()
    assert.equal(calls.plan.length, 2, 'one retry after 30 s')
    clock.now += 60_000
    await replanMany()
    assert.equal(calls.plan.length, 2, 'the second retry waits 2 min')
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[1]
    await replanMany()
    assert.equal(calls.plan.length, 3, 'one retry after 2 min')
    clock.now += 3_600_000
    await replanMany()
    assert.equal(calls.plan.length, 3, 'then none until the inputs change')
    // The inputs change (an operatives row on the email): a new plan is tried.
    useOperativeStore.setState({ operatives: [{ id: 'OP-ROW', email: 'op@x.com' }] as never })
    await replanMany()
    assert.equal(calls.plan.length, 4)
  } finally {
    restore()
  }
})
