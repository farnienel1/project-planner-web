import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FOUNDER_CONFIRM_STORAGE_KEY,
  loadFounderConfirmEmailPayload,
  saveFounderConfirmEmailPayload,
  clearFounderConfirmEmailPayload,
} from './founderConfirmEmail.ts'

const memory = new Map<string, string>()

const fakeStorage: Storage = {
  get length() {
    return memory.size
  },
  clear() {
    memory.clear()
  },
  getItem(key: string) {
    return memory.get(key) ?? null
  },
  key(index: number) {
    return [...memory.keys()][index] ?? null
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
}

test('founder confirm payload round-trips through sessionStorage', () => {
  memory.clear()
  const original = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage: fakeStorage },
  })
  try {
    saveFounderConfirmEmailPayload({
      confirmationToken: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      organizationName: 'Acme',
      firstName: 'Sam',
      to: 'sam@example.com',
    })
    assert.equal(memory.has(FOUNDER_CONFIRM_STORAGE_KEY), true)
    const loaded = loadFounderConfirmEmailPayload()
    assert.equal(loaded?.to, 'sam@example.com')
    assert.equal(loaded?.organizationName, 'Acme')
    clearFounderConfirmEmailPayload()
    assert.equal(loadFounderConfirmEmailPayload(), null)
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: original })
    } else {
      // @ts-expect-error test cleanup
      delete globalThis.window
    }
  }
})
