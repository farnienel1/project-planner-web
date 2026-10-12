import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  readWarningsSortDirection,
  resetWarningsSortPreferenceMemoryForTests,
  storedWarningsSortDirection,
  warningsSortDirectionStorageKey,
  writeWarningsSortDirection,
} from './warningsSortPreference.ts'

function withStorage(store: Map<string, string>, run: () => void) {
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  }
  resetWarningsSortPreferenceMemoryForTests()
  try {
    run()
  } finally {
    resetWarningsSortPreferenceMemoryForTests()
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
}

test('warnings sort storage is keyed by signed-in user and defaults only when never chosen', () => {
  assert.equal(warningsSortDirectionStorageKey('user-a'), 'warningsSortDirection:user-a')
  assert.equal(warningsSortDirectionStorageKey('user-b') === warningsSortDirectionStorageKey('user-a'), false)

  const store = new Map<string, string>()
  withStorage(store, () => {
    assert.equal(storedWarningsSortDirection('user-a'), null)
    assert.equal(readWarningsSortDirection('user-a'), 'oldest')
    writeWarningsSortDirection('user-a', 'newest')
    assert.equal(readWarningsSortDirection('user-a'), 'newest')
    assert.equal(storedWarningsSortDirection('user-a'), 'newest')
    assert.equal(readWarningsSortDirection('user-b'), 'oldest')
    assert.equal(storedWarningsSortDirection('user-b'), null)
    assert.equal(store.get('warningsSortDirection:user-a'), 'newest')
    assert.equal(store.has('warningsSortDirection:user-b'), false)
    writeWarningsSortDirection('', 'newest')
    assert.equal(store.has('warningsSortDirection:'), false)
  })
})

test('a chosen sort is still there after a remount-style re-read and is not rewritten to oldest', () => {
  const store = new Map<string, string>()
  withStorage(store, () => {
    writeWarningsSortDirection('user-a', 'newest')
    resetWarningsSortPreferenceMemoryForTests()
    assert.equal(store.get('warningsSortDirection:user-a'), 'newest')
    assert.equal(readWarningsSortDirection('user-a'), 'newest')
    assert.equal(readWarningsSortDirection('user-a'), 'newest')
    assert.equal(store.get('warningsSortDirection:user-a'), 'newest')

    writeWarningsSortDirection('user-a', 'oldest')
    resetWarningsSortPreferenceMemoryForTests()
    assert.equal(storedWarningsSortDirection('user-a'), 'oldest')
    assert.equal(readWarningsSortDirection('user-a'), 'oldest')
    assert.equal(store.get('warningsSortDirection:user-a'), 'oldest')
  })
})

test('a successful choice stays in memory when localStorage cannot be read again', () => {
  const store = new Map<string, string>()
  const previousWindow = (globalThis as { window?: unknown }).window
  let failReads = false
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => {
        if (failReads) throw new Error('blocked')
        return store.get(key) ?? null
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  }
  resetWarningsSortPreferenceMemoryForTests()
  try {
    writeWarningsSortDirection('user-a', 'newest')
    failReads = true
    assert.equal(readWarningsSortDirection('user-a'), 'newest')
    assert.equal(readWarningsSortDirection('user-b'), 'oldest')
  } finally {
    resetWarningsSortPreferenceMemoryForTests()
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
})
