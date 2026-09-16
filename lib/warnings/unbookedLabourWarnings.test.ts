import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupUnbookedWarningsByDay, type UnbookedLabourWarning } from '../warnings/unbookedLabourWarnings.ts'

test('groupUnbookedWarningsByDay lists people under one day like iOS cards', () => {
  const dayA = new Date('2026-09-16T12:00:00Z')
  const dayB = new Date('2026-09-17T12:00:00Z')
  const warnings: UnbookedLabourWarning[] = [
    {
      id: '1',
      operativeId: 'OP1',
      operativeName: 'Ada Booked',
      date: dayA,
      message: 'Ada',
      missingHours: 8,
    },
    {
      id: '2',
      operativeId: 'OP2',
      operativeName: 'Bob Site',
      date: dayA,
      message: 'Bob',
      missingHours: 8,
    },
    {
      id: '3',
      operativeId: 'OP1',
      operativeName: 'Ada Booked',
      date: dayB,
      message: 'Ada',
      missingHours: 4,
    },
  ]
  const groups = groupUnbookedWarningsByDay(warnings)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].people.length, 2)
  assert.equal(groups[0].people[0].operativeName, 'Ada Booked')
  assert.equal(groups[1].people.length, 1)
})
