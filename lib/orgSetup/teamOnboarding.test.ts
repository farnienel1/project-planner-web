import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTeamOnboarding,
  shouldShowTeamOnboarding,
  shouldShowTeamOnboardingPrompt,
  teamOnboardingAfterGuideShown,
  teamOnboardingWritePayload,
  markTeamOnboardingDismissedLocally,
  resetTeamOnboardingDismissalsForTests,
} from './teamOnboarding.ts'

test('new orgs with pending_add_users show the team prompt for admins', () => {
  resetTeamOnboardingDismissalsForTests()
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users', addUsersGuideShown: false })
  assert.equal(shouldShowTeamOnboarding(onboarding, true), true)
  assert.equal(shouldShowTeamOnboarding(onboarding, false), false)
})

test('dismissing the prompt marks it complete so it does not block the home page', () => {
  resetTeamOnboardingDismissalsForTests()
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users' })
  assert.ok(onboarding)
  const dismissed = teamOnboardingAfterGuideShown(onboarding)
  assert.equal(dismissed.status, 'complete')
  assert.equal(dismissed.addUsersGuideShown, true)
  assert.equal(shouldShowTeamOnboarding(dismissed, true), false)
})

test('a local dismiss hides the prompt even if Firestore still says pending', () => {
  resetTeamOnboardingDismissalsForTests()
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users' })
  const orgId = 'org-1'
  assert.equal(shouldShowTeamOnboardingPrompt(onboarding, true, orgId), true)
  markTeamOnboardingDismissedLocally(orgId)
  assert.equal(shouldShowTeamOnboardingPrompt(onboarding, true, orgId), false)
})

test('Firestore payload has no undefined fields', () => {
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users' })
  assert.ok(onboarding)
  const payload = teamOnboardingWritePayload(onboarding)
  assert.equal(payload.status, 'complete')
  assert.equal(payload.addUsersGuideShown, true)
  assert.equal(Object.values(payload).some((value) => value === undefined), false)
})

