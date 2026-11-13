/**
 * Settings → My notifications → "Send test notification" (rulebook §13 `push_test`).
 * One inbox row to the signed-in user only (`pushTestRecipients`); its push is the one type that reaches the
 * person who caused it (`notificationPushesToActor`), so it lands on every phone signed in to this account.
 * The row is written through `saveInboxNotification` → `notificationCreateFields` (server-time `createdAt`).
 */

import { PUSH_TEST_NOTICE_TYPE, pushTestRecipients } from '@/lib/canonical'
import type { saveInboxNotification } from '@/lib/firebase/notifyInbox'

export const PUSH_TEST_TITLE = 'Test notification'
export const PUSH_TEST_MESSAGE = 'If you can read this on your phone, notifications are working.'
export const PUSH_TEST_SENT_MESSAGE = 'Sent — check your phone in a minute.'

export type PushTestWrite = (input: Parameters<typeof saveInboxNotification>[0]) => Promise<void>

/** Writes the push_test row; returns how many rows were written (0 when nobody is signed in). */
export async function sendPushTestToSelf(
  params: { organizationId: string; userId: string },
  write?: PushTestWrite
): Promise<number> {
  const organizationId = String(params.organizationId || '').trim()
  if (!organizationId) throw new Error('Open an organisation first.')
  const send: PushTestWrite = write ?? (await import('@/lib/firebase/notifyInbox')).saveInboxNotification
  const recipients = pushTestRecipients(String(params.userId || '').trim() || null)
  for (const userId of recipients) {
    await send({
      organizationId,
      type: PUSH_TEST_NOTICE_TYPE,
      title: PUSH_TEST_TITLE,
      message: PUSH_TEST_MESSAGE,
      userId,
    })
  }
  return recipients.length
}
