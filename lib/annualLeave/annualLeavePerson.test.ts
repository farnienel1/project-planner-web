import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type Operative, type User } from '../../types/index.ts'
import { buildAnnualLeavePeople } from './annualLeavePerson.ts'

function user(partial: Partial<User> & Pick<User, 'id' | 'email'>): User {
  return {
    firstName: 'Test',
    surname: 'User',
    organizationId: 'org',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: true,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: true,
      smallWorks: true,
      operativeMode: false,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: false,
      subContractors: false,
      siteAudit: false,
      wholesalersOrderHistory: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

test('team annual leave omits pending invitations', () => {
  const people = buildAnnualLeavePeople(
    [
      user({ id: 'admin', email: 'admin@raccord.test', firstName: 'Test', surname: 'Admin', role: UserRole.ADMIN }),
      user({ id: 'invite', email: 'tes@user.co.uk', firstName: 'Test', surname: 'User', passwordSet: false }),
      user({
        id: 'morgan',
        email: 'morgan@raccordmep.co.uk',
        firstName: 'Morgan',
        surname: 'Elliott',
        status: 'pending',
        passwordSet: true,
      }),
    ],
    [
      {
        id: 'op-invite',
        email: 'tes@user.co.uk',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
      } as Operative,
    ]
  )
  assert.deepEqual(
    people.map((person) => person.displayName),
    ['Test Admin']
  )
})
