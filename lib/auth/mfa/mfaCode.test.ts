import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractMfaCode, isCompleteMfaCode } from './mfaCode.ts'

test('extractMfaCode keeps a typed 6-digit code', () => {
  assert.equal(extractMfaCode('482913'), '482913')
  assert.equal(isCompleteMfaCode('482913'), true)
})

test('extractMfaCode ignores spaces, dashes, and surrounding copy from paste', () => {
  assert.equal(extractMfaCode('482 913'), '482913')
  assert.equal(extractMfaCode('482-913'), '482913')
  assert.equal(extractMfaCode('Your code is 482913 and expires in 10 minutes'), '482913')
  assert.equal(extractMfaCode('\n482913\n'), '482913')
})

test('incomplete paste does not count as a complete code', () => {
  assert.equal(extractMfaCode('48291'), '48291')
  assert.equal(isCompleteMfaCode('48291'), false)
  assert.equal(isCompleteMfaCode(''), false)
})
