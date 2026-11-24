/**
 * iOS parity: NotificationService.notifyTimesheetPendingManagerSignoff /
 * notifyTimesheetSignedByManager / notifyLineManagerPeerAction
 */
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import {
  TIMESHEET_PENDING_NOTICE_TYPE,
  dayKeyInOrganizationZone,
  lineManagerPeerNoticeKey,
  TIMESHEET_REVISION_NOTICE_MESSAGE,
  TIMESHEET_REVISION_NOTICE_TITLE,
  TIMESHEET_REVISION_NOTICE_TYPE,
  TIMESHEET_SIGNED_NOTICE_TYPE,
  timesheetRevisionNoticeKey,
  timesheetRevisionToSignRecipients,
  lineManagerPeerRecipients,
  notificationDestination,
  timesheetNotificationDedupeKey,
  timesheetSignedRecipients,
  timesheetSubmittedRecipients,
  timesheetSignedNoticeText,
} from '@/lib/canonical'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { timesheetsMineHref, timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { User } from '@/types'

/** The inbox writer (tests pass a stub; the app always uses `saveInboxNotification`). */
export type InboxSave = (input: Parameters<typeof saveInboxNotification>[0]) => Promise<void>

function displayName(user: User): string {
  return `${user.firstName} ${user.surname}`.trim() || user.email
}

/** The document id for a timesheet notice: the synthetic UUID of `timesheetNotificationDedupeKey`. */
export async function timesheetNoticeId(input: {
  type: string
  subjectId: string
  weekStart: Date
  timeZone: string
  recipientId?: string
  /** Rulebook 1.55.0: REV N (0 / missing = the original) — a revision's notices are never de-duped with the original's. */
  revision?: number | null
  /** Rulebook 1.60.1: the signature instant, so a re-sign of the same pay run is its own row and push. */
  signedAt?: Date | null
}): Promise<string | null> {
  const key = timesheetNotificationDedupeKey({
    type: input.type,
    subjectId: input.subjectId,
    // Organisation-zone day of the period start (never the device calendar).
    periodStartDayKey: dayKey(input.weekStart, input.timeZone),
    timeZone: input.timeZone,
    recipientId: input.recipientId ?? null,
    revision: input.revision ?? null,
    signedAtMs: input.signedAt ? input.signedAt.getTime() : null,
  })
  return key ? syntheticUuidFromKey(key) : null
}

/**
 * `timesheet_pending_manager_signoff` when the owner signs: one row per `timesheetSubmittedRecipients(subject,
 * roster)` (active line managers, else the active admins; never the subject; none when self-signed).
 */
export async function notifyTimesheetPendingManagerSignoff({
  organizationId,
  signedByUser,
  users,
  weekStart,
  timeZone,
  revision,
  signedAt,
  save = saveInboxNotification,
}: {
  organizationId: string
  signedByUser: User
  /** The organisation roster (`users` on `organizationId`). */
  users: ReadonlyArray<User>
  weekStart: Date
  timeZone: string
  /** Rulebook 1.55.0: the sheet's revision number (REV N), so its notice is not swallowed by the original's. */
  revision?: number | null
  /**
   * Rulebook 1.60.1: the person's signature instant (`operativeSignedAt`). Each signature is its own row, so a re-sign
   * of the same pay run reaches the line manager (before, it hit the first signature's row and nothing was written).
   * Required, so a caller that drops it does not compile.
   */
  signedAt: Date | null
  save?: InboxSave
}): Promise<void> {
  const roster = rulebookRoster(users)
  const recipients = timesheetSubmittedRecipients(rulebookPerson(signedByUser, users), roster)
  const name = displayName(signedByUser)
  for (const managerId of recipients) {
    const id = await timesheetNoticeId({
      type: TIMESHEET_PENDING_NOTICE_TYPE,
      subjectId: signedByUser.id,
      weekStart,
      timeZone,
      recipientId: managerId,
      revision,
      signedAt,
    })
    if (!id) continue
    await save({
      id,
      organizationId,
      type: TIMESHEET_PENDING_NOTICE_TYPE,
      title: 'Timesheet needs sign-off',
      message: `${name} submitted a timesheet that needs your signature.`,
      userId: managerId,
      deepLinkUserId: signedByUser.id,
      deepLinkWeekStart: weekStart,
    })
  }
}

/**
 * `timesheet_signed_by_manager` to `timesheetSignedRecipients(subject, signer, roster)` (the subject unless they
 * signed), then `line_manager_peer_update` to `lineManagerPeerRecipients(subject, signer, roster)`.
 */
export async function notifyTimesheetSignedByManager({
  organizationId,
  subjectUser,
  signedByName,
  signedByUserId,
  users,
  weekStart,
  weekEnd,
  timeZone,
  revision,
  signedAt,
  changedByReviewer,
  save = saveInboxNotification,
}: {
  organizationId: string
  subjectUser: User
  signedByName: string
  signedByUserId: string
  /** The organisation roster (`users` on `organizationId`). */
  users: ReadonlyArray<User>
  weekStart: Date
  weekEnd: Date
  timeZone: string
  /** Rulebook 1.55.0: the sheet's revision number (REV N), so its notice is not swallowed by the original's. */
  revision?: number | null
  /**
   * Rulebook 1.60.1: the line manager's counter-sign instant (`managerSignedAt`). Each counter-signature is its own
   * row (and push, and peer row), so a counter-sign again after a 1.47 reopen reaches the person. Required, so a caller
   * that drops it does not compile.
   */
  signedAt: Date | null
  /**
   * Rulebook 1.74.0 (owner answer 23 Nov): the line manager changed bookings from this sheet's review
   * (`timesheetSheetChangedByReviewer`) — the person is told their timesheet was updated (`timesheetSignedNoticeText`).
   */
  changedByReviewer?: boolean
  save?: InboxSave
}): Promise<void> {
  const roster = rulebookRoster(users)
  const subject = rulebookPerson(subjectUser, users)
  const text = timesheetSignedNoticeText({ signedByName, changedByReviewer })
  const signerUser = users.find((member) => member.id === signedByUserId)
  const signer = signerUser ? rulebookPerson(signerUser, users) : signedByUserId
  for (const recipientId of timesheetSignedRecipients(subject, signer, roster)) {
    const signedId = await timesheetNoticeId({
      type: TIMESHEET_SIGNED_NOTICE_TYPE,
      subjectId: subjectUser.id,
      weekStart,
      timeZone,
      revision,
      signedAt,
    })
    if (!signedId) continue
    await save({
      id: signedId,
      organizationId,
      type: TIMESHEET_SIGNED_NOTICE_TYPE,
      title: text.title,
      message: text.message,
      userId: recipientId,
      deepLinkUserId: subjectUser.id,
      deepLinkWeekStart: weekStart,
    })
  }
  const peers = lineManagerPeerRecipients(subject, signer, roster)
  const periodLine = formatPaymentPeriodLine(weekStart, weekEnd, timeZone)
  const operativeName = displayName(subjectUser)
  for (const peerId of peers) {
    const peerKey = timesheetPeerNoticeKey({ signedByName, operativeName, periodLine, peerId, signedAt })
    if (!peerKey) continue
    const id = await syntheticUuidFromKey(peerKey)
    await save({
      id,
      organizationId,
      type: 'line_manager_peer_update',
      title: 'Line manager update',
      message: `${signedByName} signed: ${operativeName}'s timesheet (${periodLine})`,
      userId: peerId,
      deepLinkUserId: subjectUser.id,
      deepLinkWeekStart: weekStart,
    })
  }
}

/**
 * The `line_manager_peer_update` id key for a counter-signature: the rulebook's `lineManagerPeerNoticeKey` (1.60.1,
 * `|sig{ms}` with the counter-sign instant). Null without a peer id.
 */
export function timesheetPeerNoticeKey(input: {
  signedByName: string
  operativeName: string
  periodLine: string
  peerId: string
  signedAt: Date | null
}): string | null {
  return lineManagerPeerNoticeKey({
    actorName: input.signedByName,
    actionSummary: `${input.operativeName}'s timesheet (${input.periodLine})`,
    peerId: input.peerId,
    actionVerb: 'signed',
    signedAtMs: input.signedAt ? input.signedAt.getTime() : null,
  })
}

export function timesheetNotificationHref(
  row: { type: string; deepLinkUserId?: string; deepLinkWeekStart?: Date },
  timeZone?: string
): string | null {
  const dest = notificationDestination({
    type: row.type,
    dayKey: row.deepLinkWeekStart ? dayKey(row.deepLinkWeekStart, timeZone) : null,
    role: 'manager',
    deepLinkUserId: row.deepLinkUserId,
  })
  if (dest.kind === 'timesheetTeamAwaiting') {
    return timesheetsTeamHref({ tab: 'awaiting', user: dest.userId || null, period: dest.dayKey || null })
  }
  if (dest.kind === 'timesheetMine') {
    return timesheetsMineHref(dest.dayKey || null)
  }
  if (dest.kind === 'timesheetTeamSigned') {
    return timesheetsTeamHref({ tab: 'signed', user: dest.userId || null, period: dest.dayKey || null })
  }
  return null
}

/**
 * Rulebook 1.55.0 §8 / §13: `timesheet_revision_to_sign` when an admin or line manager creates a revision of the
 * person's exported timesheet ("Your timesheet has a revision to sign"). One row per revision
 * (`timesheetRevisionNoticeKey`); never the person who created it (`timesheetRevisionToSignRecipients`). When a
 * booking change made the revision due, the server already told the person, and a revision they create themself
 * notifies nobody.
 */
/**
 * The link fields of a `timesheet_revision_to_sign` row (review of iOS #243, L5): the person, the pay run's start
 * instant, and `dayKey` — the pay run's first day in the organisation zone, as §13 and the booking-change notice
 * (`functions/timesheetBookingNotice.js`) carry it — so `parseNotificationDocument` / `notificationDestination` open
 * My Timesheets on that pay run without deriving it from the instant.
 */
export function timesheetRevisionToSignLinkFields(subjectUserId: string, weekStart: Date, timeZone: string | null | undefined) {
  return {
    deepLinkUserId: subjectUserId,
    deepLinkWeekStart: weekStart,
    dayKey: dayKeyInOrganizationZone(weekStart.toISOString(), timeZone),
  }
}

export async function notifyTimesheetRevisionToSign({
  organizationId,
  subjectUser,
  actorUserId,
  users,
  revisionDocumentId,
  weekStart,
  timeZone,
}: {
  organizationId: string
  subjectUser: User
  actorUserId: string
  users: ReadonlyArray<User>
  revisionDocumentId: string
  weekStart: Date
  timeZone: string | null | undefined
}): Promise<void> {
  const key = timesheetRevisionNoticeKey(revisionDocumentId)
  if (!key) return
  const roster = rulebookRoster(users)
  const actorUser = users.find((member) => member.id === actorUserId)
  const actor = actorUser ? rulebookPerson(actorUser, users) : actorUserId
  for (const recipientId of timesheetRevisionToSignRecipients(rulebookPerson(subjectUser, users), actor, roster)) {
    await saveInboxNotification({
      id: await syntheticUuidFromKey(`${key}|${recipientId}`),
      organizationId,
      type: TIMESHEET_REVISION_NOTICE_TYPE,
      title: TIMESHEET_REVISION_NOTICE_TITLE,
      message: TIMESHEET_REVISION_NOTICE_MESSAGE,
      userId: recipientId,
      ...timesheetRevisionToSignLinkFields(subjectUser.id, weekStart, timeZone),
    })
  }
}
