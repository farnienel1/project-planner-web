import assert from 'node:assert/strict'
import test from 'node:test'
import { QUALIFICATION_LIBRARY_SECTIONS } from '../canonical/qualificationSearch.ts'
import { missingStarterQualificationCodes } from '../canonical/organizationSettings.ts'
import { STARTER_QUALIFICATION_LIBRARY } from './starter/starterQualificationLibrary.ts'
import { starterQualificationItems } from './starterLibrary.ts'
import { qualificationTemplateFirestoreFields } from './orgQualificationStorage.ts'

test('the starter qualification library has every row from the source list', () => {
  assert.equal(STARTER_QUALIFICATION_LIBRARY.length, 272)
  const codes = STARTER_QUALIFICATION_LIBRARY.map((row) => row.code)
  assert.equal(new Set(codes).size, 272)
  assert.equal(codes[0], 'EL-ECS-IE')
  assert.equal(codes[codes.length - 1], 'PRO-IOSH')
  const sections = [...new Set(STARTER_QUALIFICATION_LIBRARY.map((row) => row.section))]
  assert.deepEqual(
    sections,
    QUALIFICATION_LIBRARY_SECTIONS.map((row) => row.section)
  )
  assert.equal(
    STARTER_QUALIFICATION_LIBRARY.every((row) => row.subsection && row.name && row.awardingBody && row.status),
    true
  )
})

test('seeded templates use the code as the id and keep iOS template fields', () => {
  const items = starterQualificationItems(new Date('2026-10-09T00:00:00.000Z'))
  assert.equal(items.length, 272)
  const gold = items.find((row) => row.id === 'EL-ECS-IE')
  assert.ok(gold)
  assert.equal(gold.name, 'ECS Installation Electrician (Gold Card)')
  assert.equal(gold.hasEndDate, false)
  assert.equal(gold.section, 'Electrical')
  const fields = qualificationTemplateFirestoreFields(gold)
  assert.equal(fields.name, gold.name)
  assert.equal(fields.hasEndDate, false)
  assert.ok(fields.createdAt)
  assert.ok(fields.updatedAt)
  assert.equal(fields.code, 'EL-ECS-IE')
  assert.equal(fields.section, 'Electrical')
  assert.equal(fields.awardingBody, 'ECS / JIB')
  assert.equal(fields.renewYears, 3)
  assert.equal(fields.renewalType, 'Required')
  assert.equal('endDate' in fields, false)
})

test('an existing organisation still gets missing library codes when a custom row exists', () => {
  const codes = STARTER_QUALIFICATION_LIBRARY.map((row) => row.code)
  assert.equal(missingStarterQualificationCodes([], codes).length, 272)
  assert.equal(missingStarterQualificationCodes(['custom-guided-setup'], codes).length, 272)
  assert.equal(missingStarterQualificationCodes(codes, codes).length, 0)
  assert.equal(missingStarterQualificationCodes(['EL-ECS-IE', 'custom-guided-setup'], codes).length, 271)
})
