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
  const field = user({
    id: 'U-FIELD',
    email: 'field@site.test',
    firstName: 'Fay',
    surname: 'Field',
    role: UserRole.OPERATIVE,
    permissions: perms({ operativeMode: true }),
  })
  const people = buildSchedulablePeople(
    [
      operative({ id: 'OP-ADMIN', email: 'admin@site.test', firstName: 'Ada', lastName: 'Admin' }),
      operative({ id: 'OP-MGR', email: 'boss@site.test', firstName: 'Morgan', lastName: 'Manager' }),
      operative({ id: 'OP-FIELD', email: 'field@site.test', firstName: 'Fay', lastName: 'Field' }),
    ],
    [admin, manager, field]
  )

  const emails = people.map((row) => row.email.toLowerCase())
  assert.equal(emails.filter((email) => email === 'admin@site.test').length, 1)
  assert.equal(emails.filter((email) => email === 'boss@site.test').length, 1)
  assert.equal(people.find((row) => row.email === 'admin@site.test')?.badge, 'Admin')
  assert.equal(people.find((row) => row.email === 'boss@site.test')?.badge, 'Manager')
  assert.equal(people.find((row) => row.email === 'field@site.test')?.badge, 'Operative')
  assert.equal(people.length, 3)
})

test('a named catalogue operative stays bookable, and a role used as a name is not', () => {
  const ghost = buildSchedulablePeople(
    [operative({ id: 'OP-GHOST', email: 'p@ekecteic.con', firstName: 'P', lastName: 'N' })],
    []
  )
  assert.deepEqual(ghost.map((row) => row.name), ['P N'])

  const roleNamed = buildSchedulablePeople(
    [operative({ id: 'OP-FIELD', email: 'field@site.test', firstName: 'Test', lastName: 'Operative' })],
    [
      user({
        id: 'U-ROLE',
        email: '',
        firstName: 'Manager',
        surname: '',
        role: UserRole.MANAGER,
        permissions: perms({ manager: true }),
      }),
      user({
        id: 'U-ADMIN',
        email: 'admin@site.test',
        firstName: 'Test',
        surname: 'Admin',
        permissions: perms({ adminAccess: true, manager: true }),
      }),
      user({
        id: 'U-MGR',
        email: 'boss@site.test',
        firstName: 'Test',
        surname: 'Manager',
        role: UserRole.MANAGER,
        permissions: perms({ manager: true }),
      }),
      user({
        id: 'U-OP',
        email: 'field@site.test',
        firstName: 'Test',
        surname: 'Operative',
        role: UserRole.OPERATIVE,
        permissions: perms({ operativeMode: true }),
      }),
    ]
  )
  const names = roleNamed.map((row) => row.name).sort()
  assert.deepEqual(names, ['Test Admin', 'Test Manager', 'Test Operative'])
  assert.equal(roleNamed.some((row) => row.name === 'Manager'), false)
})

test('an anonymised Deleted user is not a person you can schedule', () => {
  const people = buildSchedulablePeople(
    [operative({ id: 'OP-DEL', email: '', firstName: 'Deleted', lastName: 'user' })],
    [
      user({
        id: 'QAlPe29vLLP4spK554UtpaBLW7N2',
        email: '',
        firstName: 'Deleted',
        surname: 'user',
        role: UserRole.OPERATIVE,
        permissions: perms({ operativeMode: true }),
      }),
      user({
        id: 'U-MGR',
        email: '',
        firstName: 'Deleted',
        surname: 'user',
        role: UserRole.MANAGER,
        permissions: perms({ manager: true }),
      }),
    ]
  )
  assert.equal(people.some((row) => row.name === 'Deleted user'), false)
  assert.equal(people.length, 0)
})

test('a pending manager invitation is not a person you can schedule', () => {
  const pending = user({
    id: 'U-PENDING',
    email: 'morgan@site.test',
    firstName: 'Morgan',
    surname: 'Elliott',
    role: UserRole.MANAGER,
    status: 'pending',
    passwordSet: true,
    permissions: perms({ manager: true }),
  })
  const people = buildSchedulablePeople(
    [operative({ id: 'OP-PENDING', email: 'morgan@site.test', firstName: 'Morgan', lastName: 'Elliott' })],
    [pending]
  )
  assert.equal(people.some((row) => row.email === 'morgan@site.test'), false)
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

test('a role-only name is not shown, and the linked account email is used instead', () => {
  const people = buildSchedulablePeople(
    [
      operative({ id: 'OP-FIELD', email: 'field@site.test', firstName: 'Fay', lastName: 'Field' }),
      operative({ id: 'OP-ROLE', email: 'role@site.test', firstName: 'Manager', lastName: '' }),
    ],
    [
      user({
        id: 'U-FIELD',
        email: 'field@site.test',
        firstName: 'Fay',
        surname: 'Field',
        role: UserRole.OPERATIVE,
        permissions: perms({ operativeMode: true }),
      }),
      user({
        id: 'U-ROLE',
        email: 'role@site.test',
        firstName: 'Manager',
        surname: '',
        role: UserRole.MANAGER,
        permissions: perms({ manager: true }),
      }),
    ]
  )
  assert.equal(people.find((row) => row.email === 'field@site.test')?.name, 'Fay Field')
  assert.equal(people.some((row) => row.name === 'Manager'), false)
  assert.equal(people.find((row) => row.id === 'OP-ROLE')?.name, 'role@site.test')
})

test('a pending operative invite with no operative record can be scheduled, and the Deleted user cannot', () => {
  const pending = user({
    id: '57CC31FC-1111-4222-8333-ABCDEF123456',
    email: 'farnienel@hotmail.com',
    firstName: 'Test',
    surname: 'Operative',
    role: UserRole.OPERATIVE,
    passwordSet: false,
    isActive: true,
    permissions: perms({ operativeMode: true }),
  })
  const tombstone = user({
    id: 'QAlPe29vLLP4spK554UtpaBLW7N2',
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    role: UserRole.OPERATIVE,
    passwordSet: true,
    isActive: true,
    permissions: perms({ operativeMode: true }),
  })
  const people = buildSchedulablePeople([], [pending, tombstone])
  assert.deepEqual(
    people.map((row) => ({ id: row.id, kind: row.kind, name: row.name, badge: row.badge })),
    [{ id: pending.id, kind: 'operative', name: 'Test Operative', badge: 'Operative' }]
  )
  assert.equal(people.some((row) => row.id === tombstone.id), false)
})

test('an accepted operative-list user with no operative record is schedulable, an inactive one is not', () => {
  const people = buildSchedulablePeople(
    [],
    [
      user({
        id: 'U-LIVE',
        email: 'live@site.test',
        firstName: 'Lee',
        surname: 'Live',
        role: UserRole.OPERATIVE,
        permissions: perms({ operativeMode: true }),
      }),
      user({
        id: 'U-OFF',
        email: 'off@site.test',
        firstName: 'Olly',
        surname: 'Off',
        role: UserRole.OPERATIVE,
        isActive: false,
        permissions: perms({ operativeMode: true }),
      }),
    ]
  )
  assert.deepEqual(people.map((row) => row.id), ['U-LIVE'])
})

test('a user and an operative that share an email are one row, whether pending or accepted', () => {
  for (const passwordSet of [false, true]) {
    const people = buildSchedulablePeople(
      [operative({ id: 'OP-PAT', email: 'Pat@Site.test', firstName: 'Pat', lastName: 'Op' })],
      [
        user({
          id: 'U-PAT',
          email: 'pat@site.test',
          firstName: 'Pat',
          surname: 'Op',
          role: UserRole.OPERATIVE,
          passwordSet,
          permissions: perms({ operativeMode: true }),
        }),
      ]
    )
    assert.deepEqual(people.map((row) => row.id), ['OP-PAT'])
  }
})

test('a leftover Deleted-user operative record does not hide a re-added pending operative', () => {
  const people = buildSchedulablePeople(
    [operative({ id: 'OP-DEL', email: '', firstName: 'Deleted', lastName: 'user' })],
    [
      user({
        id: 'U-NEW',
        email: 'new@site.test',
        firstName: 'New',
        surname: 'Starter',
        role: UserRole.OPERATIVE,
        passwordSet: false,
        permissions: perms({ operativeMode: true }),
      }),
    ]
  )
  assert.deepEqual(people.map((row) => row.id), ['U-NEW'])
})

test('a pending admin or manager-only invite is still not schedulable', () => {
  const people = buildSchedulablePeople(
    [],
    [
      user({
        id: 'U-PEND-MGR',
        email: 'm@site.test',
        role: UserRole.MANAGER,
        passwordSet: false,
        permissions: perms({ manager: true }),
      }),
      user({
        id: 'U-PEND-ADM',
        email: 'a@site.test',
        passwordSet: false,
        permissions: perms({ adminAccess: true, manager: true }),
      }),
    ]
  )
  assert.equal(people.length, 0)
})
