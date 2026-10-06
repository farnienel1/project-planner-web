import assert from 'node:assert/strict'
import test from 'node:test'
import type { Operative } from '../../types/index.ts'
import { findOperativeForUser } from './operativeRosterUtils.ts'
import { UserRole, type User } from '../../types/index.ts'

function operative(partial: Partial<Operative> & { id: string }): Operative {
  return {
    firstName: 'Test',
    lastName: 'Operative',
    email: 'op@site.test',
    phone: '',
    startDate: new Date('2026-01-01'),
    hourlyRate: 0,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    organizationId: 'org',
    ...partial,
  }
}

const user = {
  id: 'U1',
  email: 'op@site.test',
  firstName: 'Test',
  surname: 'Operative',
  organizationId: 'org',
  role: UserRole.OPERATIVE,
  isActive: true,
  passwordSet: true,
  isSuperAdmin: false,
  policyAccepted: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  permissions: {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: true,
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: true,
  },
} as User

test('duplicate operative emails keep the profile that holds certificates', () => {
  const emptyNewer = operative({
    id: 'EMPTY',
    updatedAt: new Date('2026-10-05'),
  })
  const withCerts = operative({
    id: 'CERT',
    updatedAt: new Date('2026-09-15'),
    qualifications: [{ id: 'SMSTS', name: 'SMSTS', hasEndDate: true, createdAt: new Date(), updatedAt: new Date() }],
    qualificationCertificateURLs: { SMSTS: 'https://example.test/cert.pdf' },
  })
  const linked = findOperativeForUser(user, [emptyNewer, withCerts])
  assert.equal(linked?.id, 'CERT')
})
