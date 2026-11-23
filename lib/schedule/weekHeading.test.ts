import assert from 'node:assert/strict'
import test from 'node:test'
import { myScheduleWeekHeading } from './weekHeading'

test('My Schedule week heading names the Monday to Sunday shown', () => {
  assert.equal(myScheduleWeekHeading(new Date(2026, 10, 23), new Date(2026, 10, 29)), 'Mon 23 – Sun 29 Nov 2026')
  assert.equal(myScheduleWeekHeading(new Date(2026, 10, 30), new Date(2026, 11, 6)), 'Mon 30 Nov – Sun 6 Dec 2026')
  assert.equal(myScheduleWeekHeading(new Date(2026, 11, 28), new Date(2027, 0, 3)), 'Mon 28 Dec 2026 – Sun 3 Jan 2027')
})
