/**
 * iOS parity: NotificationService.notifyTimesheetPendingManagerSignoff /
 * notifyTimesheetSignedByManager / notifyLineManagerPeerAction
 */
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { notificationDestination } from '@/lib/canonical'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { dayKey, unixStartOfDay } from '@/lib/ios-parity/londonTime'
import { timesheetsMineHref, timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import { lineManagerUserIds, requiresLineManagerCounterSign } from '@/lib/timesheets/timesheetApprovalPolicy'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'
import type { User } from '@/types'

function displayName(user: User): string {
  return `${user.firstName} ${user.surname}`.trim() || user.email
}

export async function notifyTimesheetPendingManagerSignoff({
  organizationId,
  signedByUser,
  weekStart,
  timeZone,
}: {
  organizationId: string
  signedByUser: User
  weekStart: Date
  timeZone: string
}): Promise<void> {
  if (!requiresLineManagerCounterSign(signedByUser)) return
  const stamp = unixStartOfDay(weekStart, timeZone)
  const name = displayName(signedByUser)
  for (const managerId of lineManagerUserIds(signedByUser)) {
    const id = await syntheticUuidFromKey(`timesheetPending|${signedByUser.id}|${managerId}|${stamp}`)
    await saveInboxNotification({
      id,
      organizationId,
      type: 'timesheet_pending_manager_signoff',
      title: 'Timesheet needs sign-off',
      message: `${name} submitted a timesheet that needs your signature.`,
      userId: managerId,
      deepLinkUserId: signedByUser.id,
      deepLinkWeekStart: weekStart,
    })
  }
}

export async function notifyTimesheetSignedByManager({
  organizationId,
  subjectUser,
  signedByName,
  signedByUserId,
  weekStart,
  weekEnd,
  timeZone,
}: {
  organizationId: string
  subjectUser: User
  signedByName: string
  signedByUserId: string
  weekStart: Date
  weekEnd: Date
  timeZone: string
}): Promise<void> {
  const stamp = unixStartOfDay(weekStart, timeZone)
  const signedId = await syntheticUuidFromKey(`timesheetSigned|${subjectUser.id}|${stamp}`)
  await saveInboxNotification({
    id: signedId,
    organizationId,
    type: 'timesheet_signed_by_manager',
    title: 'Timesheet signed',
    message: `${signedByName} signed your timesheet.`,
    userId: subjectUser.id,
    deepLinkUserId: subjectUser.id,
    deepLinkWeekStart: weekStart,
  })
  const peers = lineManagerUserIds(subjectUser).filter((id) => id !== signedByUserId)
  const periodLine = formatPaymentPeriodLine(weekStart, weekEnd, timeZone)
  const operativeName = displayName(subjectUser)
  for (const peerId of peers) {
    const id = await syntheticUuidFromKey(
      `lmPeer|${signedByName}|${operativeName}'s timesheet (${periodLine})|${peerId}|signed`
    )
    await saveInboxNotification({
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
