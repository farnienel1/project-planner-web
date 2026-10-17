import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAppUserDocument } from '../ios-parity/converters.ts'
import {
  AGE_CONFIRMATION_LABEL,
  AGE_CONFIRMATION_REQUIRED_MESSAGE,
  AGE_CONFIRMATION_YEARS,
  ageConfirmationWriteFields,
  invitePasswordSetupCanContinue,
  validateAccountStep,
  validateInvitePasswordSetup,
} from './ageConfirmation.ts'

const readyAccount = {
  firstName: 'Ada',
  surname: 'Lovelace',
  email: 'ada@example.com',
  password: 'longenough',
  confirmPassword: 'longenough',
  creatingAdditionalOrg: false,
  ageConfirmed: true,
}

test('account step refuses a first-time founder without the age tick', () => {
  assert.equal(validateAccountStep({ ...readyAccount, ageConfirmed: false }), AGE_CONFIRMATION_REQUIRED_MESSAGE)
  assert.equal(validateAccountStep(readyAccount), null)
})

test('account step skips the age tick when adding another company', () => {
  assert.equal(
    validateAccountStep({
      ...readyAccount,
      creatingAdditionalOrg: true,
      password: '',
      confirmPassword: '',
      ageConfirmed: false,
    }),
    null
  )
})

test('signed-in leftover Auth with no profile still requires the age tick', () => {
  const leftover = {
    ...readyAccount,
    password: '',
    confirmPassword: '',
    signedInWithoutProfile: true,
  }
  assert.equal(validateAccountStep({ ...leftover, ageConfirmed: false }), AGE_CONFIRMATION_REQUIRED_MESSAGE)
  assert.equal(validateAccountStep({ ...leftover, ageConfirmed: true }), null)
})

test('signed-in leftover Auth is not treated as an additional organisation', () => {
  assert.equal(
    validateAccountStep({
      ...readyAccount,
      creatingAdditionalOrg: false,
      signedInWithoutProfile: true,
      password: '',
      confirmPassword: '',
      ageConfirmed: false,
    }),
    AGE_CONFIRMATION_REQUIRED_MESSAGE
  )
})

test('account step still checks name and email before the age tick', () => {
  assert.equal(
    validateAccountStep({ ...readyAccount, firstName: '', ageConfirmed: false }),
    'Please enter your first and last name.'
  )
  assert.equal(
    validateAccountStep({ ...readyAccount, email: 'not-an-email', ageConfirmed: false }),
    'Enter a valid email address.'
  )
})

test('invite password setup cannot continue without the age tick', () => {
  assert.equal(
    validateInvitePasswordSetup({
      password: 'longenough',
      confirmPassword: 'longenough',
      ageConfirmed: false,
    }),
    AGE_CONFIRMATION_REQUIRED_MESSAGE
  )
  assert.equal(
    validateInvitePasswordSetup({
      password: 'longenough',
      confirmPassword: 'longenough',
      ageConfirmed: true,
    }),
    null
  )
  assert.equal(
    invitePasswordSetupCanContinue({
      password: 'longenough',
      confirmPassword: 'longenough',
      ageConfirmed: false,
      hasInvitation: true,
      submitting: false,
    }),
    false
  )
  assert.equal(
    invitePasswordSetupCanContinue({
      password: 'longenough',
      confirmPassword: 'longenough',
      ageConfirmed: true,
      hasInvitation: true,
      submitting: false,
    }),
    true
  )
})

test('age write fields use a boolean, a timestamp slot, and years as a number', () => {
  const at = { seconds: 1, nanoseconds: 0 }
  assert.deepEqual(ageConfirmationWriteFields(at), {
    ageConfirmed: true,
    ageConfirmedAt: at,
    ageConfirmedYears: AGE_CONFIRMATION_YEARS,
  })
  assert.equal(AGE_CONFIRMATION_YEARS, 16)
  assert.equal(AGE_CONFIRMATION_LABEL, 'I confirm that I am 16 or over.')
})

test('age confirmation is create-time only; existing profiles load without those fields', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
  assert.match(rules, /allow get: if canReadUserDocument\(userId\);/)
  assert.equal(rules.includes('allow get: if selfCreateHasAgeConfirmation'), false)
  assert.equal(rules.includes('allow update: if selfCreateHasAgeConfirmation'), false)
  assert.match(
    rules,
    /allow create: if request\.auth != null &&\s+request\.resource\.data\.members\[request\.auth\.uid\] == 'admin';/
  )
  assert.match(rules, /isOrgBootstrapAdminProfileCreate\(userId\) && selfCreateHasAgeConfirmation\(\)/)
  const userProfile = readFileSync(new URL('../canonical/userProfile.ts', import.meta.url), 'utf8')
  const documentFieldsBlock = userProfile.slice(
    userProfile.indexOf('export const USER_DOCUMENT_FIELDS'),
    userProfile.indexOf('export const USER_SELF_CREATE_AGE_FIELDS')
  )
  assert.equal(documentFieldsBlock.includes("'ageConfirmed'"), false)
  assert.match(userProfile, /userCreateRequiresAgeConfirmation/)
  const parsed = parseAppUserDocument('existing-uid', {
    email: 'existing@site.com',
    organizationId: 'org',
    firstName: 'Ex',
    surname: 'Isting',
  })
  assert.equal(parsed.ok, true)
})

test('founder Activate setDoc and invite accept write the age fields; invite placeholder create does not', () => {
  const founder = readFileSync(new URL('../orgSetup/createOrganization.ts', import.meta.url), 'utf8')
  const inviteAccept = readFileSync(new URL('../invites/completeInviteSetup.ts', import.meta.url), 'utf8')
  const inviteCreate = readFileSync(new URL('../orgSetup/inviteUserCore.ts', import.meta.url), 'utf8')
  const mergePlaceholder = readFileSync(new URL('../firebase/mergePlaceholderUser.ts', import.meta.url), 'utf8')
  const createBranch = founder.indexOf('} else if (!existingUser)')
  const ageWrite = founder.indexOf('ageConfirmationWriteFields', createBranch)
  const updateBranch = founder.indexOf('if (existingUser && switchActive)')
  assert.ok(createBranch > 0)
  assert.ok(ageWrite > createBranch)
  assert.ok(updateBranch > 0 && updateBranch < createBranch)
  assert.equal(founder.slice(updateBranch, createBranch).includes('ageConfirmationWriteFields'), false)
  assert.match(inviteAccept, /ageConfirmationWriteFields/)
  assert.match(mergePlaceholder, /ageConfirmationWriteFields/)
  assert.equal(inviteCreate.includes('ageConfirmed'), false)
})

test('setup wizard puts the tick above LegalLinks and skips it only when a profile already exists', () => {
  const wizard = readFileSync(new URL('../../components/setup/OrgSetupWizard.tsx', import.meta.url), 'utf8')
  const ageIndex = wizard.indexOf('id="age-confirmation"')
  const legalIndex = wizard.indexOf('<LegalLinks />')
  assert.ok(ageIndex > 0)
  assert.ok(legalIndex > ageIndex)
  assert.match(wizard, /const creatingAdditionalOrg = Boolean\(signedInUser\)/)
  assert.match(wizard, /signedInWithoutProfile/)
  assert.doesNotMatch(wizard, /const creatingAdditionalOrg = Boolean\(firebaseUser\)/)
  assert.match(wizard, /!creatingAdditionalOrg \? \([\s\S]*id="age-confirmation"/)
  assert.match(wizard, /validateAccountStep\(/)
  assert.match(wizard, /signedInWithoutProfile,/)
})

test('invite password screen has the tick between confirm and continue, plus LegalLinks', () => {
  const screen = readFileSync(new URL('../../app/setup-password/SetupPasswordClient.tsx', import.meta.url), 'utf8')
  const confirmIndex = screen.indexOf('Confirm password')
  const ageIndex = screen.indexOf('id="age-confirmation"')
  const continueIndex = screen.indexOf("submitting ? 'Saving…' : 'Continue'")
  assert.ok(confirmIndex > 0)
  assert.ok(ageIndex > confirmIndex)
  assert.ok(continueIndex > ageIndex)
  assert.match(screen, /LegalLinks/)
  assert.match(screen, /validateInvitePasswordSetup/)
})
