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
