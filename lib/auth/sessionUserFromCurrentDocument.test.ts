import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { sessionUserFromCurrentDocument } from './sessionUserFromCurrentDocument.ts'
import { parseAppUserDocument } from '../ios-parity/converters.ts'

function perms(partial: Partial<UserPermissions>): UserPermissions {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function person(partial: Partial<User> = {}): User {
  return {
    id: 'OP1',
    email: 'op@example.com',
    firstName: 'Test',
    surname: 'Operative',
    organizationId: 'ORG',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-07T06:00:00Z'),
    permissions: perms({}),
    ...partial,
  }
}

function doc(partial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'op@example.com',
    organizationId: 'ORG',
    role: 'operative',
    firstName: 'Test',
    surname: 'Operative',
    isActive: true,
    passwordSet: true,
    operativeMode: true,
    materials: true,
    siteAudit: true,
    updatedAt: new Date('2026-10-07T06:10:00Z'),
    ...partial,
  }
}

test('a newer user document turns site audit off for the signed-in operative', () => {
  const next = sessionUserFromCurrentDocument(person(), doc({ siteAudit: false }))
  assert.ok(next)
  assert.equal(next?.permissions.siteAudit, false)
  assert.equal(next?.permissions.materials, true)
  assert.equal(next?.permissions.operativeMode, true)
  assert.equal(next?.organizationId, 'ORG')
})

/** The session user as sign-in builds it: parsed from the same users/{uid} document. */
function signedIn(): User {
  const parsed = parseAppUserDocument('OP1', doc())
  assert.ok(parsed.ok)
  return parsed.value
}

test('an unchanged document does not replace the session', () => {
  assert.equal(sessionUserFromCurrentDocument(signedIn(), doc()), null)
})

test('an older snapshot does not undo a newer profile already in memory', () => {
  const current = person({
    updatedAt: new Date('2026-10-07T06:20:00Z'),
    permissions: perms({ siteAudit: false }),
  })
  const next = sessionUserFromCurrentDocument(
    current,
    doc({ siteAudit: true, updatedAt: new Date('2026-10-07T06:00:00Z') })
  )
  assert.equal(next, null)
})


test('a stray operative flag on an administrator document does not remove admin access', () => {
  const admin = person({
    id: 'AD1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    permissions: perms({ adminAccess: true, manager: true, operativeMode: false, siteAudit: true }),
  })
  const next = sessionUserFromCurrentDocument(
    admin,
    doc({
      email: 'admin@example.com',
      role: 'admin',
      adminAccess: true,
      manager: true,
      operativeMode: true,
      siteAudit: false,
    })
  )
  assert.ok(next)
  assert.equal(next?.permissions.adminAccess, true)
  assert.equal(next?.permissions.operativeMode, false)
  assert.equal(next?.role, UserRole.ADMIN)
  assert.equal(next?.isSuperAdmin, false)
})

test('a photo, mobile, line manager and rate saved on iOS show live in this session', () => {
  const next = sessionUserFromCurrentDocument(
    person(),
    doc({
      profilePhotoURL: 'https://example.com/new.jpg',
      mobileNumber: '07700 900123',
      assignedManagerUserIds: ['MGR1'],
      assignedManagerUserId: 'MGR1',
      payBasis: 'day',
      dayRate: 210,
      employmentType: 'paye',
    })
  )
  assert.ok(next)
  assert.equal(next?.profilePhotoURL, 'https://example.com/new.jpg')
  assert.equal(next?.mobileNumber, '07700 900123')
  assert.equal(next?.assignedManagerUserId, 'MGR1')
  assert.equal(next?.dayRate, 210)
  assert.equal(next?.employmentType, 'paye')
  assert.equal(next?.organizationId, 'ORG')
})

test('another company open in this browser still takes the personal fields, not access', () => {
  const next = sessionUserFromCurrentDocument(
    person(),
    doc({ organizationId: 'OTHER', siteAudit: false, profilePhotoURL: 'https://example.com/p.jpg', firstName: 'New' })
  )
  assert.ok(next)
  assert.equal(next?.firstName, 'New')
  assert.equal(next?.profilePhotoURL, 'https://example.com/p.jpg')
  assert.equal(next?.permissions.siteAudit, true)
  assert.equal(next?.organizationId, 'ORG')
})

test('only a lastSeenAt change does not republish the session', () => {
  assert.equal(sessionUserFromCurrentDocument(signedIn(), doc({ lastSeenAt: new Date('2026-10-07T06:30:00Z') })), null)
})

test('the private VAT and UTR values in memory are not cleared by the users document', () => {
  const next = sessionUserFromCurrentDocument(person({ vatNumber: 'GB123', utrNumber: '999' }), doc({ firstName: 'Renamed' }))
  assert.equal(next?.vatNumber, 'GB123')
  assert.equal(next?.utrNumber, '999')
})

test('a document for another company does not change access in this session', () => {
  const next = sessionUserFromCurrentDocument(person(), doc({ organizationId: 'OTHER', siteAudit: false }))
  assert.equal(next, null)
})
