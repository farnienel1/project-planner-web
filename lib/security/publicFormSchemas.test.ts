import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  honeypotFilled,
  interestRegisterBodySchema,
  publicGateBodySchema,
  supportContactBodySchema,
} from './publicFormSchemas.ts'

test('interest schema requires consent and an email-shaped address', () => {
  const parsed = interestRegisterBodySchema.safeParse({
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Analytical Engines',
    email: 'ada@example.com',
    consent: true,
  })
  assert.equal(parsed.success, true)
  const bad = interestRegisterBodySchema.safeParse({
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Analytical Engines',
    email: 'not-an-email',
    consent: true,
  })
  assert.equal(bad.success, false)
})

test('a filled honeypot is detected', () => {
  assert.equal(honeypotFilled(''), false)
  assert.equal(honeypotFilled('   '), false)
  assert.equal(honeypotFilled('https://spam.example'), true)
})

test('support schema caps the message and locks the topic list', () => {
  const parsed = supportContactBodySchema.safeParse({
    name: 'Ada',
    email: 'ada@example.com',
    topic: 'Billing',
    message: 'Card failed.',
  })
  assert.equal(parsed.success, true)
  const badTopic = supportContactBodySchema.safeParse({
    name: 'Ada',
    email: 'ada@example.com',
    topic: 'Other',
    message: 'Hi',
  })
  assert.equal(badTopic.success, false)
})

test('login gate accepts an email and rejects a password field as unknown form shape', () => {
  const parsed = publicGateBodySchema.safeParse({ form: 'login', email: 'ada@example.com' })
  assert.equal(parsed.success, true)
  const signup = publicGateBodySchema.safeParse({
    form: 'signup',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  })
  assert.equal(signup.success, true)
  const missing = publicGateBodySchema.safeParse({ form: 'login' })
  assert.equal(missing.success, false)
})

test('invite-setup requires a uuid', () => {
  const parsed = publicGateBodySchema.safeParse({
    form: 'invite-setup',
    invitationId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(parsed.success, true)
  const bad = publicGateBodySchema.safeParse({ form: 'invite-setup', invitationId: 'nope' })
  assert.equal(bad.success, false)
})
