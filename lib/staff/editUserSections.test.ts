/**
 * 17 Nov owner bug: web Edit User hid Employment type and the Annual leave allowance for every Super Admin
 * (`!target.isSuperAdmin`, commit 69099425, 24 Jun), so a Super Admin could never be set to PAYE. The rulebook hides
 * neither for any level (§4.4, §8). These tests lock that every level — operative, manager, admin, Super Admin — shows
 * both sections, and that the Data health list still names a Super Admin with no stored employment type.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { User } from '../../types/index.ts'
import {
  editUserAnnualLeaveSection,
  editUserEmploymentTypeSection,
  editUserTaxIdsSectionShown,
  SUPER_ADMIN_PROFILE_READ_ONLY_NOTE,
} from './editUserSections.ts'
import { missingEmploymentTypeRows } from '../dataHealth/missingEmploymentTypeRows.ts'

function user(id: string, fields: Partial<User> & { permissions?: Record<string, boolean> }): User {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id,
    surname: 'Test',
    isActive: true,
    passwordSet: true,
    organizationId: 'org-1',
    ...fields,
    permissions: { ...(fields.permissions ?? {}) },
  } as unknown as User
}

const superAdmin = user('super-1', { isSuperAdmin: true, role: 'admin', permissions: { adminAccess: true } } as never)
const admin = user('admin-1', { role: 'admin', permissions: { adminAccess: true } } as never)
const manager = user('mgr-1', { role: 'manager', permissions: { manager: true } } as never)
const operative = user('op-1', { role: 'operative', permissions: { operativeMode: true } } as never)
const ghost = user('ghost-1', { role: 'operative', ghost: true, email: '', permissions: { operativeMode: true } } as never)
const roster = [superAdmin, admin, manager, operative, ghost]

const LEVELS: Array<[string, User]> = [
  ['operative', operative],
  ['manager', manager],
  ['admin', admin],
  ['Super Admin', superAdmin],
]

for (const [label, target] of LEVELS) {
  test(`Edit User shows and lets the Super Admin change employment type and the leave allowance of: ${label}`, () => {
    const employment = editUserEmploymentTypeSection(superAdmin, target, roster)
    assert.equal(employment.shown, true)
    assert.equal(employment.editable, true)
    assert.equal(employment.note, null)
    const leave = editUserAnnualLeaveSection(superAdmin, target)
    assert.equal(leave.shown, true)
    assert.equal(leave.editable, true)
  })

  test(`an admin's Edit User shows employment type and the leave allowance of: ${label}`, () => {
    const employment = editUserEmploymentTypeSection(admin, target, roster)
    const leave = editUserAnnualLeaveSection(admin, target)
    assert.equal(employment.shown, true)
    assert.equal(leave.shown, true)
  })
}

test('the Super Admin edits their own employment type and leave allowance (the owner bug)', () => {
  assert.deepEqual(editUserEmploymentTypeSection(superAdmin, superAdmin, roster), { shown: true, editable: true, note: null })
  assert.deepEqual(editUserAnnualLeaveSection(superAdmin, superAdmin), { shown: true, editable: true, note: null })
})

test("another admin sees the Super Admin's employment type and leave read-only, with the reason", () => {
  assert.deepEqual(editUserEmploymentTypeSection(admin, superAdmin, roster), {
    shown: true,
    editable: false,
    note: SUPER_ADMIN_PROFILE_READ_ONLY_NOTE,
  })
  assert.deepEqual(editUserAnnualLeaveSection(admin, superAdmin), {
    shown: true,
    editable: false,
    note: SUPER_ADMIN_PROFILE_READ_ONLY_NOTE,
  })
})

test('a ghost never shows an employment type (always self-employed, §11); its leave allowance stays', () => {
  assert.equal(editUserEmploymentTypeSection(superAdmin, ghost, roster).shown, false)
  assert.equal(editUserAnnualLeaveSection(superAdmin, ghost).shown, true)
})

test('nobody signed in sees nothing', () => {
  assert.equal(editUserEmploymentTypeSection(null, operative, roster).shown, false)
  assert.equal(editUserAnnualLeaveSection(null, operative).shown, false)
})

test('Edit User never hides employment type or the leave allowance with isSuperAdmin again', async () => {
  const { superAdminHidesPayFieldHits } = await import('../../scripts/check-second-calculators.mjs')
  const source = readFileSync(new URL('../../components/users/EditUserProfile.tsx', import.meta.url), 'utf8')
  // The CI guard's own reading of the file: only the allow-listed legacy "Timesheets enabled" gate is left.
  const hits = (superAdminHidesPayFieldHits(source) as Array<{ text: string }>).map((hit) => hit.text)
  assert.deepEqual(hits, ['const showPayrollFields ='])
  // Both sections come from the helpers, exactly.
  assert.match(source, /\n\s*const showEmploymentType = employmentTypeSection\.shown\n/)
  assert.match(source, /\n\s*const showAnnualLeave = annualLeaveSection\.shown\n/)
})

test('VAT / UTR follow canViewSensitiveProfile for every level (review of #385)', () => {
  for (const [, target] of LEVELS) {
    assert.equal(editUserTaxIdsSectionShown({ target, viewerMaySee: true, shownBefore: false }), true)
    assert.equal(editUserTaxIdsSectionShown({ target, viewerMaySee: false, shownBefore: false }), false)
  }
  // Operatives managers who saw "Held by admin" before still do.
  assert.equal(editUserTaxIdsSectionShown({ target: operative, viewerMaySee: false, shownBefore: true }), true)
  assert.equal(editUserTaxIdsSectionShown({ target: ghost, viewerMaySee: true, shownBefore: true }), false)
  assert.equal(editUserTaxIdsSectionShown({ target: null, viewerMaySee: true, shownBefore: true }), false)
})

test('Data health lists a Super Admin whose employment type is not stored', () => {
  const rows = missingEmploymentTypeRows([
    { id: 'super-1', email: 'super@example.com', firstName: 'Sue', surname: 'Per', isSuperAdmin: true, role: 'admin', isActive: true },
    { id: 'admin-1', email: 'admin@example.com', role: 'admin', employmentType: 'paye', isActive: true },
    { id: 'op-1', email: 'op@example.com', role: 'operative', employmentType: 'self_employed', isActive: true },
  ])
  assert.deepEqual(rows, [{ id: 'super-1', firstName: 'Sue', surname: 'Per', email: 'super@example.com' }])
})
