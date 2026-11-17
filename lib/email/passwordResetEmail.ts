// Transactional: no marketing content
import { buildAuthActionEmailHtml, buildAuthActionEmailText, type AuthActionEmailSpec } from '@/lib/email/authActionEmail'

/**
 * Branded password reset email (owner request 17 Nov), in the layout of `authActionEmail.ts`, with the reset link
 * Firebase generated server-side (`adminPasswordResetLink`, `returnOobLink: true`) so Firebase sends no email of
 * its own. Firebase password reset codes are valid for one hour and can be used once.
 */

export const PASSWORD_RESET_EMAIL_SUBJECT = 'Reset your Project Planner password'
export const PASSWORD_RESET_LINK_VALID_TEXT = 'For your security, this link expires in 1 hour and can only be used once.'
export const PASSWORD_RESET_IGNORE_TEXT =
  "If you didn't ask to reset your password, you can ignore this email. Your password stays the same."

/** Who asked: the person themself (forgot password), Project Planner support (owner console), or a login email change. */
export type PasswordResetEmailReason = 'self' | 'support' | 'emailChanged'

export type PasswordResetEmailParams = {
  to: string
  link: string
  reason?: PasswordResetEmailReason
}

function introText(reason: PasswordResetEmailReason): string {
  if (reason === 'support') return 'Project Planner support has sent you a link to choose a new password.'
  if (reason === 'emailChanged') {
    return 'Your Project Planner login email was changed. Choose a password to sign in with this address.'
  }
  return 'We received a request to reset the password for your Project Planner login.'
}

function spec(params: PasswordResetEmailParams): AuthActionEmailSpec {
  return {
    to: params.to,
    link: params.link,
    subject: PASSWORD_RESET_EMAIL_SUBJECT,
    preheader: 'Choose a new password for your Project Planner login. The link expires in 1 hour.',
    heading: 'Reset your password',
    intro: introText(params.reason ?? 'self'),
    body: (strongTo) =>
      `Use the button below to choose a new password for ${strongTo}. You can then sign in on the web and in the mobile app.`,
    buttonLabel: 'Reset password',
    validText: PASSWORD_RESET_LINK_VALID_TEXT,
    ignoreText: PASSWORD_RESET_IGNORE_TEXT,
    footerReason: 'because a password reset was requested for this Project Planner login.',
  }
}

export function buildPasswordResetEmailHtml(params: PasswordResetEmailParams): string {
  return buildAuthActionEmailHtml(spec(params))
}

export function buildPasswordResetEmailText(params: PasswordResetEmailParams): string {
  return buildAuthActionEmailText(spec(params), `Choose a new password for ${params.to.trim()}:`)
}
