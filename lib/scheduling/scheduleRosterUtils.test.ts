import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Operative, type User } from '../../types/index.ts'
import { buildSchedulablePeople, filterSchedulablePeople } from './scheduleRosterUtils.ts'

function perms(partial: Partial<User['permissions']> = {}): User['permissions'] {
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

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Admin',
    organizationId: 'org',
    role: UserRole.ADMIN,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: perms(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as User
}

function operative(partial: Partial<Operative> & { id: string; email: string }): Operative {
  return {
    firstName: 'Ada',
    lastName: 'Admin',
    phone: '',
    startDate: new Date('2026-01-01T00:00:00Z'),
    hourlyRate: 20,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    organizationId: 'org',
    ...partial,
  } as Operative
}

test('admin and manager with operative profiles appear once, with their role badge', () => {
  const admin = user({
    id: 'U-ADMIN',
    email: 'admin@site.test',
    firstName: 'Ada',
    surname: 'Admin',
    isSuperAdmin: true,
    permissions: perms({ adminAccess: true, manager: true }),
  })
  const manager = user({
    id: 'U-MGR',
    email: 'boss@site.test',
    firstName: 'Morgan',
    surname: 'Manager',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true }),
  })
  const people = buildSchedulablePeople(
    [
      operative({ id: 'OP-ADMIN', email: 'admin@site.test', firstName: 'Ada', lastName: 'Admin' }),
      operative({ id: 'OP-MGR', email: 'boss@site.test', firstName: 'Morgan', lastName: 'Manager' }),
      operative({ id: 'OP-FIELD', email: 'field@site.test', firstName: 'Fay', lastName: 'Field' }),
    ],
    [admin, manager]
  )

  const emails = people.map((row) => row.email.toLowerCase())
  assert.equal(emails.filter((email) => email === 'admin@site.test').length, 1)
  assert.equal(emails.filter((email) => email === 'boss@site.test').length, 1)
  assert.equal(people.find((row) => row.email === 'admin@site.test')?.badge, 'Admin')
  assert.equal(people.find((row) => row.email === 'boss@site.test')?.badge, 'Manager')
  assert.equal(people.find((row) => row.email === 'field@site.test')?.badge, 'Operative')
  assert.equal(people.length, 3)
})

test('manager filter includes admins; operative filter excludes them', () => {
  const people = buildSchedulablePeople(
    [operative({ id: 'OP-ADMIN', email: 'admin@site.test' })],
    [
      user({
        id: 'U-ADMIN',
        email: 'admin@site.test',
        permissions: perms({ adminAccess: true, manager: true }),
      }),
    ]
  )
  assert.equal(filterSchedulablePeople(people, '', 'manager').length, 1)
  assert.equal(filterSchedulablePeople(people, '', 'operative').length, 0)
})
