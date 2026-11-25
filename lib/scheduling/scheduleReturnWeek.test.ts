import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduleReturnHref, scheduleReturnWeekKey, scheduleWeekFromParam } from './scheduleReturnWeek'

const LONDON = 'Europe/London'

test('one day → its Monday', () => {
  assert.equal(scheduleReturnWeekKey(['2026-12-02'], LONDON), '2026-11-30')
})

test('several days in one week → that week', () => {
  assert.equal(scheduleReturnWeekKey(['2026-12-06', '2026-11-30', '2026-12-03'], LONDON), '2026-11-30')
})

test('across weeks → the week of the earliest day (owner example)', () => {
  assert.equal(scheduleReturnWeekKey(['2026-12-08', '2026-12-09', '2026-12-01'], LONDON), '2026-11-30')
})

test('a Sunday belongs to the week that started the Monday before', () => {
  assert.equal(scheduleReturnWeekKey(['2026-12-06'], LONDON), '2026-11-30')
})

test('organisation zone, not the browser: Auckland week of 1 Dec', () => {
  assert.equal(scheduleReturnWeekKey(['2026-12-01'], 'Pacific/Auckland'), '2026-11-30')
})

test('no valid day → base path unchanged', () => {
  assert.equal(scheduleReturnWeekKey([], LONDON), '')
  assert.equal(scheduleReturnWeekKey(['', 'nope'], LONDON), '')
  assert.equal(scheduleReturnHref('/dashboard/projects/p1/schedule', [], LONDON), '/dashboard/projects/p1/schedule')
})

test('href carries the Monday', () => {
  assert.equal(
    scheduleReturnHref('/dashboard/small-works/s1/schedule', ['2026-12-10', '2026-12-02'], LONDON),
    '/dashboard/small-works/s1/schedule?week=2026-11-30'
  )
})

test('param → calendar Monday; junk → null', () => {
  const monday = scheduleWeekFromParam('2026-12-02', LONDON)
  assert.ok(monday)
  assert.equal(monday!.getFullYear(), 2026)
  assert.equal(monday!.getMonth(), 10)
  assert.equal(monday!.getDate(), 30)
  assert.equal(scheduleWeekFromParam(null, LONDON), null)
  assert.equal(scheduleWeekFromParam('30/11/2026', LONDON), null)
})
