import assert from 'node:assert/strict'
import test from 'node:test'
import { interestCreateBody } from './adminStore.ts'
import { INTEREST_INBOX } from './inbox.ts'
import { buildInterestDraft } from './registration.ts'

test('register interest mail goes to info@projectplanner.us', () => {
  assert.equal(INTEREST_INBOX, 'info@projectplanner.us')
})

test('a saved registration stores sectors as a list and the time as a timestamp', () => {
  const built = buildInterestDraft({
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Analytical Engines',
    email: 'ada@example.com',
    phone: '',
    role: 'Owner / Director',
    teamSize: '6–15',
    sectors: ['CAT A'],
    currentTools: '',
    message: '',
    consent: true,
    honeypot: '',
    source: 'direct',
    campaign: '',
    referrer: '',
    pagePath: '/register-interest',
    userAgent: 'test',
  })
  assert.equal(built.ok, true)
  if (!built.ok || built.silent) return
  const createdAt = new Date('2026-10-01T12:00:00.000Z')
  const { fields } = interestCreateBody(built.draft, createdAt)
  assert.equal((fields.email as { stringValue: string }).stringValue, 'ada@example.com')
  assert.equal((fields.status as { stringValue: string }).stringValue, 'new')
  assert.equal((fields.consent as { booleanValue: boolean }).booleanValue, true)
  assert.deepEqual((fields.sectors as { arrayValue: { values: { stringValue: string }[] } }).arrayValue.values, [
    { stringValue: 'CAT A' },
  ])
  assert.equal((fields.createdAt as { timestampValue: string }).timestampValue, createdAt.toISOString())
  assert.equal('notes' in fields, false)
  assert.equal('updatedAt' in fields, false)
})
