import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_INVOICING } from '../settings/organizationSettings.ts'
import { listInvoicingPeriodOptions } from './invoicingPeriodUtils.ts'

test('invoicing period list covers about two years of weekly runs', () => {
  const options = listInvoicingPeriodOptions(DEFAULT_INVOICING, new Date('2026-09-28T12:00:00Z'))
  assert.ok(options.length > 20)
  assert.ok(options.length < 120)
  assert.equal(options[0]?.isCurrent, true)
  const oldest = options[options.length - 1]
  assert.ok(oldest)
  const spanDays = (options[0].end.getTime() - oldest.start.getTime()) / (24 * 60 * 60 * 1000)
  assert.ok(spanDays > 700, `expected about two years, got ${spanDays} days across ${options.length} periods`)
})

test('a fixed count still returns only that many recent periods', () => {
  const options = listInvoicingPeriodOptions(DEFAULT_INVOICING, new Date('2026-09-28T12:00:00Z'), 6)
  assert.equal(options.length, 6)
})
