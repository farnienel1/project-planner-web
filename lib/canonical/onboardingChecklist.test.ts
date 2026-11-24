import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onboardingCardVisible, onboardingChecklist, onboardingDismissWriteFields, onboardingDismissed } from './onboardingChecklist'

const fullOrg = {
  name: 'Acme',
  officeAddressLine1: '1 High St',
  companyLogoURL: 'https://x/logo.png',
  payrollTimePolicy: { standardDayStart: '07:30' },
  invoicing: { paymentRunMode: 'date_ranges', payePaydayHistory: [{ day: 25, effectiveFrom: '2026-01-01' }] },
}

test('1.85.0 onboarding: a brand new company has nothing done', () => {
  const c = onboardingChecklist({ name: 'Acme' }, { people: 0, pendingInvites: 0, jobs: 0, complianceDocuments: 0 })
  assert.equal(c.progressLabel, '0 of 6 done')
  assert.equal(c.complete, false)
  assert.equal(c.ready, true)
  assert.deepEqual(c.items.map((i) => i.key), ['company', 'workingHours', 'payRuns', 'team', 'firstJob', 'accreditations'])
})

test('1.85.0 onboarding: items tick themselves off from real data; accreditations are optional', () => {
  const c = onboardingChecklist(fullOrg, { people: 0, pendingInvites: 1, jobs: 2, complianceDocuments: 0 })
  assert.equal(c.progressLabel, '5 of 6 done')
  assert.equal(c.complete, true)
  assert.equal(onboardingCardVisible({ checklist: c, viewerIsAdmin: true, org: fullOrg }), false)
  // No logo: company details open.
  const noLogo = onboardingChecklist({ ...fullOrg, companyLogoURL: '' }, { people: 3, pendingInvites: 0, jobs: 1 })
  assert.equal(noLogo.items[0].done, false)
  assert.equal(noLogo.complete, false)
  // No PAYE payday: pay runs open.
  const noPayday = onboardingChecklist({ ...fullOrg, invoicing: { paymentRunMode: 'date_ranges' } }, { people: 1, pendingInvites: 0, jobs: 1 })
  assert.equal(noPayday.items[2].done, false)
})

test('1.85.0 onboarding: not ready while counts load; admins only; hidden once dismissed', () => {
  const loading = onboardingChecklist({ name: 'Acme' }, { people: null, pendingInvites: null, jobs: null })
  assert.equal(loading.ready, false)
  assert.equal(onboardingCardVisible({ checklist: loading, viewerIsAdmin: true, org: {} }), false)
  const open = onboardingChecklist({ name: 'Acme' }, { people: 0, pendingInvites: 0, jobs: 0 })
  assert.equal(onboardingCardVisible({ checklist: open, viewerIsAdmin: true, org: {} }), true)
  assert.equal(onboardingCardVisible({ checklist: open, viewerIsAdmin: false, org: {} }), false)
  const dismissedOrg = { onboardingDismissedAt: { seconds: 1 } }
  assert.equal(onboardingDismissed(dismissedOrg), true)
  assert.equal(onboardingCardVisible({ checklist: open, viewerIsAdmin: true, org: dismissedOrg }), false)
  assert.deepEqual(onboardingDismissWriteFields('u1'), { onboardingDismissedBy: 'u1' })
  assert.equal(onboardingDismissWriteFields(''), null)
})
