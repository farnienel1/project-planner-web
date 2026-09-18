import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTeamOnboarding,
  shouldShowTeamOnboarding,
  teamOnboardingAfterGuideShown,
} from './teamOnboarding.ts'

test('new orgs with pending_add_users show the team prompt for admins', () => {
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users', addUsersGuideShown: false })
  assert.equal(shouldShowTeamOnboarding(onboarding, true), true)
  assert.equal(shouldShowTeamOnboarding(onboarding, false), false)
})

test('dismissing the prompt marks it complete so it does not block the home page', () => {
  const onboarding = parseTeamOnboarding({ status: 'pending_add_users' })
  assert.ok(onboarding)
  const dismissed = teamOnboardingAfterGuideShown(onboarding)
  assert.equal(dismissed.status, 'complete')
  assert.equal(dismissed.addUsersGuideShown, true)
  assert.equal(shouldShowTeamOnboarding(dismissed, true), false)
})
