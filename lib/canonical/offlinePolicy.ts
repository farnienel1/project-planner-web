/**
 * Rulebook §2 "Offline rules" as one table, so iOS and Android read the same answer for every control.
 *
 * Web is online only. On iOS and Android each action is one of:
 *   - `allowedOffline`: queued on the device and pushed when the connection returns; the item shows
 *     `OFFLINE_PENDING_SYNC_LABEL` ("Pending sync") until the server confirms it.
 *   - `onlineOnly`: the control is disabled offline with `OFFLINE_ONLINE_ONLY_MESSAGE`
 *     ("Connect to the internet to change this").
 *   - `readOnlyOffline`: shows the last synced data labelled `offlineLastUpdatedLabel` ("Last updated …") and is
 *     never recalculated from unsynced local changes.
 *
 * Action ids are stable strings (iOS `OfflineAction` raw values). Create, edit and delete a labour or manager schedule
 * booking are queued (1.33.0, owner decision 4 Nov "Offline delete on iOS"): the delete is queued with its tombstone
 * (`bookingTombstoneWriteFields`) and replayed through `offlineDeleteReplayDecision`. Deleting a subcontractor
 * booking stays online only (`booking.delete_subcontractor`; `bookingDeleteOfflineAction` picks the id). There is no
 * cancel action (1.33.0, owner decision 4 Nov "Cancel is removed as a user action"): an old build asking for
 * `booking.cancel` gets `onlineOnly`, the answer for an unknown id.
 */

import { partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'

export const OFFLINE_AVAILABILITIES = ['allowedOffline', 'onlineOnly', 'readOnlyOffline'] as const
export type OfflineAvailability = (typeof OFFLINE_AVAILABILITIES)[number]

/** Every action §2 names, by stable id, with its availability. */
export const OFFLINE_ACTIONS = {
  // Allowed offline
  'booking.create': 'allowedOffline',
  'booking.edit': 'allowedOffline',
  // 1.33.0: labour (`bookings`) and manager schedule (`managerSiteBookings`) deletes, iOS and Android.
  'booking.delete': 'allowedOffline',
  'annual_leave.request': 'allowedOffline',
  'profile.own_fields': 'allowedOffline',
  'notifications.own_toggles': 'allowedOffline',
  // Online only: bookings (1.33.0: subcontractor bookings are deleted online only)
  'booking.delete_subcontractor': 'onlineOnly',
  // 1.41.0 (owner decision 11 Nov): Replace on a double-booking row (create + delete + tombstone in one batch).
  'booking.replace': 'onlineOnly',
  // Online only: organisation settings
  'settings.company_details': 'onlineOnly',
  'settings.currency': 'onlineOnly',
  'settings.working_hours_overtime': 'onlineOnly',
  'settings.warnings': 'onlineOnly',
  'settings.payment_runs': 'onlineOnly',
  'settings.material_order_cut_off': 'onlineOnly',
  'settings.schedule_options': 'onlineOnly',
  // Online only: Manage Users
  'users.role': 'onlineOnly',
  'users.line_manager': 'onlineOnly',
  'users.employment_status': 'onlineOnly',
  'users.pay_rate': 'onlineOnly',
  'users.exclusions': 'onlineOnly',
  'users.inactive': 'onlineOnly',
  'users.invites': 'onlineOnly',
  // Online only: approvals
  'approvals.annual_leave': 'onlineOnly',
  'approvals.timesheet_signing': 'onlineOnly',
  'approvals.clash': 'onlineOnly',
  // Online only: account actions
  'account.sign_in': 'onlineOnly',
  'account.password': 'onlineOnly',
  'account.switch_organization': 'onlineOnly',
  // Read-only offline
  'view.daily_overview': 'readOnlyOffline',
  'view.warnings': 'readOnlyOffline',
  'view.weekly_report': 'readOnlyOffline',
  'view.my_schedule': 'readOnlyOffline',
} as const satisfies Record<string, OfflineAvailability>

export type OfflineActionId = keyof typeof OFFLINE_ACTIONS

export const OFFLINE_ONLINE_ONLY_MESSAGE = 'Connect to the internet to change this'
export const OFFLINE_PENDING_SYNC_LABEL = 'Pending sync'
export const OFFLINE_LAST_UPDATED_PREFIX = 'Last updated'

/**
 * The availability of an action id. An unknown id is `onlineOnly`, so a control nobody listed is never queued
 * offline by accident.
 */
export function offlineAvailability(actionId: unknown): OfflineAvailability {
  const id = typeof actionId === 'string' ? actionId.trim() : ''
  return Object.prototype.hasOwnProperty.call(OFFLINE_ACTIONS, id)
    ? OFFLINE_ACTIONS[id as OfflineActionId]
    : 'onlineOnly'
}

/**
 * 1.33.0: the offline action id for deleting a booking in `collection` — `booking.delete` for labour (`bookings`) and
 * manager schedule (`managerSiteBookings`) bookings, `booking.delete_subcontractor` (online only) for
 * `subcontractorBookings` and anything else, so an unlisted collection is never deleted offline.
 */
export function bookingDeleteOfflineAction(collection: unknown): 'booking.delete' | 'booking.delete_subcontractor' {
  const value = typeof collection === 'string' ? collection.trim() : ''
  return value === 'bookings' || value === 'managerSiteBookings' ? 'booking.delete' : 'booking.delete_subcontractor'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * "Last updated 31 Oct 2026, 14:05": the last sync instant in the organisation zone, 24-hour clock, English
 * month abbreviations (fixed, not the device locale). Null when there has been no sync or the instant is invalid.
 */
export function offlineLastUpdatedLabel(iso: unknown, timeZone?: string | null): string | null {
  if (iso == null || iso === '') return null
  const date = iso instanceof Date ? iso : new Date(iso as string | number)
  if (Number.isNaN(date.getTime())) return null
  const parts = partsInZone(date, zoneOrLondon(timeZone))
  return `${OFFLINE_LAST_UPDATED_PREFIX} ${parts.d} ${MONTHS[parts.m - 1]} ${parts.y}, ${pad(parts.h)}:${pad(parts.min)}`
}
