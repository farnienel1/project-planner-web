import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinationFromInboxRow, hrefForNotificationDestination, inboxNotificationHref } from './notificationHref.ts'
import type { User } from '@/types'
import { UserRole } from '@/types'

function user(overrides: Partial<User> & { adminAccess?: boolean; manager?: boolean; operativeMode?: boolean }): User {
  return {
    id: 'u1',
    email: 'a@b.c',
    firstName: 'A',
    surname: 'B',
    role: overrides.role ?? UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    organizationId: 'org',
    policyAccepted: true,
    permissions: {
      adminAccess: overrides.adminAccess === true,
      manager: overrides.manager !== false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: true,
      projects: true,
      smallWorks: true,
      operativeMode: overrides.operativeMode === true,
      annualLeaveSelfBook: false,
      weeklyReports: true,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
      developerAccess: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

test('web maps booking destinations for admin, manager, and operative', () => {
  const row = {
    type: 'booking_created',
    relatedId: 'JOB-1',
    dayKey: '2026-10-12',
    catalogue: 'projects' as const,
  }
  assert.equal(
    hrefForNotificationDestination(destinationFromInboxRow(row, 'admin')),
    '/dashboard/daily-overview?date=2026-10-12'
  )
  assert.equal(
    hrefForNotificationDestination(destinationFromInboxRow(row, 'manager')),
    '/dashboard/projects/JOB-1/schedule?date=2026-10-12'
  )
  assert.equal(
    hrefForNotificationDestination(destinationFromInboxRow(row, 'operative')),
    '/dashboard/my-schedule?date=2026-10-12'
  )
})

test('web falls back when a record id is missing and unknown types open the inbox', () => {
  assert.equal(
    hrefForNotificationDestination(destinationFromInboxRow({ type: 'project_created' }, 'admin')),
    '/dashboard/projects'
  )
  assert.equal(
    hrefForNotificationDestination(destinationFromInboxRow({ type: 'not_a_real_type' }, 'manager')),
    '/dashboard/notifications'
  )
  assert.equal(
    inboxNotificationHref({ type: 'client_created', relatedId: 'C1' }, user({ adminAccess: true, role: UserRole.ADMIN })),
    '/dashboard/clients/C1'
  )
})

test('1.78.0 timesheet_signoff_reminder opens User Timesheets → Awaiting sign-off for that pay run', () => {
  const href = inboxNotificationHref({ type: 'timesheet_signoff_reminder', relatedId: '2026-12-05', dayKey: '2026-11-16' }, user({ manager: true }))
  assert.equal(href, '/dashboard/timesheets/team?tab=awaiting&period=2026-11-16')
})

test('1.79.0 toolbox, variation and material notices open the job section they are about', () => {
  const manager = user({ manager: true })
  const operative = user({ manager: false, operativeMode: true, role: UserRole.OPERATIVE })
  // Toolbox talks: the job's Health & safety.
  assert.equal(
    inboxNotificationHref({ type: 'toolbox_talk_issued', relatedId: 'JOB-1', catalogue: 'projects' }, operative),
    '/dashboard/projects/JOB-1/health-safety'
  )
  assert.equal(
    inboxNotificationHref({ type: 'hs_toolbox_reminder', relatedId: 'SW-1', catalogue: 'smallWorks' }, operative),
    '/dashboard/small-works/SW-1/health-safety'
  )
  // An older row with no catalogue: the resolver looks the id up among the loaded jobs.
  assert.equal(
    inboxNotificationHref({ type: 'toolbox_talk_issued', relatedId: 'ISSUE-9' }, operative),
    '/dashboard/notifications/open?job=ISSUE-9&section=health-safety'
  )
  // Variations: that variation (the Variations page finds its job and opens it there).
  assert.equal(inboxNotificationHref({ type: 'variation', relatedId: 'V-1' }, manager), '/dashboard/variations?open=V-1')
  assert.equal(
    inboxNotificationHref({ type: 'variation_renumbered', relatedId: 'JOB-1', catalogue: 'projects' }, manager),
    '/dashboard/projects/JOB-1/variations'
  )
  // Materials: the job's Materials; with no job, Wholesalers.
  assert.equal(
    inboxNotificationHref({ type: 'material_order_placed', relatedId: 'JOB-2', catalogue: 'smallWorks' }, manager),
    '/dashboard/small-works/JOB-2/materials'
  )
  assert.equal(
    inboxNotificationHref({ type: 'material_order_placed', relatedId: 'JOB-2' }, manager),
    '/dashboard/notifications/open?job=JOB-2&section=materials'
  )
  assert.equal(inboxNotificationHref({ type: 'material_order_placed' }, manager), '/dashboard/wholesalers')
})
