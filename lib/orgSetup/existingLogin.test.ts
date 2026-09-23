import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXISTING_LOGIN_CODE,
  ExistingProjectPlannerLoginError,
  SWITCH_ORGANISATION_PATH,
  existingLoginModalCopy,
  existingLoginResetHref,
  existingLoginSignInHref,
  isExistingProjectPlannerLoginError,
  shouldBlockPublicSetupForExistingLogin,
} from './existingLogin.ts'

test('public setup is blocked only when attaching another live organisation', () => {
  assert.equal(
    shouldBlockPublicSetupForExistingLogin({
      allowAdditionalOrganization: false,
      isAdditionalOrganization: true,
    }),
    true
  )
  assert.equal(
    shouldBlockPublicSetupForExistingLogin({
      allowAdditionalOrganization: true,
      isAdditionalOrganization: true,
    }),
    false
  )
  assert.equal(
    shouldBlockPublicSetupForExistingLogin({
      allowAdditionalOrganization: false,
      isAdditionalOrganization: false,
    }),
    false
  )
})

test('existing-login error is detectable by class and code', () => {
  const error = new ExistingProjectPlannerLoginError({ signedIn: true, isAdmin: true })
  assert.equal(error.code, EXISTING_LOGIN_CODE)
  assert.equal(isExistingProjectPlannerLoginError(error), true)
  assert.equal(isExistingProjectPlannerLoginError({ code: EXISTING_LOGIN_CODE }), true)
  assert.equal(isExistingProjectPlannerLoginError({ code: 'auth/email-already-in-use' }), false)
})

test('sign-in and reset links carry the email and switch-organisation destination', () => {
  assert.equal(
    existingLoginSignInHref('Owner@Firm.com'),
    `/login?email=Owner%40Firm.com&next=${encodeURIComponent(SWITCH_ORGANISATION_PATH)}`
  )
  assert.equal(existingLoginResetHref('Owner@Firm.com'), '/reset-password?email=Owner%40Firm.com')
  assert.equal(existingLoginResetHref(''), '/reset-password')
})

test('modal copy for an existing admin points at Switch organisation, not a second password', () => {
  const copy = existingLoginModalCopy({ email: 'a@b.com', signedIn: false, isAdmin: true })
  assert.equal(copy.title, 'You already have a Project Planner login')
  assert.match(copy.paragraphs[0] || '', /already set up an organisation/i)
  assert.match(copy.paragraphs.join(' '), /do not create a second password/i)
  assert.match(copy.paragraphs.join(' '), /Switch organisation/)
  assert.match(copy.paragraphs.join(' '), /last switched/i)
  assert.equal(copy.primaryLabel, 'Sign in')
  assert.equal(copy.secondaryLabel, 'Forgot password')
})

test('signed-in modal uses Switch organisation as the primary action', () => {
  const copy = existingLoginModalCopy({ email: 'a@b.com', signedIn: true, isAdmin: false })
  assert.equal(copy.primaryLabel, 'Switch organisation')
  assert.equal(copy.primaryHref, SWITCH_ORGANISATION_PATH)
  assert.equal(copy.secondaryLabel, null)
  assert.doesNotMatch(copy.paragraphs.join(' '), /already set up an organisation/)
})
