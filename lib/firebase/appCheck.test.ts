import { test } from 'node:test'
import assert from 'node:assert/strict'
import { awaitAppCheckToken, shouldUseAppCheckDebugToken } from './appCheck.ts'

test('App Check debug token is only on in development', () => {
  assert.equal(shouldUseAppCheckDebugToken('development'), true)
  assert.equal(shouldUseAppCheckDebugToken('test'), true)
  assert.equal(shouldUseAppCheckDebugToken('production'), false)
})

test('awaitAppCheckToken waits until a token appears', async () => {
  let calls = 0
  const token = await awaitAppCheckToken({} as never, {
    timeoutMs: 1_000,
    now: () => (calls >= 2 ? 2_000 : 0),
    sleep: async () => {
      calls += 1
    },
    readToken: async () => (calls >= 2 ? 'jwt-from-recaptcha' : ''),
  })
  assert.equal(token, 'jwt-from-recaptcha')
})

test('awaitAppCheckToken returns empty when App Check was never started', async () => {
  assert.equal(await awaitAppCheckToken(null), '')
})
