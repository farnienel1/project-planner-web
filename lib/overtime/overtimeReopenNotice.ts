/**
 * Rulebook 1.33.0 §25 (owner 6 Nov, reopen): when a manager or admin changes or deletes a PAYE person's booking, the
 * overtime line it carried reopens on the person's page and the cycle starts again for it. This file only reads what
 * the editor may read and sends the notices; the rules are `overtimeLineReopened`, `overtimeReopenedRecipients` and
 * `overtimeReopenedMessage`. Best effort: a failure never blocks the booking edit.
 */
import { collection, getDocs, query, where } from 'firebase/firestore'
import {
  OVERTIME_REQUEST_REVIEWED_TYPE,
  OVERTIME_REQUEST_SUBMITTED_TYPE,
  notificationRecipientAccountId,
  overtimeLineReopened,
  overtimeReopenedMessage,
  overtimeReopenedRecipients,
  parseOvertimeRequestDocument,
  parseOvertimeReviewDocument,
  type OvertimeBookingInput,
  type OvertimeOrganization,
  type OvertimeRequestRecord,
  type OvertimeReviewRecord,
} from '@/lib/canonical'
import { auth, db } from '@/lib/firebase/config'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { User } from '@/types'

async function readOrNull<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work()
  } catch {
    // The editor may not read another person's overtime (only admins, the person and their line manager may).
    return null
  }
}

export async function notifyOvertimeLineReopened(input: {
  organizationId: string
  before: OvertimeBookingInput
  /** Null when the booking was deleted. */
  after: OvertimeBookingInput | null
  organization: OvertimeOrganization
  timeZone: string
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
}): Promise<void> {
  if (!db) return
  const roster = rulebookRoster(input.users)
  const catalogue = input.operatives.map((row) => ({ id: row.id, email: row.email ?? null }))
  const accountId = notificationRecipientAccountId(input.before.personId, roster, catalogue as never)
  if (!accountId) return
  const person = input.users.find((row) => row.id === accountId)
  if (!person || String(person.employmentType ?? '').toLowerCase() !== 'paye') return
  const orgId = input.organizationId
  const reviews = await readOrNull<OvertimeReviewRecord[]>(async () => {
    const snap = await getDocs(query(collection(db, 'organizations', orgId, 'overtimeReviews'), where('userId', '==', accountId)))
    return snap.docs.map((row) => parseOvertimeReviewDocument(row.id, row.data()))
  })
  const requests = await readOrNull<OvertimeRequestRecord[]>(async () => {
    const snap = await getDocs(query(collection(db, 'organizations', orgId, 'overtimeRequests'), where('userId', '==', accountId)))
    return snap.docs.map((row) => parseOvertimeRequestDocument(row.id, row.data()))
  })
  const outcome = overtimeLineReopened({
    before: input.before,
    after: input.after,
    organization: input.organization,
    timeZone: input.timeZone,
    reviews,
    requests,
  })
  if (!outcome.reopened) return
  const actorId = auth?.currentUser?.uid || ''
  const actor = actorId ? rulebookPerson(input.users.find((row) => row.id === actorId) || ({ id: actorId } as User), input.users) : null
  const recipients = overtimeReopenedRecipients({
    bookedId: input.before.personId,
    actor,
    roster,
    operatives: catalogue,
    returned: outcome.returned,
  })
  const personName = [person.firstName, person.surname].filter(Boolean).join(' ') || person.email || null
  await Promise.all(
    recipients.map((userId) => {
      const forPerson = userId === accountId
      const notice = overtimeReopenedMessage({ dayKey: input.before.dayKey, jobNumber: input.before.jobNumber, forLineManager: !forPerson, personName })
      return saveInboxNotification({
        organizationId: orgId,
        // Existing types (no new push type): the person's Overtime, or Users' → that person → Overtime.
        type: forPerson ? OVERTIME_REQUEST_REVIEWED_TYPE : OVERTIME_REQUEST_SUBMITTED_TYPE,
        title: notice.title,
        message: notice.message,
        userId,
        relatedId: input.before.id,
        deepLinkUserId: forPerson ? null : accountId,
        dayKey: input.before.dayKey,
      }).catch(() => undefined)
    })
  )
}
