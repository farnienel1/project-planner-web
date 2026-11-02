/** Shared age-confirmation copy and account-create checks. Do not collect a date of birth. */
import { passwordPolicyError } from '@/lib/canonical/passwordPolicy'

export const AGE_CONFIRMATION_LABEL = 'I confirm that I am 16 or over.'

/** Confirmed minimum age in years. Stored as a number — do not bake 16 into the field name. */
export const AGE_CONFIRMATION_YEARS = 16

export const AGE_CONFIRMATION_REQUIRED_MESSAGE = 'Confirm that you are 16 or over to continue.'

export function ageConfirmationWriteFields<T>(at: T): {
  ageConfirmed: true
  ageConfirmedAt: T
  ageConfirmedYears: number
} {
  return {
    ageConfirmed: true,
    ageConfirmedAt: at,
    ageConfirmedYears: AGE_CONFIRMATION_YEARS,
  }
}

export function validateAccountStep(input: {
  firstName: string
  surname: string
  email: string
  password: string
  confirmPassword: string
  /** True additional-org: users/{uid} already exists. Skip password and the age tick. */
  creatingAdditionalOrg: boolean
  ageConfirmed: boolean
  /**
   * Leftover Auth with no users/{uid}. Skip password (Auth already exists) but still
   * require the age tick — self-create rules need ageConfirmed / At / Years.
   */
  signedInWithoutProfile?: boolean
}): string | null {
  if (!input.firstName.trim() || !input.surname.trim()) return 'Please enter your first and last name.'
  if (!input.email.trim()) return 'Please enter your email address.'
  if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) return 'Enter a valid email address.'
  if (input.creatingAdditionalOrg) return null
  if (!input.signedInWithoutProfile) {
    const weak = passwordPolicyError(input.password)
    if (weak) return weak
    if (input.password !== input.confirmPassword) return 'Passwords do not match.'
  }
  if (!input.ageConfirmed) return AGE_CONFIRMATION_REQUIRED_MESSAGE
  return null
}

export function validateInvitePasswordSetup(input: {
  password: string
  confirmPassword: string
  ageConfirmed: boolean
}): string | null {
  const weak = passwordPolicyError(input.password)
  if (weak) return weak
  if (input.password !== input.confirmPassword) return 'Passwords do not match.'
  if (!input.ageConfirmed) return AGE_CONFIRMATION_REQUIRED_MESSAGE
  return null
}

export function invitePasswordSetupCanContinue(input: {
  password: string
  confirmPassword: string
  ageConfirmed: boolean
  hasInvitation: boolean
  submitting: boolean
}): boolean {
  return (
    input.hasInvitation &&
    !input.submitting &&
    passwordPolicyError(input.password) === null &&
    input.password === input.confirmPassword &&
    input.ageConfirmed
  )
}
