import { getAppBaseUrl, sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { buildPasskeyAddedEmail, buildPasskeysRemovedEmail } from '@/lib/email/passkeyNoticeEmail'

/**
 * Security emails about passkeys, through the existing branded email path (the `sendEmail` function in server mode,
 * `sendProjectPlannerEmail`). Best effort: a failed email never blocks adding or removing a passkey; it is logged
 * (the reason only, never the address).
 */

type Sender = typeof sendProjectPlannerEmail

export async function sendPasskeyAddedNotice(
  input: { email: string | null | undefined; label: string; atMs?: number; idToken?: string | null },
  send: Sender = sendProjectPlannerEmail
): Promise<boolean> {
  const email = (input.email || '').trim()
  if (!email) {
    console.warn('[auth/passkey/notice] passkey added: the account has no email, no notice sent')
    return false
  }
  try {
    const message = buildPasskeyAddedEmail({ email, label: input.label, atMs: input.atMs ?? Date.now(), appBaseUrl: getAppBaseUrl() })
    await send({ to: email, subject: message.subject, html: message.html, text: message.text, idToken: input.idToken || null })
    return true
  } catch (error) {
    console.error('[auth/passkey/notice] passkey added email failed', error instanceof Error ? error.message.slice(0, 200) : String(error))
    return false
  }
}

export async function sendPasskeysRemovedNotice(
  input: { email: string | null | undefined; count: number; atMs?: number; idToken?: string | null },
  send: Sender = sendProjectPlannerEmail
): Promise<boolean> {
  const email = (input.email || '').trim()
  if (!email || input.count <= 0) return false
  try {
    const message = buildPasskeysRemovedEmail({ email, count: input.count, atMs: input.atMs ?? Date.now(), appBaseUrl: getAppBaseUrl() })
    await send({ to: email, subject: message.subject, html: message.html, text: message.text, idToken: input.idToken || null })
    return true
  } catch (error) {
    console.error('[auth/passkey/notice] passkeys removed email failed', error instanceof Error ? error.message.slice(0, 200) : String(error))
    return false
  }
}
