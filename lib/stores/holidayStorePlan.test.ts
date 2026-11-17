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

function harness(options: {
  ownLeave: boolean | (() => boolean)
  refusePlan?: boolean
  refuseParts?: number
  collectionResolves?: boolean
  holdReady?: boolean | ((call: number) => boolean)
  clock?: { now: number }
}) {
  const readyGate: Array<() => void> = []
  const calls: Calls = { ready: 0, collection: [], plan: [] }
  const pending: Pending[] = []
  const restore = setHolidayListenersForTests({
    now: () => options.clock?.now ?? Date.now(),
    switchesReady: async () => {
      calls.ready += 1
      const hold = typeof options.holdReady === 'function' ? options.holdReady(calls.ready) : options.holdReady
      if (hold) await new Promise<void>((resolve) => readyGate.push(resolve))
    },
    operativeOwnLeave: () => (typeof options.ownLeave === 'function' ? options.ownLeave() : options.ownLeave),
    subscribeCollectionLoaded: ((_key: string, organizationId: string) => {
      calls.collection.push(organizationId)
      if (options.collectionResolves) return Promise.resolve()
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
    }) as never,
    subscribePlan: ((_key: string, organizationId: string, _name: string, _parts: unknown, _onDocs: unknown, onError: (e: { message: string }) => void) => {
      calls.plan.push(organizationId)
      if (options.refuseParts) {
        for (let i = 0; i < options.refuseParts; i += 1) onError({ message: 'Missing or insufficient permissions.' })
        return Promise.resolve()
      }
      if (options.refusePlan) return Promise.reject(new Error('Missing or insufficient permissions.'))
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject, onError }))
    }) as never,
    unsubscribeCollection: () => undefined,
    unsubscribePlan: () => undefined,
  })
  return { calls, pending, restore, readyGate }
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

test('1.56.0 holiday store (S1): a load that stops because the company switched frees its slot and its loading', async () => {
  adoptCurrentOrganization('ORG-H', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, readyGate, restore } = harness({ ownLeave: false, holdReady: true })
  try {
    useHolidayStore.setState({ loadedOrgId: null })
    void useHolidayStore.getState().loadBookings('ORG-H')
    await settle(5)
    assert.equal(useHolidayStore.getState().loading, true)
    adoptCurrentOrganization('ORG-I', 'UID-OP')
    readyGate.shift()?.()
    await settle(10)
    assert.equal(useHolidayStore.getState().loading, false)
    assert.deepEqual(calls.collection, [])
    adoptCurrentOrganization('ORG-H', 'UID-OP')
    replanHolidayBookings()
    await settle(5)
    readyGate.shift()?.()
    await settle(10)
    assert.deepEqual(calls.collection, ['ORG-H'], 'switching back plans and listens again')
  } finally {
    restore()
  }
})

test('1.56.0 holiday store (S2): a plan that works clears the company+user failure records; sign-out clears them too', async () => {
  const clock = { now: 5_000_000 }
  let ownLeave = true
  adoptCurrentOrganization('ORG-J', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, restore } = harness({ ownLeave: () => ownLeave, refusePlan: true, collectionResolves: true, clock })
  try {
    await useHolidayStore.getState().loadBookings('ORG-J')
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[0] + 1
    replanHolidayBookings()
    await settle(10)
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[1] + 1
    replanHolidayBookings()
    await settle(10)
    assert.equal(calls.plan.length, 3, 'the own plan used up its retries')
    ownLeave = false // the switch flips off: the whole collection works
    replanHolidayBookings()
    await settle(10)
    assert.deepEqual(calls.collection, ['ORG-J'])
    ownLeave = true // and back on: the own plan is tried again at once
    replanHolidayBookings()
    await settle(10)
    assert.equal(calls.plan.length, 4)
    // Sign out and back in: the failure of the last try is forgotten.
    useAuthStore.setState({ user: null })
    replanHolidayBookings()
    useAuthStore.setState({ user: operative as never })
    await useHolidayStore.getState().loadBookings('ORG-J')
    assert.equal(calls.plan.length, 5)
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[0] + 1
    replanHolidayBookings()
    await settle(10)
    assert.equal(calls.plan.length, 6, 'after sign-in the first backoff is 30 s again')
  } finally {
    restore()
  }
})

test('1.56.0 holiday store (S3): several refused query parts count as one failure for the load', async () => {
  const clock = { now: 9_000_000 }
  adoptCurrentOrganization('ORG-K', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  const { calls, restore } = harness({ ownLeave: true, refuseParts: 3, clock })
  try {
    await useHolidayStore.getState().loadBookings('ORG-K')
    assert.equal(calls.plan.length, 1)
    clock.now += HOLIDAY_RETRY_BACKOFF_MS[0] + 1
    replanHolidayBookings()
    await settle(10)
    assert.equal(calls.plan.length, 2, 'retried after 30 s (one failure, not three)')
  } finally {
    restore()
  }
})

test('1.56.0 holiday store (S4): after a successful subscribe the load clears loading and runs its check once more', async () => {
  adoptCurrentOrganization('ORG-L', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  useHolidayStore.setState({ loadedOrgId: null, loading: false })
  const { calls, restore } = harness({ ownLeave: false, collectionResolves: true })
  try {
    await useHolidayStore.getState().loadBookings('ORG-L')
    assert.equal(useHolidayStore.getState().loading, false)
    // The plan is recorded: a re-plan with the same inputs starts nothing.
    replanHolidayBookings()
    await settle(10)
    assert.deepEqual(calls.collection, ['ORG-L'])
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: a load stopped by a switch clears the planned key, so the way back to B subscribes B', async () => {
  adoptCurrentOrganization('ORG-M', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  // The first load (A) reads the switches at once; the second (B) waits for them.
  const { calls, readyGate, restore } = harness({ ownLeave: false, collectionResolves: true, holdReady: (call) => call === 2 })
  try {
    await useHolidayStore.getState().loadBookings('ORG-M') // A succeeds: planned key "all"
    adoptCurrentOrganization('ORG-N', 'UID-OP')
    void useHolidayStore.getState().loadBookings('ORG-N') // B starts and waits on the switches
    await settle(5)
    adoptCurrentOrganization('ORG-M', 'UID-OP') // switch to A during the switch read
    readyGate.shift()?.()
    await settle(10)
    adoptCurrentOrganization('ORG-N', 'UID-OP') // and back to B
    replanHolidayBookings()
    await settle(10)
    assert.deepEqual(calls.collection, ['ORG-M', 'ORG-N'], 'B is subscribed')
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: a company switch during the subscribe leaves no loading behind', async () => {
  adoptCurrentOrganization('ORG-O', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  useHolidayStore.setState({ loadedOrgId: null, loading: false })
  const { pending, restore } = harness({ ownLeave: false })
  try {
    const load = useHolidayStore.getState().loadBookings('ORG-O')
    await settle(5)
    assert.equal(useHolidayStore.getState().loading, true)
    adoptCurrentOrganization('ORG-P', 'UID-OP')
    pending[0].resolve()
    await load
    assert.equal(useHolidayStore.getState().loading, false)
  } finally {
    restore()
  }
})

test('1.56.0 holiday store: an older load\'s listener error never shows once a newer load started', async () => {
  adoptCurrentOrganization('ORG-Q', 'UID-OP')
  useAuthStore.setState({ user: operative as never })
  useOperativeStore.setState({ operatives: [] as never })
  useHolidayStore.setState({ error: null })
  const { pending, restore } = harness({ ownLeave: true })
  try {
    void useHolidayStore.getState().loadBookings('ORG-Q')
    await settle(5)
    void useHolidayStore.getState().loadBookings('ORG-Q') // a newer load starts
    await settle(5)
    pending[0].onError?.({ message: 'refused (old load)' })
    await settle(5)
    assert.equal(useHolidayStore.getState().error, null)
    pending[1].onError?.({ message: 'refused (new load)' })
    assert.equal(useHolidayStore.getState().error, 'refused (new load)')
  } finally {
    restore()
  }
})
