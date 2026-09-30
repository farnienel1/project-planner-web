import assert from 'node:assert/strict'
import test from 'node:test'
import { INTEREST_CREATE_FIELDS, buildInterestDraft } from './registration.ts'

const base = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Analytical Engines',
  email: 'Ada@Example.com',
  phone: '07000 000000',
  role: 'Owner / Director',
  teamSize: '6–15',
  sectors: ['CAT A', 'Hotels'],
  currentTools: 'Spreadsheets and WhatsApp',
  message: 'Timesheets.',
  consent: true,
  honeypot: '',
  source: 'linkedin',
  campaign: 'launch',
  referrer: 'https://www.linkedin.com/',
  pagePath: '/register-interest',
  userAgent: 'test',
}

test('a valid registration lowercases the email and stays inside the public field list', () => {
  const result = buildInterestDraft(base)
  assert.equal(result.ok, true)
  if (!result.ok || result.silent) return
  assert.equal(result.draft.email, 'ada@example.com')
  assert.equal(result.draft.status, 'new')
  assert.equal(result.draft.consent, true)
  const keys = [...Object.keys(result.draft), 'createdAt'].sort()
  assert.deepEqual(keys, [...INTEREST_CREATE_FIELDS].sort())
})

test('an empty form reports the five required fields', () => {
  const result = buildInterestDraft({
    ...base,
    firstName: ' ',
    lastName: '',
    company: '',
    email: 'not-an-email',
    consent: false,
  })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(Object.keys(result.errors).sort(), ['company', 'consent', 'email', 'firstName', 'lastName'])
})

test('a filled honeypot looks successful and produces no draft', () => {
  const result = buildInterestDraft({ ...base, honeypot: 'https://spam.example' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.silent, true)
})

test('the message is capped so the rules accept it', () => {
  const result = buildInterestDraft({ ...base, message: 'x'.repeat(5000) })
  assert.equal(result.ok, true)
  if (!result.ok || result.silent) return
  assert.equal(result.draft.message.length, 2000)
})
