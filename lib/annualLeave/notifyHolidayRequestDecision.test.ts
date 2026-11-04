import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type HolidayBooking, type Operative, type User } from '../../types/index.ts'
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  inboxNotificationVisibleToUser,
  notificationDeliversDevicePush,
  notificationDestination,
  notificationPreferenceAllowsDelivery,
  parseUserNotificationPreferences,
} from '../canonical/notificationPreferences.ts'
import {
  HOLIDAY_REQUEST_APPROVED,
  HOLIDAY_REQUEST_DECLINED,
  annualLeaveDecisionDateText,
  buildHolidayRequestDecisionNotification,
  buildLeaveDecisionPeerNotifications,
  holidayDecisionDedupeKey,
  holidayDecisionRecipientUserId,
  holidayRequestDecisionMessage,
} from './notifyHolidayRequestDecision.ts'

const start = new Date('2026-10-20T12:00:00+01:00')
const end = new Date('2026-10-22T12:00:00+01:00')

function booking(partial: Partial<HolidayBooking> = {}): HolidayBooking {
  return {
    id: 'BOOK-1',
    organizationId: 'org-1',
    userId: 'op-user-1',
    startDate: start,
    endDate: start,
    status: 'pending',
    timeSlot: 'FULL DAY',
    createdAt: start,
    updatedAt: start,
    ...partial,
  }
}

function operativeUser(partial: Partial<User> = {}): User {
  return {
    id: 'op-user-1',
    email: 'op@example.com',
    firstName: 'Pat',
    surname: 'Operative',
    organizationId: 'org-1',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    createdAt: start,
    updatedAt: start,
    ...partial,
  } as User
}

function rosterOperative(partial: Partial<Operative> = {}): Operative {
  return {
    id: 'op-row-1',
    firstName: 'Pat',
    lastName: 'Operative',
    email: 'op@example.com',
    startDate: start,
    hourlyRate: 0,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: start,
    updatedAt: start,
    organizationId: 'org-1',
    ...partial,
  }
}

test('leave decision write uses iOS type, userId, copy, and annualLeave destination', () => {
  const approved = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking(),
    approved: true,
    decidedByName: 'Alex Manager',
  })
  assert.ok(approved)
  assert.equal(approved.type, HOLIDAY_REQUEST_APPROVED)
  assert.equal(approved.title, 'Annual Leave Approved')
  assert.equal(
    approved.message,
    'Alex Manager approved your annual leave request for 20 Oct 2026 (FULL DAY).'
  )
  assert.equal(approved.userId, 'op-user-1')
  assert.equal(approved.relatedId, 'BOOK-1')
  assert.equal(approved.requiresPermission, null)
  assert.deepEqual(approved.destination, { kind: 'annualLeave', relatedId: 'BOOK-1' })
  assert.deepEqual(
    notificationDestination({ type: approved.type, relatedId: approved.relatedId, role: 'operative' }),
    { kind: 'annualLeave', relatedId: 'BOOK-1' }
  )
  assert.equal(inboxNotificationVisibleToUser(approved, 'op-user-1'), true)
  assert.equal(inboxNotificationVisibleToUser(approved, 'someone-else'), false)
  assert.equal(notificationDeliversDevicePush(approved.type), true)

  const declined = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking({ endDate: end, timeSlot: 'AM', decisionNote: 'Crew already covered.' }),
    approved: false,
    decidedByName: 'Alex Manager',
  })
  assert.ok(declined)
  assert.equal(declined.type, HOLIDAY_REQUEST_DECLINED)
  assert.equal(declined.title, 'Annual Leave Declined')
  assert.equal(
    declined.message,
    'Alex Manager declined your annual leave request for 20 Oct 2026 – 22 Oct 2026 (AM). Crew already covered.'
  )
  assert.equal(declined.userId, 'op-user-1')
  assert.deepEqual(declined.destination, { kind: 'annualLeave', relatedId: 'BOOK-1' })
  assert.equal(notificationDeliversDevicePush(declined.type), true)
})

test('holiday document userId wins; operativeId is only an in-memory fallback', () => {
  assert.equal(holidayDecisionRecipientUserId(booking({ userId: '  doc-user  ', operativeId: 'op-row-1' })), 'doc-user')
  assert.equal(holidayDecisionRecipientUserId(booking({ userId: '', operativeId: 'op-row-1' })), null)
  assert.equal(
    holidayDecisionRecipientUserId(
      booking({ userId: '', operativeId: 'op-row-1' }),
      [operativeUser({ id: 'resolved-user' })],
      [rosterOperative()]
    ),
    'resolved-user'
  )
  // Ids compare without case (rulebook §1 `normalizeDocumentId`): an iOS upper-case operativeId finds the web row.
  assert.equal(
    holidayDecisionRecipientUserId(
      booking({ userId: '', operativeId: 'OP-ROW-1' }),
      [operativeUser({ id: 'resolved-user' })],
      [rosterOperative()]
    ),
    'resolved-user'
  )
  assert.equal(
    holidayDecisionRecipientUserId(
      booking({ userId: '', operativeId: 'op-row-1' }),
      [operativeUser({ id: 'manager-same-email', role: UserRole.MANAGER, permissions: {
        ...operativeUser().permissions,
        operativeMode: false,
        manager: true,
      } })],
      [rosterOperative()]
    ),
    null
  )
  assert.equal(buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking({ userId: '', operativeId: 'missing' }),
    approved: true,
    decidedByName: 'Alex',
  }), null)
})

test('annualLeaveDecision toggle uses the canonical allow-list', () => {
  const allowed = parseUserNotificationPreferences({})
  const off = parseUserNotificationPreferences({ annualLeaveDecision: false })
  assert.equal(notificationPreferenceAllowsDelivery(allowed, HOLIDAY_REQUEST_APPROVED), true)
  assert.equal(notificationPreferenceAllowsDelivery(allowed, HOLIDAY_REQUEST_DECLINED), true)
  assert.equal(notificationPreferenceAllowsDelivery(off, HOLIDAY_REQUEST_APPROVED), false)
  assert.equal(notificationPreferenceAllowsDelivery(off, HOLIDAY_REQUEST_DECLINED), false)
  assert.equal(DEFAULT_USER_NOTIFICATION_PREFERENCES.annualLeaveDecision, true)
})

test('leave notice dates are in the organisation zone, not London', () => {
  // 14:00 UTC on 19 Oct is 01:00 on 20 Oct in Sydney and 15:00 on 19 Oct in London.
  const at = new Date('2026-10-19T14:00:00Z')
  const late = booking({ startDate: at, endDate: at })
  assert.equal(annualLeaveDecisionDateText(late, 'Australia/Sydney'), '20 Oct 2026 (FULL DAY)')
  assert.equal(annualLeaveDecisionDateText(late, 'Europe/London'), '19 Oct 2026 (FULL DAY)')
})

test('decision copy and dedupe key match iOS', () => {
  assert.equal(annualLeaveDecisionDateText(booking()), '20 Oct 2026 (FULL DAY)')
  assert.equal(
    annualLeaveDecisionDateText(booking({ endDate: end, timeSlot: 'PM' })),
    '20 Oct 2026 – 22 Oct 2026 (PM)'
  )
  assert.equal(
    holidayRequestDecisionMessage({ approved: true, decidedByName: 'Alex', dateText: '20 Oct 2026 (FULL DAY)' }),
    'Alex approved your annual leave request for 20 Oct 2026 (FULL DAY).'
  )
  assert.equal(
    holidayRequestDecisionMessage({ approved: false, decidedByName: 'Alex', dateText: '' }),
    'Alex declined your annual leave request.'
  )
  assert.equal(holidayDecisionDedupeKey('BOOK-1', 'op-user-1', true), 'holidayDecision|BOOK-1|op-user-1|true')
  assert.equal(holidayDecisionDedupeKey('BOOK-1', 'op-user-1', false), 'holidayDecision|BOOK-1|op-user-1|false')
})

test('holidayDecisionRecipients: a decider never notifies themself', () => {
  const self = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking(),
    approved: true,
    decidedByName: 'Op',
    decidedByUserId: 'op-user-1',
  })
  assert.equal(self, null)
  const other = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking(),
    approved: true,
    decidedByName: 'Alex Manager',
    decidedByUserId: 'mgr-1',
  })
  assert.equal(other?.userId, 'op-user-1')
})

test('leave decision: line_manager_peer_update to the other active line managers, never the decider', () => {
  const managerPerms = { ...operativeUser().permissions, operativeMode: false, manager: true }
  const requester = operativeUser({ assignedManagerUserIds: ['mgr-1', 'mgr-2', 'mgr-3'] })
  const mgr1 = operativeUser({ id: 'mgr-1', email: 'm1@example.com', role: UserRole.MANAGER, permissions: managerPerms })
  const mgr2 = operativeUser({ id: 'mgr-2', email: 'm2@example.com', role: UserRole.MANAGER, permissions: managerPerms })
  const mgr3 = operativeUser({ id: 'mgr-3', email: 'm3@example.com', role: UserRole.MANAGER, permissions: managerPerms, isActive: false })
  const rows = buildLeaveDecisionPeerNotifications({
    organizationId: 'org-1',
    booking: booking(),
    approved: true,
    decidedByName: 'Alex Manager',
    decidedByUserId: 'mgr-1',
    users: [requester, mgr1, mgr2, mgr3],
  })
  assert.deepEqual(rows.map((row) => row.userId), ['mgr-2'])
  assert.equal(rows[0].type, 'line_manager_peer_update')
  assert.equal(notificationDeliversDevicePush(rows[0].type), false)
  assert.equal(rows[0].message, "Alex Manager approved Pat Operative's annual leave request. 20 Oct 2026 (FULL DAY)")
})

test('1.9.0 M6: a decision on a cancellation request notifies the requester as its own notice', () => {
  const accepted = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking({ cancellationRequestedAt: new Date(), status: 'approved' }),
    approved: true,
    cancellation: true,
    decidedByName: 'Alex Manager',
  })
  assert.ok(accepted)
  assert.equal(accepted.type, HOLIDAY_REQUEST_APPROVED)
  assert.equal(accepted.title, 'Annual Leave Cancelled')
  assert.match(accepted.message, /accepted your request to cancel annual leave/)
  assert.equal(accepted.userId, 'op-user-1')
  const refused = buildHolidayRequestDecisionNotification({
    organizationId: 'org-1',
    booking: booking({ cancellationRequestedAt: new Date(), status: 'approved' }),
    approved: false,
    cancellation: true,
    decidedByName: 'Alex Manager',
  })
  assert.equal(refused?.type, HOLIDAY_REQUEST_DECLINED)
  assert.match(refused!.message, /Your leave still stands/)
  // Its own dedupe id: the original approval row keeps its id and read state.
  assert.notEqual(holidayDecisionDedupeKey('B', 'u', true, true), holidayDecisionDedupeKey('B', 'u', true))
  // The decider is never notified about their own decision.
  assert.equal(
    buildHolidayRequestDecisionNotification({
      organizationId: 'org-1',
      booking: booking({ cancellationRequestedAt: new Date() }),
      approved: true,
      cancellation: true,
      decidedByName: 'Self',
      decidedByUserId: 'op-user-1',
    }),
    null
  )
})
