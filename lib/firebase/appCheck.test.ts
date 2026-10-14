import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldUseAppCheckDebugToken } from './appCheck.ts'

test('App Check debug token is only on in development', () => {
  assert.equal(shouldUseAppCheckDebugToken('development'), true)
  assert.equal(shouldUseAppCheckDebugToken('test'), true)
  assert.equal(shouldUseAppCheckDebugToken('production'), false)
})
