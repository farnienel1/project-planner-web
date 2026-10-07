import { verifyFirebaseIdToken } from '@/lib/security/apiGuard'
import { isValidEmail } from '@/lib/security/validation'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import {
  credentialFailureStatus,
  recordCredentialFailure,
  tooManyAttemptsMessage,
} from '@/lib/auth/credentialRateLimit'
import {
  identityConfirmPasswordReset,
  identitySendPasswordReset,
  identitySignInWithPassword,
  identitySignUp,
  identityUpdatePassword,
  type IdentityResult,
} from '@/lib/auth/identityToolkit'
import { existingPasswordAllowedForSignIn, validateNewPassword } from '@/lib/auth/passwordPolicy'
import { mintWebSession } from '@/lib/auth/webSession'

export const SIGN_IN_FAILED = 'Sign in failed. Please check your email/password and try again.'

export type AuthActionResult = {
  status: number
  body: Record<string, unknown>
  cookie?: { value: string; maxAgeSec: number } | null
  clearCookie?: boolean
}

type Failure = { ok: false; code: string }

export type AuthDeps = {
  now: () => number
  signInWithPassword: (email: string, password: string) => Promise<IdentityResult>
  signUp: (email: string, password: string) => Promise<IdentityResult>
  sendReset: (email: string, continueUrl: string) => Promise<{ ok: true } | Failure>
  confirmReset: (oobCode: string, newPassword: string) => Promise<{ ok: true } | Failure>
  updatePassword: (idToken: string, newPassword: string) => Promise<{ ok: true } | Failure>
  lookupIdToken: (idToken: string) => Promise<{ uid: string; email: string | null; emailVerified: boolean } | null>
  mintSession: (input: { idToken: string; uid: string; email: string | null; emailVerified: boolean }) => Promise<{ value: string; maxAgeSec: number } | null>
  breachLookup?: (prefix: string) => Promise<string>
}

function defaultDeps(): AuthDeps {
  return {
    now: () => Date.now(),
    signInWithPassword: identitySignInWithPassword,
    signUp: identitySignUp,
    sendReset: identitySendPasswordReset,
    confirmReset: identityConfirmPasswordReset,
    updatePassword: identityUpdatePassword,
    lookupIdToken: verifyFirebaseIdToken,
    mintSession: mintWebSession,
  }
}

function blocked(status: { ok: false; retryAfterSec: number }): AuthActionResult {
  return {
    status: 429,
    body: {
      error: tooManyAttemptsMessage(status.retryAfterSec),
      code: 'auth/too-many-requests',
      retryAfterSec: status.retryAfterSec,
    },
  }
}

function invalidCredential(): AuthActionResult {
  return { status: 401, body: { error: SIGN_IN_FAILED, code: 'auth/invalid-credential' } }
}

export async function handleEmailSignIn(
  input: { email: string; password: string; ip: string },
  deps: AuthDeps = defaultDeps()
): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase()
  const password = input.password
  if (!isValidEmail(email) || !password) {
    return { status: 400, body: { error: 'Enter the email and password for this account.', code: 'auth/invalid-email' } }
  }
  // Existing passwords are not scored. Test accounts and older passwords still sign in.
  existingPasswordAllowedForSignIn(password)
  const now = deps.now()
  const gate = credentialFailureStatus('sign-in', input.ip, email, now)
  if (!gate.ok) return blocked(gate)
  let identity: IdentityResult
  try {
    identity = await deps.signInWithPassword(email, password)
  } catch {
    return { status: 503, body: { error: 'Sign in is unavailable right now. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  if (!identity.ok) {
    recordCredentialFailure('sign-in', input.ip, email, now)
    if (identity.code.includes('TOO_MANY_ATTEMPTS')) {
      return blocked({ ok: false, retryAfterSec: 15 * 60 })
    }
    return invalidCredential()
  }
  const cookie = await deps.mintSession({
    idToken: identity.idToken,
    uid: identity.localId,
    email: identity.email || email,
    emailVerified: false,
  }).catch(() => null)
  return { status: 200, body: { ok: true }, cookie }
}

export async function handleEmailSignUp(
  input: { email: string; password: string; ip: string },
  deps: AuthDeps = defaultDeps()
): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase()
  const password = input.password
  if (!isValidEmail(email)) return { status: 400, body: { error: 'Enter a valid email address.', code: 'auth/invalid-email' } }
  const policy = await validateNewPassword(password, deps.breachLookup)
  if (!policy.ok) return { status: 400, body: { error: policy.message, code: 'auth/weak-password' } }
  const now = deps.now()
  const gate = credentialFailureStatus('sign-up', input.ip, email, now)
  if (!gate.ok) return blocked(gate)
  let identity: IdentityResult
  try {
    identity = await deps.signUp(email, password)
  } catch {
    return { status: 503, body: { error: 'Account creation is unavailable right now. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  if (!identity.ok) {
    if (identity.code.includes('EMAIL_EXISTS')) {
      return { status: 409, body: { error: 'This email is already in use.', code: 'auth/email-already-in-use' } }
    }
    recordCredentialFailure('sign-up', input.ip, email, now)
    return { status: 400, body: { error: 'Could not create that login. Check the email and password.', code: 'auth/weak-password' } }
  }
  const cookie = await deps.mintSession({
    idToken: identity.idToken,
    uid: identity.localId,
    email: identity.email || email,
    emailVerified: false,
  }).catch(() => null)
  return { status: 200, body: { ok: true }, cookie }
}

export async function handlePasswordReset(
  input: { email: string; ip: string },
  deps: AuthDeps = defaultDeps()
): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase()
  if (!isValidEmail(email)) return { status: 400, body: { error: 'Enter a valid email address.', code: 'auth/invalid-email' } }
  const now = deps.now()
  const gate = credentialFailureStatus('password-reset', input.ip, email, now)
  if (!gate.ok) return blocked(gate)
  recordCredentialFailure('password-reset', input.ip, email, now)
  try {
    const sent = await deps.sendReset(email, passwordResetActionSettings(email).url)
    if (!sent.ok && !sent.code.includes('EMAIL_NOT_FOUND')) {
      return { status: 400, body: { error: 'Could not send a reset email. Try again shortly.', code: 'auth/internal-error' } }
    }
  } catch {
    return { status: 503, body: { error: 'Could not send a reset email. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  return { status: 200, body: { ok: true } }
}

export async function handlePasswordConfirm(
  input: { oobCode: string; newPassword: string; ip: string },
  deps: AuthDeps = defaultDeps()
): Promise<AuthActionResult> {
  const oobCode = input.oobCode.trim()
  if (!oobCode) {
    return { status: 400, body: { error: 'This reset link is missing its code. Request a new password reset from the sign-in page.', code: 'auth/invalid-action-code' } }
  }
  const policy = await validateNewPassword(input.newPassword, deps.breachLookup)
  if (!policy.ok) return { status: 400, body: { error: policy.message, code: 'auth/weak-password' } }
  const now = deps.now()
  const account = oobCode.slice(0, 12)
  const gate = credentialFailureStatus('password-confirm', input.ip, account, now)
  if (!gate.ok) return blocked(gate)
  let confirmed: { ok: true } | Failure
  try {
    confirmed = await deps.confirmReset(oobCode, input.newPassword)
  } catch {
    return { status: 503, body: { error: 'Could not update the password. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  if (!confirmed.ok) {
    recordCredentialFailure('password-confirm', input.ip, account, now)
    return {
      status: 400,
      body: {
        error: 'This reset link is invalid or has already been used. Request a new one from the sign-in page.',
        code: 'auth/invalid-action-code',
      },
    }
  }
  return { status: 200, body: { ok: true } }
}

export async function handlePasswordChange(
  input: { idToken: string; currentPassword: string; nextPassword: string; ip: string },
  deps: AuthDeps = defaultDeps()
): Promise<AuthActionResult> {
  const policy = await validateNewPassword(input.nextPassword, deps.breachLookup)
  if (!policy.ok) return { status: 400, body: { error: policy.message, code: 'auth/weak-password' } }
  const user = await deps.lookupIdToken(input.idToken)
  if (!user?.email) return { status: 401, body: { error: 'Sign in required', code: 'auth/requires-recent-login' } }
  const now = deps.now()
  const account = user.email
  const gate = credentialFailureStatus('password-change', input.ip, account, now)
  if (!gate.ok) return blocked(gate)
  if (!input.currentPassword) {
    return { status: 400, body: { error: 'Enter your current password.', code: 'auth/missing-password' } }
  }
  existingPasswordAllowedForSignIn(input.currentPassword)
  let current: IdentityResult
  try {
    current = await deps.signInWithPassword(user.email, input.currentPassword)
  } catch {
    return { status: 503, body: { error: 'Could not change the password. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  if (!current.ok) {
    recordCredentialFailure('password-change', input.ip, account, now)
    return { status: 401, body: { error: 'The current password is wrong.', code: 'auth/wrong-password' } }
  }
  let updated: { ok: true } | Failure
  try {
    updated = await deps.updatePassword(input.idToken, input.nextPassword)
  } catch {
    return { status: 503, body: { error: 'Could not change the password. Try again shortly.', code: 'auth/network-request-failed' } }
  }
  if (!updated.ok) {
    recordCredentialFailure('password-change', input.ip, account, now)
    return { status: 400, body: { error: 'Could not change the password.', code: 'auth/weak-password' } }
  }
  return { status: 200, body: { ok: true } }
}
