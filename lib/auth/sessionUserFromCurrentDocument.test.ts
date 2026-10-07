import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { sessionUserFromCurrentDocument } from './sessionUserFromCurrentDocument.ts'

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

test('an unchanged document does not replace the session', () => {
  assert.equal(sessionUserFromCurrentDocument(person(), doc()), null)
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

test('a document for another company does not replace this session', () => {
  const next = sessionUserFromCurrentDocument(person(), doc({ organizationId: 'OTHER', siteAudit: false }))
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
