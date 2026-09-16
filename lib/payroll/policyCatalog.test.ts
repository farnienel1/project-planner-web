import { test } from 'node:test'
import assert from 'node:assert/strict'
import { policyForDay } from './policyCatalog.ts'

test('policyForDay uses current policy on/after effectiveFrom and prior before', () => {
  const current = { standardDayStart: '08:00', standardDayEnd: '17:00' }
  const prior = { standardDayStart: '07:30', standardDayEnd: '16:00' }
  const org = {
    payrollTimePolicy: current,
    payrollTimePolicyPrior: prior,
    payrollTimePolicyEffectiveFrom: '2026-09-01',
  }
  assert.equal(policyForDay(new Date('2026-09-16T12:00:00Z'), org).standardDayStart, '08:00')
  assert.equal(policyForDay(new Date('2026-08-31T12:00:00Z'), org).standardDayStart, '07:30')
  assert.equal(policyForDay(new Date('2026-09-16T12:00:00Z'), null).standardDayStart, '07:30')
})
