import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailsMatchIgnoreMask, maskEmail } from './maskEmail.ts'

test('masks local-part after the first character', () => {
  assert.equal(maskEmail('jane@company.co.uk'), 'j•••@company.co.uk')
  assert.equal(maskEmail('d@kestrelplumbing.co.uk'), 'd•••@kestrelplumbing.co.uk')
  assert.equal(maskEmail('  Info@ProjectPlanner.us '), 'I•••@ProjectPlanner.us')
})

test('handles missing or malformed addresses', () => {
  assert.equal(maskEmail(''), '')
  assert.equal(maskEmail(null), '')
  assert.equal(maskEmail('not-an-email'), '••••')
})

test('search still matches full or masked text', () => {
  assert.equal(emailsMatchIgnoreMask('jane@company.co.uk', 'jane@'), true)
  assert.equal(emailsMatchIgnoreMask('jane@company.co.uk', 'j•••@'), true)
  assert.equal(emailsMatchIgnoreMask('jane@company.co.uk', 'zzz'), false)
})
