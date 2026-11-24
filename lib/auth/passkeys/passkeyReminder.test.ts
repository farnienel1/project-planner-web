import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  clearPasskeyReminderDue,
  isPasskeyReminderSilenced,
  passkeyReminderBlocked,
  markPasskeyReminderDue,
  passkeyReminderShows,
  passkeyReminderSilencedKey,
  passkeyReminderWorthChecking,
  PASSKEY_REMINDER_DUE_KEY,
  silencePasskeyReminder,
  takePasskeyReminderDue,
} from './passkeyReminder.ts'

function memoryStore() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

test('passkey reminder: due once after a code sign-in into the app, for that account only', () => {
  const session = memoryStore()
  markPasskeyReminderDue('u1', '/dashboard', session)
  assert.equal(session.map.get(PASSKEY_REMINDER_DUE_KEY), 'u1')
  assert.equal(takePasskeyReminderDue('u2', session), false, 'another account never sees it')
  assert.equal(session.map.has(PASSKEY_REMINDER_DUE_KEY), false, 'the mark is used up either way')
  markPasskeyReminderDue('u1', '/dashboard/projects', session)
  assert.equal(takePasskeyReminderDue('u1', session), true)
  assert.equal(takePasskeyReminderDue('u1', session), false, 'once per sign-in: ✕ brings it back only at the next one')
})

test('passkey reminder: sign-out clears the due mark', () => {
  const session = memoryStore()
  markPasskeyReminderDue('u1', '/dashboard', session)
  clearPasskeyReminderDue(session)
  assert.equal(takePasskeyReminderDue('u1', session), false)
  assert.doesNotThrow(() => clearPasskeyReminderDue(null))
})

test('passkey reminder: waits while the forced-update screen or the analytics consent prompt is up', () => {
  assert.equal(passkeyReminderBlocked({ updateGateShown: true, consentPromptShown: false }), true)
  assert.equal(passkeyReminderBlocked({ updateGateShown: false, consentPromptShown: true }), true)
  assert.equal(passkeyReminderBlocked({ updateGateShown: false, consentPromptShown: false }), false)
})

test('passkey reminder: not marked for the developer console, a blank uid or no storage', () => {
  const session = memoryStore()
  markPasskeyReminderDue('u1', '/developer', session)
  markPasskeyReminderDue('', '/dashboard', session)
  assert.equal(session.map.size, 0)
  markPasskeyReminderDue('u1', '/dashboard', null)
  assert.equal(takePasskeyReminderDue('u1', null), false)
})

test('passkey reminder: "Don\'t remind me again" is per account in this browser', () => {
  const local = memoryStore()
  silencePasskeyReminder('u1', local)
  assert.equal(local.map.get(passkeyReminderSilencedKey('u1')), '1')
  assert.equal(isPasskeyReminderSilenced('u1', local), true)
  assert.equal(isPasskeyReminderSilenced('u2', local), false)
})

test('passkey reminder: storage that throws (private mode) never breaks sign-in', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }
  assert.doesNotThrow(() => markPasskeyReminderDue('u1', '/dashboard', broken))
  assert.equal(takePasskeyReminderDue('u1', broken), false)
  assert.equal(isPasskeyReminderSilenced('u1', broken), false)
  assert.doesNotThrow(() => silencePasskeyReminder('u1', broken))
})

test('passkey reminder: shows only when due, available, not silenced and the account has no passkey', () => {
  const base = { due: true, available: true, silenced: false }
  assert.equal(passkeyReminderShows({ ...base, passkeyCount: 0 }), true)
  assert.equal(passkeyReminderShows({ ...base, passkeyCount: 1 }), false, 'account already has a passkey')
  assert.equal(passkeyReminderShows({ ...base, passkeyCount: null }), false, 'list failed: never show')
  assert.equal(passkeyReminderShows({ ...base, due: false, passkeyCount: 0 }), false, 'passkey sign-in: nothing marked due')
  assert.equal(passkeyReminderShows({ ...base, available: false, passkeyCount: 0 }), false, 'switch off or no browser support')
  assert.equal(passkeyReminderShows({ ...base, silenced: true, passkeyCount: 0 }), false)
  assert.equal(passkeyReminderWorthChecking({ ...base, silenced: true }), false, 'the list is not read when silenced')
})
