// Transactional: security notices about the account's passkeys (web passkey sign-in). No marketing content.
import { emailBrand, emailDocument, emailHeading, emailLink, emailStrong, emailText } from '@/lib/email/emailTheme'
import { organizationTimeZone } from '@/lib/canonical/organizationTimeZone'
import { escapeHtml } from '@/lib/security/htmlEscape'

export const PASSKEY_ADDED_EMAIL_SUBJECT = 'A passkey was added to your Project Planner account'
export const PASSKEYS_REMOVED_EMAIL_SUBJECT = 'Your Project Planner passkeys were removed'
export const PASSKEY_SETTINGS_PATH = '/dashboard/settings/password'

/**
 * The time in the email. The server does not know which organisation the reader works in, so it uses the default
 * business zone (`organizationTimeZone()`, Europe/London) and names it.
 */
export function passkeyNoticeTimeText(atMs: number, timeZone = organizationTimeZone(null)): string {
  const text = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(atMs)
  return `${text} (${timeZone})`
}

function settingsLink(appBaseUrl: string): string {
  return emailLink(escapeHtml(`${appBaseUrl.replace(/\/+$/, '')}${PASSKEY_SETTINGS_PATH}`), escapeHtml('Settings → Sign-in & password'))
}

export function buildPasskeyAddedEmail(input: { email: string; label: string; atMs: number; appBaseUrl: string }): { subject: string; html: string; text: string } {
  const when = passkeyNoticeTimeText(input.atMs)
  const label = input.label || 'Passkey'
  const html = emailDocument({
    title: PASSKEY_ADDED_EMAIL_SUBJECT,
    maxWidth: 560,
    preheader: `A passkey (${label}) was added to ${input.email}.`,
    body: [
      emailBrand(),
      emailHeading('A passkey was added'),
      emailText(`A passkey was added to the Project Planner account ${emailStrong(escapeHtml(input.email), 'ink')}.`),
      emailText(`Device: ${emailStrong(escapeHtml(label), 'ink')}<br>When: ${escapeHtml(when)}`),
      emailText(
        `If this wasn't you, remove it in ${settingsLink(input.appBaseUrl)} and change your password. Changing your password also removes every passkey.`
      ),
      emailText('You can keep signing in with your email and password as before.', 'muted', 'margin:0;'),
    ].join('\n'),
  })
  const text = [
    `A passkey was added to the Project Planner account ${input.email}.`,
    `Device: ${label}`,
    `When: ${when}`,
    `If this wasn't you, remove it in Settings → Sign-in & password (${input.appBaseUrl.replace(/\/+$/, '')}${PASSKEY_SETTINGS_PATH}) and change your password. Changing your password also removes every passkey.`,
  ].join('\n')
  return { subject: PASSKEY_ADDED_EMAIL_SUBJECT, html, text }
}

export function buildPasskeysRemovedEmail(input: { email: string; count: number; atMs: number; appBaseUrl: string }): { subject: string; html: string; text: string } {
  const when = passkeyNoticeTimeText(input.atMs)
  const what = input.count === 1 ? '1 passkey was' : `${input.count} passkeys were`
  const html = emailDocument({
    title: PASSKEYS_REMOVED_EMAIL_SUBJECT,
    maxWidth: 560,
    preheader: 'Your passkeys were removed — add them again after signing in.',
    body: [
      emailBrand(),
      emailHeading('Your passkeys were removed'),
      emailText(
        `The password of ${emailStrong(escapeHtml(input.email), 'ink')} was changed (${escapeHtml(when)}), so ${what} removed from the account.`
      ),
      emailText(`Your passkeys were removed — add them again after signing in, in ${settingsLink(input.appBaseUrl)}.`),
      emailText("If you didn't change your password, reset it now from the sign-in page and contact your administrator.", 'muted', 'margin:0;'),
    ].join('\n'),
  })
  const text = [
    `The password of ${input.email} was changed (${when}), so ${what} removed from the account.`,
    'Your passkeys were removed — add them again after signing in, in Settings → Sign-in & password.',
    "If you didn't change your password, reset it now from the sign-in page and contact your administrator.",
  ].join('\n')
  return { subject: PASSKEYS_REMOVED_EMAIL_SUBJECT, html, text }
}
