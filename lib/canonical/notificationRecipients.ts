/**
 * Who receives each inbox notification (rulebook §13). One rule per notification type, the same on every
 * platform, and never the person who caused it (the actor) under any of their ids.
 *
 * Every function is pure over a roster of `PersonRosterRow` rows (`id`, `email`, `isActive`, `role`,
 * `formerUserIds`, `sameEmailUserIds`, line-manager fields). Each returns the `userId`s to write one row for,
 * in a stable order, de-duplicated without case, without inactive roster members and without the actor.
 * An app writes one row per id with `actorUserId` set to the signed-in user; the push Cloud Function never
 * pushes a row addressed to its actor.
 *
 * `NOTIFICATION_CATALOG` lists every type written today with its trigger, recipient rule, push and writers.
 * Job-level notices (`material_order_placed`, variations) keep `materialOrderRecipients` /
 * `receivesJobNotification` and then run through `excludeActor`; neither has an "all admins" fallback.
 */

import { dateFromDayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import {
  canSelfBookAnnualLeave,
  leaveApproverIds,
  lineManagerIds,
  timesheetSelfSigned,
  type LeaveApproverMember,
} from './leaveRequests'
import { notificationDeliversDevicePush } from './notificationPreferences'
import { idKey, idText, personIdSet, rosterMemberActive, type PersonIdsInput, type PersonRosterRow } from './personIds'
import type { StaffAccountRole } from './staffAccess'

export { personIdSet } from './personIds'
export type { PersonIdsInput, PersonRosterRow } from './personIds'

/** A roster row for the recipient rules: `PersonRosterRow` with the resolved staff role. */
export type NotificationRosterMember = Omit<PersonRosterRow, 'role'> & {
  role: StaffAccountRole
  annualLeaveSelfBook?: boolean | null
  permissions?: { annualLeaveSelfBook?: boolean | null; operativeMode?: boolean | null } | null
}

/** The person a notice is about, or the actor: a roster row, a partial row, or a bare id. */
export type NotificationPerson = (Partial<NotificationRosterMember> & PersonIdsInput) | string | null | undefined

type Roster = ReadonlyArray<NotificationRosterMember> | null | undefined

function rosterOf(roster: Roster): NotificationRosterMember[] {
  return (roster || []).filter((member) => member && typeof member === 'object' && idText(member.id))
}

/** The person as given, filled in from their roster row (same id, without case) for any field not given. */
function resolvePerson(person: NotificationPerson, members: NotificationRosterMember[]): Partial<NotificationRosterMember> | null {
  const given: Partial<NotificationRosterMember> | null =
    typeof person === 'string' ? { id: person } : person && typeof person === 'object' ? (person as Partial<NotificationRosterMember>) : null
  if (!given || !idText(given.id)) return given
  const row = members.find((member) => idKey(member.id) === idKey(given.id))
  if (!row) return given
  const merged: Record<string, unknown> = { ...row }
  for (const [key, value] of Object.entries(given)) {
    if (value !== undefined) merged[key] = value
  }
  return merged as Partial<NotificationRosterMember>
}

/**
 * `ids` without any id of `actor` (`personIdSet`: id, `formerUserIds`, `sameEmailUserIds`, same-email roster rows),
 * without roster members marked inactive, de-duplicated without case. Order kept. An id the roster does not know is
 * kept. No actor → only the de-dupe and the inactive filter.
 */
export function excludeActor(
  ids: ReadonlyArray<string> | null | undefined,
  actor: NotificationPerson,
  roster?: Roster
): string[] {
  const members = rosterOf(roster)
  const actorPerson = resolvePerson(actor, members)
  const actorIds = new Set(personIdSet(actorPerson as PersonIdsInput, members).map(idKey))
  const byId = new Map(members.map((member) => [idKey(member.id), member]))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids || []) {
    const id = idText(raw)
    const key = idKey(id)
    if (!key || seen.has(key) || actorIds.has(key)) continue
    const member = byId.get(key)
    if (member && !rosterMemberActive(member)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function personId(person: NotificationPerson): string {
  return typeof person === 'string' ? idText(person) : idText(person?.id)
}

/**
 * `timesheet_pending_manager_signoff`, when the owner signs their timesheet: the subject's active line managers
 * (`lineManagerIds(subject, roster)`); with none, every active admin and super admin outside operative mode
 * (`leaveApproverIds`). Never the subject. Empty when the sheet is self-signed (`timesheetSelfSigned`).
 */
export function timesheetSubmittedRecipients(subject: NotificationPerson, roster: Roster): string[] {
  const members = rosterOf(roster)
  const person = resolvePerson(subject, members)
  if (!person || !idText(person.id)) return []
  if (timesheetSelfSigned(person, members)) return []
  return excludeActor(leaveApproverIds(person, members as LeaveApproverMember[]), person, members)
}

/** `timesheet_signed_by_manager`, when a line manager or admin signs: the subject, unless they are the signer. */
export function timesheetSignedRecipients(subject: NotificationPerson, signer: NotificationPerson, roster: Roster): string[] {
  const id = personId(subject)
  return id ? excludeActor([id], signer, roster) : []
}

/**
 * `line_manager_peer_update` (inbox only, no push), when one line manager acts on a report's timesheet or leave:
 * the subject's other active line managers. Never the actor or the subject. No admin fallback.
 */
export function lineManagerPeerRecipients(subject: NotificationPerson, actor: NotificationPerson, roster: Roster): string[] {
  const members = rosterOf(roster)
  const person = resolvePerson(subject, members)
  if (!person || !idText(person.id)) return []
  return excludeActor(excludeActor(lineManagerIds(person, members), actor, members), person, members)
}

/**
 * `holiday_request_submitted`, when someone asks for leave or asks to cancel approved leave: `leaveApproverIds`
 * without the requester under any of their ids. Empty when the leave saves approved (`canSelfBookAnnualLeave`).
 */
export function holidayRequestRecipients(requester: NotificationPerson, roster: Roster): string[] {
  const members = rosterOf(roster)
  const person = resolvePerson(requester, members)
  if (!person || !idText(person.id)) return []
  if (canSelfBookAnnualLeave(person, members)) return []
  return excludeActor(leaveApproverIds(person, members as LeaveApproverMember[]), person, members)
}

/** `holiday_request_approved` / `holiday_request_declined`: the requester, unless they are the decider. */
export function holidayDecisionRecipients(requester: NotificationPerson, decider: NotificationPerson, roster: Roster): string[] {
  const id = personId(requester)
  return id ? excludeActor([id], decider, roster) : []
}

/** `booking_created`: the people booked, without the person who booked them. */
export function bookingCreatedRecipients(
  bookedIds: ReadonlyArray<string> | null | undefined,
  booker: NotificationPerson,
  roster: Roster
): string[] {
  return excludeActor(bookedIds, booker, roster)
}

/** `deadline_assigned`: the newly added assignees, without the person who assigned them. */
export function deadlineAssignedRecipients(
  addedIds: ReadonlyArray<string> | null | undefined,
  actor: NotificationPerson,
  roster: Roster
): string[] {
  return excludeActor(addedIds, actor, roster)
}

/** `toolbox_talk_issued` / `hs_toolbox_reminder`: the chosen (or still unsigned) people, without the issuer. */
export function toolboxTalkRecipients(
  ids: ReadonlyArray<string> | null | undefined,
  issuer: NotificationPerson,
  roster: Roster
): string[] {
  return excludeActor(ids, issuer, roster)
}

/** `idea_status` / `idea_shipped` / `idea_comment` / `idea_merged`: the idea's author and voters, without the actor. */
export function ideaRecipients(ids: ReadonlyArray<string> | null | undefined, actor: NotificationPerson, roster: Roster): string[] {
  return excludeActor(ids, actor, roster)
}

/** Timesheet notice types that carry a de-dupe key. */
export const TIMESHEET_PENDING_NOTICE_TYPE = 'timesheet_pending_manager_signoff'
export const TIMESHEET_SIGNED_NOTICE_TYPE = 'timesheet_signed_by_manager'

/**
 * The de-dupe key for a timesheet notice; each app hashes it into the document id with its existing
 * synthetic-UUID helper (web `syntheticUuidFromKey`, iOS `syntheticNotificationId`). The period start is the
 * organisation-zone day key, written as unix seconds of that day's midnight in the organisation zone (web
 * `unixStartOfDay` in the organisation zone), so both apps build the same key from the same period:
 * pending `timesheetPending|{subjectId}|{recipientId}|{seconds}`, signed `timesheetSigned|{subjectId}|{seconds}`.
 * Null for another type, a missing id or a bad day key.
 */
export function timesheetNotificationDedupeKey(input: {
  type: string
  subjectId: string
  periodStartDayKey: string
  timeZone?: string | null
  /** Required for `timesheet_pending_manager_signoff` (one row per recipient). */
  recipientId?: string | null
}): string | null {
  const type = idText(input?.type)
  const subject = idText(input?.subjectId)
  const dayKey = idText(input?.periodStartDayKey)
  if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  const seconds = Math.floor(dateFromDayKeyInZone(dayKey, zoneOrLondon(input.timeZone)).getTime() / 1000)
  if (!Number.isFinite(seconds)) return null
  if (type === TIMESHEET_PENDING_NOTICE_TYPE) {
    const recipient = idText(input.recipientId)
    return recipient ? `timesheetPending|${subject}|${recipient}|${seconds}` : null
  }
  if (type === TIMESHEET_SIGNED_NOTICE_TYPE) return `timesheetSigned|${subject}|${seconds}`
  return null
}

export type NotificationWriter = 'web' | 'ios' | 'function'

export type NotificationCatalogRow = {
  type: string
  trigger: string
  /** The rulebook function that names the recipients (or why there are none). */
  recipients: string
  /** Same as `notificationDeliversDevicePush(type)`. */
  devicePush: boolean
  writtenBy: ReadonlyArray<NotificationWriter>
  /** `ok`, or the known divergence an app must fix. */
  status: string
}

function row(
  type: string,
  trigger: string,
  recipients: string,
  writtenBy: NotificationWriter[],
  status = 'ok'
): NotificationCatalogRow {
  return { type, trigger, recipients, devicePush: notificationDeliversDevicePush(type), writtenBy, status }
}

/** Every notification type written today (rulebook §13 table). */
export const NOTIFICATION_CATALOG: ReadonlyArray<NotificationCatalogRow> = [
  row('holiday_request_submitted', 'Leave request, or a request to cancel approved leave', 'holidayRequestRecipients', ['web', 'ios'],
    'web: pass a roster with aliases (PersonalLeave). iOS: replace filterRecipientsExcludingRequester with holidayRequestRecipients.'),
  row('holiday_request_approved', 'Leave request approved (or a cancellation accepted)', 'holidayDecisionRecipients', ['web', 'ios'],
    'iOS: also writes this type for a manager-booked confirmation and to every admin (notifyAdminAnnualLeaveApproval); stop — only holidayDecisionRecipients.'),
  row('holiday_request_declined', 'Leave request declined (or a cancellation refused)', 'holidayDecisionRecipients', ['web', 'ios'],
    'iOS: also writes this type when a manager cancels leave and when self-book is switched off; route through holidayDecisionRecipients with the actor.'),
  row('timesheet_pending_manager_signoff', 'Owner signs their timesheet (not self-signed)', 'timesheetSubmittedRecipients', ['web', 'ios'],
    'both: recipients included the submitter and inactive managers; iOS remapped stale ids to same-email accounts. Use timesheetSubmittedRecipients and timesheetNotificationDedupeKey.'),
  row('timesheet_signed_by_manager', 'Line manager or admin signs a timesheet', 'timesheetSignedRecipients', ['web', 'ios']),
  row('line_manager_peer_update', 'One line manager signs a timesheet or decides leave for a shared report', 'lineManagerPeerRecipients', ['web', 'ios'],
    'web: not written for leave decisions (iOS is). Both: use lineManagerPeerRecipients.'),
  row('timesheet_submission_reminder', 'Scheduled reminder before the submit deadline', 'dueTimesheetSubmissionNotices (schedule); recipients are each participating user', ['web', 'ios'],
    'scheduled: rows carry actorUserId: null (nobody caused them). Who participates is still decided in each app; no shared recipient rule yet.'),
  row('material_order_placed', 'A line is added to a job material list', 'materialOrderRecipients, then excludeActor', ['web', 'ios'],
    'iOS: falls back to every admin when the job has no managers; there is no fallback — write nothing.'),
  row('variation', 'Variation created', 'receivesJobNotification, then excludeActor', ['web', 'ios'],
    'iOS: passes assignedManagerUserIds: [] to receivesJobNotification; pass the job managers.'),
  row('variation_renumbered', 'Variation renumbered', 'receivesJobNotification, then excludeActor', ['web', 'ios'],
    'iOS: passes assignedManagerUserIds: [] to receivesJobNotification; pass the job managers.'),
  row('variation_added', 'Variation added to a job', 'receivesJobNotification, then excludeActor', ['web', 'ios'],
    'iOS: passes assignedManagerUserIds: [] to receivesJobNotification; pass the job managers.'),
  row('toolbox_talk_issued', 'Toolbox talk issued', 'toolboxTalkRecipients', ['ios'], 'iOS only.'),
  row('hs_toolbox_reminder', 'Reminder to the people who have not signed a toolbox talk', 'toolboxTalkRecipients', ['web'],
    'web: the actor is not removed; use toolboxTalkRecipients.'),
  row('booking_created', 'People booked onto a job', 'bookingCreatedRecipients', ['ios'],
    'iOS: the booker is not removed; use bookingCreatedRecipients. Web writes none.'),
  row('task_created', 'Task assigned', 'excludeActor (the assignees)', ['ios'],
    'iOS only; the Settings diagnostic writes this type to the signed-in user — remove it.'),
  row('task_completed', 'Task completed', 'excludeActor (the task creator)', ['ios'], 'iOS only.'),
  row('deadline_assigned', 'Assignees added to a deadline', 'deadlineAssignedRecipients', ['web', 'ios'],
    'both: the actor is not removed; use deadlineAssignedRecipients.'),
  row('deadline_reminder', 'Scheduled deadline reminder', 'the assignees (on-device schedule, no shared rule)', ['ios'], 'iOS only. Scheduled: no actorUserId.'),
  row('deadline_due', 'Deadline due', 'the assignees (on-device schedule, no shared rule)', ['ios'], 'iOS only. Scheduled: no actorUserId.'),
  row('operative_created', 'Operative added', 'none — written without userId', ['ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('manager_created', 'Manager added', 'none — written without userId', ['ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('client_created', 'Client added', 'none — written without userId', ['web', 'ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('project_created', 'Project created', 'none — written without userId', ['ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('small_works_created', 'Small works created', 'none — written without userId', ['ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('warning_removed', 'Warning dismissed', 'none — written without userId', ['web', 'ios'],
    'ownerless: never listed, never pushed. Stop writing it or address it with a recipient rule.'),
  row('idea_status', 'Feedback idea status changed', 'ideaRecipients', ['web'], 'web: the actor is not removed; use ideaRecipients.'),
  row('idea_shipped', 'Feedback idea shipped', 'ideaRecipients', ['web'], 'web: the actor is not removed; use ideaRecipients.'),
  row('idea_comment', 'Comment on a feedback idea', 'ideaRecipients', ['web'],
    'web: the actor is not removed; use ideaRecipients. iOS: type missing from its enum.'),
  row('idea_merged', 'Feedback idea merged into another', 'ideaRecipients', ['web'],
    'web: the actor is not removed; use ideaRecipients. iOS: type missing from its enum.'),
  row('material_order_cut_off', 'On-device clock before the organisation material cut-off', 'the signed-in user (local notification, not an inbox row)', ['ios'], 'iOS only.'),
  row('qualification_expiry', 'On-device clock before a qualification expires', 'the signed-in user (local notification, not an inbox row)', ['ios'], 'iOS only.'),
]

/** The catalog row for a type, or null. */
export function notificationCatalogRow(type: string): NotificationCatalogRow | null {
  const key = idText(type)
  return NOTIFICATION_CATALOG.find((entry) => entry.type === key) ?? null
}
