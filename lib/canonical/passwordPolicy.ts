/**
 * Password policy for sign-up, invite password setup, password reset and change password.
 *
 * Every account needs at least `PASSWORD_MIN_LENGTH` characters. The platform owner's developer
 * account needs `DEVELOPER_PASSWORD_MIN_LENGTH`. The caller says which account it is: `developerAccount`, or
 * the account `email`, which counts as the developer account when `isPlatformOwnerEmail` is true.
 */

export const PASSWORD_MIN_LENGTH = 8
export const DEVELOPER_PASSWORD_MIN_LENGTH = 10

/** The platform owner's developer account (the owner / developer console). */
export const PLATFORM_OWNER_EMAIL = 'info@projectplanner.us'

/** True for the platform owner's email, ignoring case and surrounding spaces. */
export function isPlatformOwnerEmail(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL
}

/**
 * Rulebook 1.12.0 (§14, §16): the platform owner is the signed-in Firebase Auth account whose token email is
 * `PLATFORM_OWNER_EMAIL` **and** verified (`email_verified`). Never a users document's `email` (anyone can write
 * their own). The security rules (`isPlatformOwner`) and the owner API routes apply the same test.
 */
export function isVerifiedPlatformOwner(token: { email?: unknown; emailVerified?: unknown } | null | undefined): boolean {
  return isPlatformOwnerEmail(token?.email) && token?.emailVerified === true
}

export type PasswordPolicyOptions = {
  /** The platform owner's developer account. */
  developerAccount?: boolean | null
  /** The account's email; the platform owner's email (`isPlatformOwnerEmail`) needs the developer minimum. */
  email?: string | null
}

export function passwordMinLength(options?: PasswordPolicyOptions | null): number {
  const developer = options?.developerAccount === true || isPlatformOwnerEmail(options?.email)
  return developer ? DEVELOPER_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH
}

/** Null when the password is long enough; otherwise the message to show. */
export function passwordPolicyError(password: unknown, options?: PasswordPolicyOptions | null): string | null {
  const value = typeof password === 'string' ? password : ''
  const min = passwordMinLength(options)
  if (value.length < min) return `Password must be at least ${min} characters.`
  return null
}
