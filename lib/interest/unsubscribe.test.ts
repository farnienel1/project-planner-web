import assert from 'node:assert/strict'
import test from 'node:test'
import { honeypotFilled, interestUnsubscribeBodySchema } from '../security/publicFormSchemas.ts'
import { interestUnsubscribedAtFields } from './adminStore.ts'

test('unsubscribe JSON requires a token shape and treats a filled honeypot as filled', () => {
  const parsed = interestUnsubscribeBodySchema.safeParse({ token: 'abc.def' })
  assert.equal(parsed.success, true)
  const emailOnly = interestUnsubscribeBodySchema.safeParse({ email: 'ada@example.com' })
  assert.equal(emailOnly.success, true)
  if (emailOnly.success) {
    assert.equal(emailOnly.data.token, undefined)
    assert.equal(emailOnly.data.email, 'ada@example.com')
  }
  const honeypot = interestUnsubscribeBodySchema.safeParse({
    token: 'abc.def',
    website: 'https://spam.example',
  })
  assert.equal(honeypot.success, true)
  if (honeypot.success) assert.equal(honeypotFilled(honeypot.data.website), true)
})

test('registration unsubscribe writes unsubscribedAt as a timestamp', () => {
  const when = new Date('2026-10-16T12:00:00.000Z')
  const { fields } = interestUnsubscribedAtFields(when)
  assert.equal((fields.unsubscribedAt as { timestampValue: string }).timestampValue, when.toISOString())
  assert.equal((fields.updatedAt as { timestampValue: string }).timestampValue, when.toISOString())
})
