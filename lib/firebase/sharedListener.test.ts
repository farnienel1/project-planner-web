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

test('a different key (another organisation, viewer or plan) stops the old listener and never hands on its rows', () => {
  const timers = fakeTimers()
  const shared = createSharedListener<number>(timers)
  const first = fakeSource()
  const second = fakeSource()
  shared.subscribe('org-1', first.start, () => undefined)
  first.emit(7)
  const seen: number[] = []
  shared.subscribe('org-2', second.start, (v) => seen.push(v))
  assert.equal(first.stops(), 1)
  assert.deepEqual(seen, [], 'no snapshot of org-1')
  first.emit(8)
  assert.deepEqual(seen, [], 'a late org-1 snapshot is dropped')
  second.emit(9)
  assert.deepEqual(seen, [9])
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
