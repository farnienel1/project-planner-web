/**
 * Password policy for sign-up, invite password setup, password reset and change password.
 *
 * Every account needs at least `PASSWORD_MIN_LENGTH` characters. The platform owner's developer
 * account needs `DEVELOPER_PASSWORD_MIN_LENGTH`. The caller says which account it is
 * (`developerAccount`); the rulebook does not look up who the owner is.
 */

export const PASSWORD_MIN_LENGTH = 8
export const DEVELOPER_PASSWORD_MIN_LENGTH = 10

export type PasswordPolicyOptions = {
  /** The platform owner's developer account. */
  developerAccount?: boolean | null
}

export function passwordMinLength(options?: PasswordPolicyOptions | null): number {
  return options?.developerAccount === true ? DEVELOPER_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH
}

/** Null when the password is long enough; otherwise the message to show. */
export function passwordPolicyError(password: unknown, options?: PasswordPolicyOptions | null): string | null {
  const value = typeof password === 'string' ? password : ''
  const min = passwordMinLength(options)
  if (value.length < min) return `Password must be at least ${min} characters.`
  return null
}
