/**
 * iOS parity source: Views/HomeOverviewCustomization.swift, HomeUpNextSupport.swift
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeHomeOverviewMetrics } from './overviewMetrics.ts'
import { upcomingRows, sortDateOperativeBooking, DEFAULT_PAYROLL_TIME_POLICY } from './upNext.ts'
import type { Booking, Operative, Project, ProjectTask, User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'

function perms(partial: Partial<UserPermissions> = {}): UserPermissions {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

test('computeHomeOverviewMetrics counts assigned due-today tasks and skips completed', () => {
  const today = new Date('2026-09-16T12:00:00+01:00')
  const tasks: ProjectTask[] = [
    {
      id: '1',
      organizationId: 'O',
      projectId: 'P',
      title: 'Open',
      details: '',
      createdBy: 'a@b.com',
      status: 'To Do',
      priority: 'Normal',
      assignedOperativeId: 'OP1',
      dueDate: new Date('2026-09-16T08:00:00+01:00'),
      createdAt: today,
      updatedAt: today,
    },
    {
      id: '2',
      organizationId: 'O',
      projectId: 'P',
      title: 'Done',
      details: '',
      createdBy: 'a@b.com',
      status: 'Completed',
      priority: 'Normal',
      assignedOperativeId: 'OP1',
      dueDate: new Date('2026-09-16T08:00:00+01:00'),
      createdAt: today,
      updatedAt: today,
    },
  ]
  const operatives: Operative[] = [
    {
      id: 'OP1',
      firstName: 'Sam',
      lastName: 'Op',
      email: 'sam@x.com',
      startDate: today,
      hourlyRate: 0,
      skills: [],
      qualifications: [],
      isActive: true,
      createdAt: today,
      updatedAt: today,
    },
  ]
  const metrics = computeHomeOverviewMetrics({
    tasks,
    userEmail: 'sam@x.com',
    isOperativeMode: true,
    operatives,
    managers: [],
    bookings: [],
    managerBookings: [],
    holidays: [],
    organizationUsers: [],
    liveProjectCount: 3,
    now: today,
  })
  assert.equal(metrics.tasksDueToday, 1)
  assert.equal(metrics.outstandingTasksAllUsers, 1)
  assert.equal(metrics.liveProjectCount, 3)
})

test('Up Next skips cancelled bookings and sorts by payroll start', () => {
  const now = new Date('2026-09-16T06:00:00+01:00')
  const booking = (id: string, status: string, start: string): Booking => ({
    id,
    operativeId: 'OP1',
    projectId: 'P1',
    date: new Date('2026-09-16T00:00:00+01:00'),
    timeSlot: 'AM',
    bookedBy: 'U1',
    status,
    workStartTime: start,
    createdAt: now,
    updatedAt: now,
  })
  const rows = upcomingRows({
    limit: 10,
    now,
    currentUserEmail: 'sam@x.com',
    operatives: [
      {
        id: 'OP1',
        firstName: 'Sam',
        lastName: 'Op',
        email: 'sam@x.com',
        startDate: now,
        hourlyRate: 0,
        skills: [],
        qualifications: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    bookings: [booking('A', 'Cancelled', '09:00'), booking('B', 'Confirmed', '08:00'), booking('C', 'Tentative', '10:00')],
    managerBookings: [],
    allProjects: [
      {
        id: 'P1',
        jobNumber: '100',
        siteName: 'Hall',
        addressLine1: '',
        townCity: '',
        postcode: '',
        client: { id: 'C', name: 'Acme', createdAt: now, updatedAt: now },
        startDate: now,
        endDate: now,
        jobType: 'CAT A',
        manager: { name: 'Custom', email: '' },
        isLive: true,
        createdAt: now,
        updatedAt: now,
      } as Project,
    ],
    organizationUsers: [
      {
        id: 'U1',
        email: 'boss@x.com',
        firstName: 'Bo',
        surname: 'Ss',
        organizationId: 'O',
        role: UserRole.ADMIN,
        isActive: true,
        passwordSet: true,
        isSuperAdmin: false,
        permissions: perms({ adminAccess: true }),
        policyAccepted: true,
        createdAt: now,
        updatedAt: now,
      } as User,
    ],
  })
  assert.deepEqual(
    rows.map((r) => r.id),
    ['B', 'C']
  )
  const early = sortDateOperativeBooking(booking('B', 'Confirmed', '08:00'), DEFAULT_PAYROLL_TIME_POLICY)
  const late = sortDateOperativeBooking(booking('C', 'Tentative', '10:00'), DEFAULT_PAYROLL_TIME_POLICY)
  assert.equal(early.getTime() < late.getTime(), true)
})
