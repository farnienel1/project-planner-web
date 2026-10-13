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
