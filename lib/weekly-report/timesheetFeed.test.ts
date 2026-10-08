import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WeeklyReportLabourLine, WeeklyReportOverride } from '../timesheets/timesheetDraft.ts'
import { mergeDuplicatePersonWeeks, type ApprovedTimesheetWeek } from './timesheetFeed.ts'

const weekStart = new Date('2026-10-01T00:00:00Z')
const weekEnd = new Date('2026-10-16T00:00:00Z')
const day = new Date('2026-10-08T12:00:00+01:00')

function line(partial: Partial<WeeklyReportLabourLine> & Pick<WeeklyReportLabourLine, 'id' | 'bookingId'>): WeeklyReportLabourLine {
  return {
    date: day,
    jobNumber: 'C984',
    projectName: '71 Broadwick Street',
    locationKind: 'project',
    details: '',
    paidHours: 8,
    days: 1,
    amount: 200,
    isOvertime: false,
    decision: 'approved',
    ...partial,
  }
}

function override(lines: WeeklyReportLabourLine[]): WeeklyReportOverride {
  return {
    approvedAt: day,
    approvedByUserId: 'admin',
    approvedByName: 'Test Admin',
    selfSigned: false,
    lines,
    priceWork: [],
    expenses: [],
  }
}

function week(userId: string, lines: WeeklyReportLabourLine[]): ApprovedTimesheetWeek {
  return {
    userId,
    personName: 'Test Manager',
    role: 'Admin User',
    trade: userId === 'U-NAMED' ? 'Electrician' : 'General',
    weekStart,
    weekEnd,
    override: override(lines),
  }
}

const people = [
  { id: 'U-BLANK', email: 'boss@site.test' },
  { id: 'U-NAMED', email: 'boss@site.test' },
  { id: 'U-OTHER', email: 'op@site.test' },
]

test('approved weeks for the same email count a shared booking once and keep a unique one', () => {
  const shared = line({ id: 'a', bookingId: 'book-shared' })
  const onlyNamed = line({ id: 'b', bookingId: 'book-named', paidHours: 4, days: 0.5, amount: 100 })
  const onlyBlank = line({ id: 'c', bookingId: 'book-blank', jobNumber: 'C734', projectName: '6 Lowndes Square' })
  const merged = mergeDuplicatePersonWeeks(
    [week('U-NAMED', [shared, onlyNamed]), week('U-BLANK', [shared, onlyBlank])],
    people
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.userId, 'U-NAMED')
  assert.equal(merged[0]?.trade, 'Electrician')
  assert.deepEqual(
    merged[0]?.override.lines.map((row) => row.bookingId).sort(),
    ['book-blank', 'book-named', 'book-shared']
  )
})

test('two people with different emails both stay on the report', () => {
  const merged = mergeDuplicatePersonWeeks(
    [week('U-NAMED', [line({ id: 'a', bookingId: 'book-a' })]), week('U-OTHER', [line({ id: 'b', bookingId: 'book-a' })])],
    people
  )
  assert.equal(merged.length, 2)
})
