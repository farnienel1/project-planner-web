// Transactional: no marketing content
import { buildAuthActionEmailHtml, buildAuthActionEmailText, type AuthActionEmailSpec } from '@/lib/email/authActionEmail'

/**
 * Email verification and confirm-new-email (owner request 17 Nov: every account email from Project Planner, one
 * look). The links are made server-side with `returnOobLink: true` (`adminEmailActionLink`), so Firebase sends no
 * email of its own. No expiry time is stated: Firebase does not document one for these codes, only that each link
 * works once.
 */

export const VERIFY_EMAIL_SUBJECT = 'Verify your Project Planner email'
export const CHANGE_EMAIL_SUBJECT = 'Confirm your new Project Planner email'
export const ACCOUNT_EMAIL_LINK_ONCE_TEXT = 'For your security, this link can only be used once.'

function verifySpec(params: { to: string; link: string }): AuthActionEmailSpec {
  return {
    to: params.to,
    link: params.link,
    subject: VERIFY_EMAIL_SUBJECT,
    preheader: 'Confirm this email address for your Project Planner login.',
    heading: 'Verify your email',
    intro: 'Confirm that this email address belongs to you.',
    body: (strongTo) => `Use the button below to verify ${strongTo} for your Project Planner login.`,
    buttonLabel: 'Verify email',
    validText: ACCOUNT_EMAIL_LINK_ONCE_TEXT,
    ignoreText: "If you didn't create a Project Planner login, you can ignore this email.",
    footerReason: 'because a Project Planner login was set up with this address.',
  }
}

function changeSpec(params: { to: string; link: string }): AuthActionEmailSpec {
  return {
    to: params.to,
    link: params.link,
    subject: CHANGE_EMAIL_SUBJECT,
    preheader: 'Confirm this address to sign in to Project Planner with it.',
    heading: 'Confirm your new email',
    intro: 'You asked to sign in to Project Planner with this email address.',
    body: (strongTo) =>
      `Use the button below to confirm ${strongTo}. Until you do, you keep signing in with your current email.`,
    buttonLabel: 'Confirm new email',
    validText: ACCOUNT_EMAIL_LINK_ONCE_TEXT,
    ignoreText: "If you didn't ask to change your login email, you can ignore this email. Nothing changes.",
    footerReason: 'because someone asked to use it as their Project Planner login email.',
  }
}

export function buildVerifyEmailHtml(params: { to: string; link: string }): string {
  return buildAuthActionEmailHtml(verifySpec(params))
}

export function buildVerifyEmailText(params: { to: string; link: string }): string {
  return buildAuthActionEmailText(verifySpec(params), `Verify ${params.to.trim()}:`)
}

export function buildChangeEmailHtml(params: { to: string; link: string }): string {
  return buildAuthActionEmailHtml(changeSpec(params))
}

export function buildChangeEmailText(params: { to: string; link: string }): string {
  return buildAuthActionEmailText(changeSpec(params), `Confirm ${params.to.trim()}:`)
}
