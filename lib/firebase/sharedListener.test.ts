import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSharedListener } from './sharedListener.ts'
import { navigationMayStart } from '../navigation/pendingNavigation.ts'

function fakeTimers() {
  const pending = new Map<number, () => void>()
  let next = 1
  return {
    setTimer: (fn: () => void) => {
      const id = next++
      pending.set(id, fn)
      return id
    },
    clearTimer: (id: unknown) => {
      pending.delete(id as number)
    },
    runAll: () => {
      const fns = [...pending.values()]
      pending.clear()
      for (const fn of fns) fn()
    },
    count: () => pending.size,
  }
}

function fakeSource() {
  let starts = 0
  let stops = 0
  let emit: ((value: number) => void) | null = null
  return {
    start: (e: (value: number) => void) => {
      starts += 1
      emit = e
      return () => {
        stops += 1
      }
    },
    emit: (value: number) => emit?.(value),
    starts: () => starts,
    stops: () => stops,
  }
}

test('a second subscriber with the same key reuses the listener and gets the last snapshot at once', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  const source = fakeSource()
  const a: number[] = []
  const b: number[] = []
  const stopA = shared.subscribe('org-1', source.start, (v) => a.push(v))
  source.emit(1)
  const stopB = shared.subscribe('org-1', source.start, (v) => b.push(v))
  assert.equal(source.starts(), 1)
  assert.deepEqual(b, [1])
  source.emit(2)
  assert.deepEqual(a, [1, 2])
  assert.deepEqual(b, [1, 2])
  stopA()
  stopB()
  assert.equal(source.stops(), 0, 'kept open for the keep-alive')
  timers.runAll()
  assert.equal(source.stops(), 1)
  assert.equal(shared.activeKey(), null)
})

test('re-subscribing inside the keep-alive cancels the stop (profile → edit → profile)', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  const source = fakeSource()
  const stop = shared.subscribe('org-1', source.start, () => undefined)
  source.emit(5)
  stop()
  assert.equal(timers.count(), 1)
  const seen: number[] = []
  const stop2 = shared.subscribe('org-1', source.start, (v) => seen.push(v))
  assert.deepEqual(seen, [5])
  assert.equal(timers.count(), 0)
  assert.equal(source.starts(), 1)
  stop2()
})

test('a different key (another organisation, viewer or plan) never hands on the old rows; the old one stops when its screen leaves', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  const first = fakeSource()
  const second = fakeSource()
  const stopFirst = shared.subscribe('org-1', first.start, () => undefined)
  first.emit(7)
  const seen: number[] = []
  shared.subscribe('org-2', second.start, (v) => seen.push(v))
  assert.equal(shared.activeKey(), 'org-2')
  assert.deepEqual(seen, [], 'no snapshot of org-1')
  first.emit(8)
  assert.deepEqual(seen, [], 'a late org-1 snapshot is dropped')
  second.emit(9)
  assert.deepEqual(seen, [9])
  assert.equal(first.stops(), 0, 'the screen still on org-1 keeps its listener until it leaves')
  stopFirst()
  assert.equal(first.stops(), 1, 'stopped at once, no keep-alive for a superseded listener')
  // A third subscriber to org-1 starts afresh, never the superseded one.
  shared.subscribe('org-1', first.start, () => undefined)
  assert.equal(first.starts(), 2)
})

test('a listener error: the entry is never reused; the next subscriber gets a fresh listener', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  let fail: () => void = () => undefined
  let starts = 0
  let stops = 0
  const start = (emit: (v: number) => void, onFail: () => void) => {
    starts += 1
    fail = onFail
    emit(1)
    return () => {
      stops += 1
    }
  }
  const stopA = shared.subscribe('k', start, () => undefined)
  fail()
  assert.equal(shared.activeKey(), null)
  assert.equal(stops, 0, 'the screen already on it keeps it')
  const seen: number[] = []
  shared.subscribe('k', start, (v) => seen.push(v))
  assert.equal(starts, 2, 'fresh listener')
  stopA()
  assert.equal(stops, 1, 'the failed one stops when its screen leaves, with no keep-alive')
  assert.equal(timers.count(), 0)
  // Failing with nobody on it stops it at once.
  fail()
  assert.equal(stops, 1, 'the second is still serving its subscriber')
})

test('a listener that fails while starting gives nothing and is stopped', () => {
  const shared = createSharedListener<number>(fakeTimers())
  let stops = 0
  const seen: number[] = []
  shared.subscribe(
    'k',
    (_emit, fail) => {
      fail()
      return () => {
        stops += 1
      }
    },
    (v) => seen.push(v)
  )
  assert.equal(stops, 1)
  assert.equal(shared.activeKey(), null)
})

test('a snapshot emitted while starting reaches the first subscriber; unsubscribe twice is harmless; reset stops now', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  let stops = 0
  const seen: number[] = []
  const stop = shared.subscribe(
    'k',
    (emit) => {
      emit(3)
      return () => {
        stops += 1
      }
    },
    (v) => seen.push(v)
  )
  assert.deepEqual(seen, [3])
  stop()
  stop()
  assert.equal(timers.count(), 1)
  shared.reset()
  assert.equal(stops, 1)
  timers.runAll()
  assert.equal(stops, 1)
})

test('navigationMayStart: a second click while a navigation is pending is ignored', () => {
  assert.equal(navigationMayStart(null), true)
  assert.equal(navigationMayStart(undefined), true)
  assert.equal(navigationMayStart('/dashboard/users/a'), false)
})

test('reset and resetUnless also stop superseded and failed listeners still open for a screen', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  const org1 = fakeSource()
  const org2 = fakeSource()
  shared.subscribe('org-1', org1.start, () => undefined) // a screen stays on org-1
  shared.subscribe('org-2', org2.start, () => undefined) // supersedes org-1 (retired, still open)
  assert.equal(shared.retiredCount(), 1)
  assert.equal(org1.stops(), 0)
  // Organisation switch to org-2: the retired org-1 listener stops, org-2 stays.
  shared.resetUnless((key) => key === 'org-2')
  assert.equal(org1.stops(), 1)
  assert.equal(org2.stops(), 0)
  assert.equal(shared.retiredCount(), 0)

  // A failed listener still serving a screen is stopped by sign-out (reset).
  let fail: () => void = () => undefined
  let failedStops = 0
  shared.subscribe(
    'org-3',
    (_emit, onFail) => {
      fail = onFail
      return () => {
        failedStops += 1
      }
    },
    () => undefined
  )
  fail()
  assert.equal(shared.retiredCount(), 2, 'org-2 superseded by org-3, and org-3 failed: both still serving a screen')
  shared.reset()
  assert.equal(failedStops, 1)
  assert.equal(org2.stops(), 1)
  assert.equal(shared.retiredCount(), 0)
  assert.equal(shared.activeKey(), null)
})
