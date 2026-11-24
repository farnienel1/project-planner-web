import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultOrgSetupSettings } from '@/lib/orgSetup/orgSetupSettings'
import { setupOnboardingChecklist } from '@/lib/orgSetup/onboardingPreview'

test('1.85.0 setup wizard: the Getting started list from the draft', () => {
  const settings = createDefaultOrgSetupSettings()
  const list = setupOnboardingChecklist({ settings, organizationName: 'Acme', guidedProjectName: '' })
  assert.equal(list.total, 6)
  assert.equal(list.items.find((i) => i.key === 'workingHours')?.done, true)
  assert.equal(list.items.find((i) => i.key === 'team')?.done, false)
  assert.equal(list.items.find((i) => i.key === 'firstJob')?.done, false)
  const withJob = setupOnboardingChecklist({ settings, organizationName: 'Acme', guidedProjectName: 'Station Road' })
  assert.equal(withJob.items.find((i) => i.key === 'firstJob')?.done, true)
})
