/**
 * User-level notification toggles, inbox destinations, and device-push rules.
 *
 * Screens stay in each app. Both apps read and write
 * `users/{uid}.notificationPreferences` with these keys, and both call
 * `notificationDestination` then map the kind to a native route. Do not keep a
 * second toggle list, a second deep-link map, or a second unread counter in a
 * screen. Device-push allow-list and the in-app / APNs badge number live here.
 *
 * Who is on the fan-out for a job or booking stays `receivesJobNotification`.
 * A toggle that is on does not add recipients.
 *
 * Web never sends a browser or OS notification. A closed iPhone is reached by
 * one FCM send on create of `organizations/{orgId}/notifications/{id}`.
 */

import type { AccountKind } from './userProfile'
import {
  canEditWorkCatalogue,
  canReviewUserTimesheets,
  canViewStaffWarnings,
  isStaffAccount,
  type StaffAccountRole,
  type WorkCatalogueToggles,
} from './staffAccess'
import { TIMESHEET_SUBMISSION_NOTICE_TYPE } from './timesheetSubmission'

export const NOTIFICATION_PREFERENCE_KEYS = [
  'materialOrderCutOff',
  'annualLeaveRequested',
  'annualLeaveDecision',
  'projectCreated',
  'smallWorksCreated',
  'bookingClashes',
  'materialOrderPlaced',
  'bookedOntoJob',
  'operativeCreated',
  'managerCreated',
  'clientCreated',
  'warningDismissed',
  'tasksAssignedOrCompleted',
  'toolboxTalkIssued',
  'timesheetSignOff',
  'qualificationExpiry',
  'lineManagerPeerUpdates',
  'timesheetSubmissionReminder',
] as const

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number]

export type UserNotificationPreferences = Record<NotificationPreferenceKey, boolean>

/** Every toggle defaults on. A missing key is on; only an explicit false is off. */
export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  materialOrderCutOff: true,
  annualLeaveRequested: true,
  annualLeaveDecision: true,
  projectCreated: true,
  smallWorksCreated: true,
  bookingClashes: true,
  materialOrderPlaced: true,
  bookedOntoJob: true,
  operativeCreated: true,
  managerCreated: true,
  clientCreated: true,
  warningDismissed: true,
  tasksAssignedOrCompleted: true,
  toolboxTalkIssued: true,
  timesheetSignOff: true,
  qualificationExpiry: true,
  lineManagerPeerUpdates: true,
  timesheetSubmissionReminder: true,
}

/**
 * Older iOS keys on the same map. Read them when the current key is absent.
 * A save must not delete these keys.
 */
export const LEGACY_NOTIFICATION_PREFERENCE_ALIASES: Readonly<
  Record<string, NotificationPreferenceKey>
> = {
  bookingConflicts: 'bookingClashes',
}

const TYPE_TO_PREFERENCE: Record<string, NotificationPreferenceKey> = {
  material_order_cut_off: 'materialOrderCutOff',
  holiday_request_submitted: 'annualLeaveRequested',
  holiday_request_approved: 'annualLeaveDecision',
  holiday_request_declined: 'annualLeaveDecision',
  project_created: 'projectCreated',
  small_works_created: 'smallWorksCreated',
  booking_clash: 'bookingClashes',
  material_order_placed: 'materialOrderPlaced',
  material_order_created: 'materialOrderPlaced',
  booking_created: 'bookedOntoJob',
  booked_onto_job: 'bookedOntoJob',
  operative_created: 'operativeCreated',
  manager_created: 'managerCreated',
  client_created: 'clientCreated',
  warning_removed: 'warningDismissed',
  task_created: 'tasksAssignedOrCompleted',
  task_completed: 'tasksAssignedOrCompleted',
  deadline_assigned: 'tasksAssignedOrCompleted',
  deadline_reminder: 'tasksAssignedOrCompleted',
  deadline_due: 'tasksAssignedOrCompleted',
  toolbox_talk_issued: 'toolboxTalkIssued',
  hs_toolbox_reminder: 'toolboxTalkIssued',
  timesheet_pending_manager_signoff: 'timesheetSignOff',
  timesheet_signed_by_manager: 'timesheetSignOff',
  qualification_expiry: 'qualificationExpiry',
  line_manager_peer_update: 'lineManagerPeerUpdates',
  [TIMESHEET_SUBMISSION_NOTICE_TYPE]: 'timesheetSubmissionReminder',
}

export type NotificationWorkCatalogue = 'projects' | 'smallWorks'

export type NotificationDestinationKind =
  | 'dailyOverviewDay'
  | 'projectScheduling'
  | 'smallWorksScheduling'
  | 'mySchedule'
  | 'annualLeave'
  | 'annualLeavePending'
  | 'projectDetail'
  | 'projectsList'
  | 'smallWorksDetail'
  | 'smallWorksList'
  | 'warnings'
  | 'materialOrders'
  | 'clients'
  | 'manageUsers'
  | 'userEdit'
  | 'tasks'
  | 'healthSafety'
  | 'timesheetMine'
  | 'timesheetTeamAwaiting'
  | 'timesheetTeamSigned'
  | 'qualifications'
  | 'notifications'
  | 'home'

export type NotificationDestination = {
  kind: NotificationDestinationKind
  relatedId?: string
  dayKey?: string
  userId?: string
}

export type NotificationDestinationInput = {
  type: string
  relatedId?: string | null
  dayKey?: string | null
  catalogue?: NotificationWorkCatalogue | string | null
  role: AccountKind
  deepLinkUserId?: string | null
}

function trimmed(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

function asDayKey(value: string | null | undefined): string | undefined {
  const key = trimmed(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : undefined
}

function asCatalogue(value: string | null | undefined): NotificationWorkCatalogue | undefined {
  if (value === 'projects' || value === 'smallWorks') return value
  return undefined
}

function flagOn(raw: unknown): boolean {
  return raw !== false
}

/**
 * Read `users/{uid}.notificationPreferences`. Missing keys default on.
 * `bookingConflicts` fills `bookingClashes` when the new key is absent.
 */
export function parseUserNotificationPreferences(
  raw: Record<string, unknown> | undefined | null
): UserNotificationPreferences {
  const source = raw && typeof raw === 'object' ? raw : {}
  const prefs = { ...DEFAULT_USER_NOTIFICATION_PREFERENCES }
  for (const [legacy, current] of Object.entries(LEGACY_NOTIFICATION_PREFERENCE_ALIASES)) {
    if (!(current in source) && legacy in source) {
      prefs[current] = flagOn(source[legacy])
    }
  }
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    if (key in source) prefs[key] = flagOn(source[key])
  }
  return prefs
}

/**
 * Nested map values only. Do not `set` this object over the Firestore map —
 * that would drop legacy keys and any field this list does not name.
 */
export function userNotificationPreferencesToFirestore(
  prefs: UserNotificationPreferences
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    out[key] = prefs[key] !== false
  }
  return out
}

/**
 * Dotted updates for `updateDoc`. Only the keys in `prefs` are written.
 * A full replace of `notificationPreferences` is never returned.
 */
export function userNotificationPreferenceFieldPatch(
  prefs: Partial<UserNotificationPreferences>
): Record<string, boolean> {
  const patch: Record<string, boolean> = {}
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(prefs, key)) {
      patch[`notificationPreferences.${key}`] = prefs[key] !== false
    }
  }
  return patch
}

export function notificationPreferenceKeyForType(type: string): NotificationPreferenceKey | null {
  return TYPE_TO_PREFERENCE[trimmed(type)] ?? null
}

/**
 * Who may see a My notifications toggle. Fan-out stays
 * `receivesJobNotification` — hiding a toggle does not add recipients.
 */
export type NotificationPreferenceAudience = {
  role: StaffAccountRole
  catalogue: WorkCatalogueToggles
  canManagePeople?: boolean
  canManageClients?: boolean
  canManageMaterials?: boolean
}

export type NotificationPreferenceCopy = {
  label: string
  description: string
}

const PREFERENCE_LABELS: Record<NotificationPreferenceKey, string> = {
  materialOrderCutOff: 'Material order cut-off',
  annualLeaveRequested: 'Annual leave requested',
  annualLeaveDecision: 'Annual leave approved or declined',
  projectCreated: 'New project created',
  smallWorksCreated: 'New small works',
  bookingClashes: 'Booking clashes',
  materialOrderPlaced: 'New material order',
  bookedOntoJob: "You've been booked",
  operativeCreated: 'New operative created',
  managerCreated: 'New manager created',
  clientCreated: 'New client created',
  warningDismissed: 'Warning dismissed',
  tasksAssignedOrCompleted: 'Tasks assigned or completed',
  toolboxTalkIssued: 'Toolbox talk issued',
  timesheetSignOff: 'Timesheet sign-off',
  qualificationExpiry: 'Qualification expiry',
  lineManagerPeerUpdates: 'Line manager peer updates',
  timesheetSubmissionReminder: 'Timesheet submission reminder',
}

/**
 * User-level copy. Operatives do not see manager/admin rows, so they never
 * get “someone you manage” text. Annual leave decision is always the
 * person’s own request.
 */
export function notificationPreferenceCopy(
  key: NotificationPreferenceKey,
  audience?: NotificationPreferenceAudience | null
): NotificationPreferenceCopy {
  const descriptions: Record<NotificationPreferenceKey, string> = {
    materialOrderCutOff: 'Daily reminder at the time set in organisation settings.',
    annualLeaveRequested: 'When someone you manage requests annual leave.',
    annualLeaveDecision: 'When your annual leave is approved or declined.',
    projectCreated: 'When a project is added.',
    smallWorksCreated: 'When new small works is added.',
    bookingClashes: 'When two bookings overlap.',
    materialOrderPlaced: 'When a material order is placed.',
    bookedOntoJob: 'When you are booked onto a job.',
    operativeCreated: 'When a new operative is added.',
    managerCreated: 'When a new manager is added.',
    clientCreated: 'When a new client is added.',
    warningDismissed: 'When someone dismisses a warning.',
    tasksAssignedOrCompleted: 'When a task is assigned to you or marked complete.',
    toolboxTalkIssued: 'When a toolbox talk is issued to you.',
    timesheetSignOff: 'When a timesheet needs your sign-off or has been signed.',
    qualificationExpiry: 'Reminders before qualifications expire.',
    lineManagerPeerUpdates: 'When another line manager actions a shared request.',
    timesheetSubmissionReminder: 'Reminder to submit before the payment-run deadline.',
  }
  return { label: PREFERENCE_LABELS[key], description: descriptions[key] }
}

export function notificationPreferenceIsVisible(
  key: NotificationPreferenceKey,
  audience: NotificationPreferenceAudience
): boolean {
  const role = audience.role
  const staff = isStaffAccount(role)
  switch (key) {
    case 'projectCreated':
      return canEditWorkCatalogue(role, 'projects', audience.catalogue)
    case 'smallWorksCreated':
      return canEditWorkCatalogue(role, 'smallWorks', audience.catalogue)
    case 'annualLeaveRequested':
    case 'bookingClashes':
    case 'lineManagerPeerUpdates':
    case 'managerCreated':
      return staff
    case 'materialOrderPlaced':
      return staff && audience.canManageMaterials !== false
    case 'operativeCreated':
      return staff && audience.canManagePeople !== false
    case 'clientCreated':
      return staff && audience.canManageClients !== false
    case 'warningDismissed':
      return canViewStaffWarnings(role)
    case 'timesheetSignOff':
      return canReviewUserTimesheets(role)
    default:
      return true
  }
}

export function visibleNotificationPreferenceKeys(
  audience: NotificationPreferenceAudience
): NotificationPreferenceKey[] {
  return NOTIFICATION_PREFERENCE_KEYS.filter((key) => notificationPreferenceIsVisible(key, audience))
}

/**
 * Whether this account should receive a notice of `type`.
 * Types with no toggle (variations, ideas) stay allowed.
 * A toggle that is on does not add the user to a fan-out they are not already on.
 */
export function notificationPreferenceAllowsDelivery(
  prefs: UserNotificationPreferences,
  type: string
): boolean {
  const key = notificationPreferenceKeyForType(type)
  if (!key) return true
  return prefs[key] !== false
}

/**
 * Inbox types that send one FCM / APNs alert when the row is first created.
 * On-device clocks stay local and must not get a second server push:
 * `material_order_cut_off`, `qualification_expiry`, `deadline_reminder`,
 * `deadline_due`.
 */
export const DEVICE_PUSH_NOTIFICATION_TYPES = [
  'booking_created',
  'booked_onto_job',
  'booking_clash',
  'task_created',
  'task_completed',
  'deadline_assigned',
  'holiday_request_submitted',
  'holiday_request_approved',
  'holiday_request_declined',
  'timesheet_pending_manager_signoff',
  'timesheet_signed_by_manager',
  'toolbox_talk_issued',
  'hs_toolbox_reminder',
  'material_order_placed',
  'material_order_created',
  'variation',
  'warning_removed',
  'operative_created',
  'manager_created',
  'client_created',
  'project_created',
  'small_works_created',
  TIMESHEET_SUBMISSION_NOTICE_TYPE,
] as const

export type DevicePushNotificationType = (typeof DEVICE_PUSH_NOTIFICATION_TYPES)[number]

const DEVICE_PUSH_TYPE_SET = new Set<string>(DEVICE_PUSH_NOTIFICATION_TYPES)

/** Opening the iPhone app clears the red icon number. The in-app count stays. */
export const NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND = true

export function devicePushNotificationTypes(): readonly string[] {
  return DEVICE_PUSH_NOTIFICATION_TYPES
}

export function notificationDeliversDevicePush(type: string): boolean {
  return DEVICE_PUSH_TYPE_SET.has(trimmed(type))
}

export type UnreadNotificationBadgeRow = {
  userId?: string | null
  isRead?: boolean | null
  createdAt?: Date | { getTime?: () => number } | number | null
}

/**
 * The notification centre lists a row for this signed-in user when the
 * stored `userId` matches, or when the row has no owner (legacy broadcast).
 * A row addressed to someone else is never listed. Who was written onto
 * the row stays `receivesJobNotification` at create time.
 */
export function inboxNotificationVisibleToUser(
  row: Pick<UnreadNotificationBadgeRow, 'userId'> | null | undefined,
  userId: string
): boolean {
  const uid = trimmed(userId)
  if (!uid || !row || typeof row !== 'object') return false
  const owner = trimmed(row.userId)
  return !owner || owner === uid
}

/** Newest createdAt first. Both apps sort the centre this way. */
export function compareInboxNotificationsByCreatedAt(
  left: Pick<UnreadNotificationBadgeRow, 'createdAt'> | null | undefined,
  right: Pick<UnreadNotificationBadgeRow, 'createdAt'> | null | undefined
): number {
  return inboxCreatedAtMs(right) - inboxCreatedAtMs(left)
}

function inboxCreatedAtMs(row: Pick<UnreadNotificationBadgeRow, 'createdAt'> | null | undefined): number {
  const value = row?.createdAt
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && typeof value.getTime === 'function') {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

/**
 * Unread rows the notification centre lists for `userId`.
 * Same visibility as `inboxNotificationVisibleToUser`.
 * Explicit `isRead: true` is read; missing or false is unread.
 */
export function unreadNotificationBadgeCount(
  notifications: ReadonlyArray<UnreadNotificationBadgeRow> | null | undefined,
  userId: string
): number {
  const uid = trimmed(userId)
  if (!uid) return 0
  const rows = Array.isArray(notifications) ? notifications : []
  let count = 0
  for (const row of rows) {
    if (!inboxNotificationVisibleToUser(row, uid)) continue
    if (row.isRead === true) continue
    count += 1
  }
  return count
}

function bookingDestination(
  role: AccountKind,
  relatedId: string | undefined,
  dayKey: string | undefined,
  catalogue: NotificationWorkCatalogue | undefined
): NotificationDestination {
  if (role === 'operative') return { kind: 'mySchedule', dayKey }
  if (role === 'manager' && relatedId) {
    if (catalogue === 'smallWorks') return { kind: 'smallWorksScheduling', relatedId, dayKey }
    if (catalogue === 'projects') return { kind: 'projectScheduling', relatedId, dayKey }
  }
  return { kind: 'dailyOverviewDay', dayKey }
}

/**
 * Shared inbox destination. Each app maps `kind` to its own route.
 * Booking: admin → Daily Overview on that day; manager → that job’s scheduling
 * page when the record names a catalogue; operative → My Schedule.
 * Missing record id falls back to the section hub or Daily Overview.
 * Unknown type → the notifications list.
 */
export function notificationDestination(input: NotificationDestinationInput): NotificationDestination {
  const type = trimmed(input.type)
  const relatedId = trimmed(input.relatedId) || undefined
  const dayKey = asDayKey(input.dayKey) || asDayKey(relatedId)
  const catalogue = asCatalogue(input.catalogue)
  const role: AccountKind =
    input.role === 'admin' || input.role === 'operative' || input.role === 'manager' ? input.role : 'manager'
  const userId = trimmed(input.deepLinkUserId) || undefined

  switch (type) {
    case 'booking_created':
    case 'booked_onto_job':
      return bookingDestination(role, relatedId, dayKey, catalogue)
    case 'booking_clash':
      if (role === 'admin') return { kind: 'dailyOverviewDay', dayKey }
      if (role === 'manager' && relatedId && catalogue === 'smallWorks') {
        return { kind: 'smallWorksScheduling', relatedId, dayKey }
      }
      if (role === 'manager' && relatedId && catalogue === 'projects') {
        return { kind: 'projectScheduling', relatedId, dayKey }
      }
      return { kind: 'warnings', dayKey }
    case 'holiday_request_submitted':
      return { kind: 'annualLeavePending', relatedId }
    case 'holiday_request_approved':
    case 'holiday_request_declined':
      return { kind: 'annualLeave', relatedId }
    case 'project_created':
      return relatedId ? { kind: 'projectDetail', relatedId } : { kind: 'projectsList' }
    case 'small_works_created':
      return relatedId ? { kind: 'smallWorksDetail', relatedId } : { kind: 'smallWorksList' }
    case 'material_order_cut_off':
      return { kind: 'warnings' }
    case 'material_order_placed':
    case 'material_order_created':
      return { kind: 'materialOrders', relatedId }
    case 'operative_created':
    case 'manager_created':
      return relatedId ? { kind: 'userEdit', relatedId } : { kind: 'manageUsers' }
    case 'client_created':
      return { kind: 'clients', relatedId }
    case 'warning_removed':
    case 'qualification_expiry':
      return { kind: 'warnings', relatedId, dayKey }
    case 'task_created':
    case 'task_completed':
    case 'deadline_assigned':
    case 'deadline_reminder':
    case 'deadline_due':
      return { kind: 'tasks', relatedId }
    case 'toolbox_talk_issued':
    case 'hs_toolbox_reminder':
      return { kind: 'healthSafety', relatedId }
    case 'timesheet_pending_manager_signoff':
      return { kind: 'timesheetTeamAwaiting', userId, dayKey }
    case 'timesheet_signed_by_manager':
      return { kind: 'timesheetMine', userId, dayKey }
    case 'line_manager_peer_update':
      if (userId || dayKey) return { kind: 'timesheetTeamSigned', userId, dayKey }
      return { kind: 'annualLeave' }
    case TIMESHEET_SUBMISSION_NOTICE_TYPE:
      return { kind: 'timesheetMine', dayKey }
    default:
      return { kind: 'notifications' }
  }
}
