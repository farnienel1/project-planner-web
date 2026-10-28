import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateFromDayKey } from '../ios-parity/londonTime.ts'
import { orderWarningListItems } from './warningListOrder.ts'
import type { UnbookedLabourDayGroup, UnbookedLabourWarning } from './unbookedLabourWarnings.ts'
import type { LeaveCoverageWarning } from './leaveCoverageWarnings.ts'
import type { MissedMaterialOrderWarning } from './materialOrderWarnings.ts'
import type { QualificationExpiryWarning, UnverifiedOperativeWarning } from './generateOrgWarnings.ts'
import type { ManagerBookingClashWarning } from './managerClashWarnings.ts'
import type { OperativeBookingClashWarning } from '../scheduling/bookingClashUtils.ts'

function person(id: string, date: Date): UnbookedLabourWarning {
  return {
    id,
    operativeId: id,
    operativeName: id,
    date,
    message: id,
    missingHours: 8,
  }
}

function unbooked(dayKey: string): UnbookedLabourDayGroup {
  const date = dateFromDayKey(dayKey)
  return { id: dayKey, date, people: [person(`u-${dayKey}`, date)] }
}

function leave(id: string, day: string): LeaveCoverageWarning {
  return {
    id,
    kind: 'leave_cover',
    personKey: id,
    personName: id,
    userId: id,
    operativeId: id,
    dayKey: day,
    date: dateFromDayKey(day),
    leaveId: id,
    leaveSlot: 'AM',
    leaveLabel: 'AM',
    leaveWindow: { start: 0, end: 1 },
    clashes: [],
    workingWindow: { start: 0, end: 1 },
    missing: [],
    missingHours: 4,
    bookedHours: 0,
    severity: 'medium',
    title: 'Half-day leave not covered',
    message: id,
  }
}

function material(id: string, day: string): MissedMaterialOrderWarning {
  return {
    id,
    type: 'missed_material_order',
    title: 'Material order not placed',
    projectId: id,
    projectLabel: id,
    date: dateFromDayKey(day),
    unorderedCount: 1,
    message: id,
  }
}

function qualification(id: string, day: string): QualificationExpiryWarning {
  return {
    id,
    operativeId: id,
    operativeName: id,
    qualificationId: id,
    qualificationName: id,
    date: dateFromDayKey(day),
    dayKey: day,
    daysUntilExpiry: -1,
    severity: 'low',
    title: 'Qualification expired',
    message: id,
    dismissKey: id,
  }
}

function unverified(id: string): UnverifiedOperativeWarning {
  return { id, operativeId: id, operativeName: id, email: `${id}@site.test`, message: id }
}

function managerClash(id: string, day: string): ManagerBookingClashWarning {
  return {
    id,
    resolutionKey: id,
    userId: id,
    personName: id,
    date: dateFromDayKey(day),
    bookingAId: 'a',
    bookingBId: 'b',
    locationALabel: 'A',
    locationBLabel: 'B',
    message: id,
    entries: [],
  }
}

function clash(id: string, day: string): OperativeBookingClashWarning {
  return {
    id,
    operativeId: id,
    operativeName: id,
    date: dateFromDayKey(day),
    bookingAId: 'a',
    bookingBId: 'b',
    projectAId: 'p1',
    projectBId: 'p2',
    projectALabel: 'A',
    projectBLabel: 'B',
    message: id,
    entries: [],
  }
}

test('orderWarningListItems interleaves dated cards by coverage day and keeps every row', () => {
  const input = {
    unbookedGroups: [unbooked('2026-10-12'), unbooked('2026-10-10')],
    leaveWarnings: [leave('leave-11', '2026-10-11')],
    materialWarnings: [material('mat-10', '2026-10-10')],
    qualificationWarnings: [qualification('qual-01', '2026-09-01')],
    unverifiedWarnings: [unverified('uv-1')],
    managerClashWarnings: [managerClash('mgr-12', '2026-10-12')],
    clashWarnings: [clash('op-09', '2026-10-09')],
    direction: 'oldest' as const,
  }

  const oldest = orderWarningListItems(input)
  assert.deepEqual(
    oldest.map((item) => ('group' in item ? item.group.id : item.warning.id)),
    ['qual-01', 'op-09', '2026-10-10', 'mat-10', 'leave-11', '2026-10-12', 'mgr-12', 'uv-1']
  )

  const newest = orderWarningListItems({ ...input, direction: 'newest' })
  assert.deepEqual(
    newest.map((item) => ('group' in item ? item.group.id : item.warning.id)),
    ['2026-10-12', 'mgr-12', 'leave-11', '2026-10-10', 'mat-10', 'op-09', 'qual-01', 'uv-1']
  )
  assert.equal(oldest.length, 8)
  assert.equal(newest.length, 8)
})
