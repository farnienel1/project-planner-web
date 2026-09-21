import { test } from 'node:test'
import assert from 'node:assert/strict'
import { employmentTypeOnDay, isBillableSelfEmployedDay } from './employmentType.ts'

const base = {
  employmentType: 'paye',
  employmentTypeTransitionFrom: 'self_employed',
  employmentTypeEffectiveAt: new Date('2026-10-01T00:00:00Z'),
}

test('employmentTypeOnDay uses the scheduled transition like iOS AppUser.employmentType(on:)', () => {
  assert.equal(employmentTypeOnDay(base, new Date('2026-09-30T12:00:00Z'), 'Europe/London'), 'self_employed')
  assert.equal(employmentTypeOnDay(base, new Date('2026-10-01T12:00:00Z'), 'Europe/London'), 'paye')
  assert.equal(
    isBillableSelfEmployedDay(base, new Date('2026-09-30T12:00:00Z'), 'Europe/London'),
    true
  )
  assert.equal(
    isBillableSelfEmployedDay(base, new Date('2026-10-01T12:00:00Z'), 'Europe/London'),
    false
  )
})

test('employmentTypeOnDay without a transition returns the current type', () => {
  assert.equal(
    employmentTypeOnDay({ employmentType: 'self_employed' }, new Date('2026-09-21T12:00:00Z')),
    'self_employed'
  )
})
