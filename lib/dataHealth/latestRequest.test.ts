import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLatestRequest } from './latestRequest.ts'

test('only the latest picker request may set the impact; a closed picker accepts none', async () => {
  const latest = createLatestRequest()
  const shown: string[] = []
  const load = (key: string, ms: number) => {
    const token = latest.begin(key)
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        if (latest.isCurrent(token)) shown.push(key)
        resolve()
      }, ms)
    )
  }
  // Row A opened, then row B before A's counts return: A's answer is dropped.
  await Promise.all([load('A', 20), load('B', 5)])
  assert.deepEqual(shown, ['B'])
  // Reopening the same row: only the second request counts.
  shown.length = 0
  await Promise.all([load('A', 20), load('A', 5)])
  assert.deepEqual(shown, ['A'])
  // Closed before the answer: nothing lands.
  shown.length = 0
  const pending = load('C', 5)
  latest.clear()
  await pending
  assert.deepEqual(shown, [])
})
