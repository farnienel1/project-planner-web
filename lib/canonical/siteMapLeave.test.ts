import assert from 'node:assert/strict'
import test from 'node:test'
import { siteMapLeaveSummary } from './siteMapLeave'

const day = '2026-11-25' // Wednesday
const tz = 'Europe/London'

test('1.82.0 site map leave: whole company, approved only, one row per person', () => {
  const summary = siteMapLeaveSummary({
    dayKey: day,
    timeZone: tz,
    records: [
      { id: 'h1', userId: 'U1', startDayKey: day, endDayKey: day, timeSlot: 'AM', status: 'approved' },
      { id: 'h2', userId: 'u1-old', startDayKey: day, endDayKey: day, timeSlot: 'PM', status: 'approved' },
      { id: 'h3', userId: 'u2', startDayKey: day, endDayKey: day, status: 'pending' },
      { id: 'h4', userId: 'u3', startDayKey: '2026-11-20', endDayKey: '2026-11-24', status: 'approved' },
      { id: 'h5', operativeId: 'op9', startDayKey: '2026-11-23', endDayKey: '2026-11-27', status: 'approved' },
      { id: 'h6', userId: 'ghost@x.com', startDayKey: day, status: 'approved' },
      { id: 'h7', userId: 'stranger', startDayKey: day, status: 'approved' },
    ],
    roster: [
      { id: 'u1', name: 'Ann', formerUserIds: ['u1-old'] },
      { id: 'u4', name: 'Bob', email: 'Bob@X.com' },
      { id: 'u5', name: 'Gil', email: 'ghost@x.com' },
    ],
    operatives: [{ id: 'op9', email: 'bob@x.com', name: 'Bob (row)' }],
  })
  assert.equal(summary.onAnnualLeave, 4)
  assert.deepEqual(
    summary.people.map((p) => [p.key, p.name, p.recordIds]),
    [
      ['person:u1', 'Ann', ['h1', 'h2']],
      ['person:u4', 'Bob', ['h5']],
      ['person:u5', 'Gil', ['h6']],
      ['id:stranger', null, ['h7']],
    ]
  )
})

test('1.82.0 site map leave: bank holiday and weekend inside a record are not leave days', () => {
  const records = [{ id: 'h', userId: 'u', startDayKey: '2026-12-21', endDayKey: '2026-12-29', status: 'approved' }]
  assert.equal(siteMapLeaveSummary({ records, dayKey: '2026-12-25', timeZone: tz, nonWorkingDayKeys: ['2026-12-25'] }).onAnnualLeave, 0)
  assert.equal(siteMapLeaveSummary({ records, dayKey: '2026-12-27', timeZone: tz }).onAnnualLeave, 0)
  assert.equal(siteMapLeaveSummary({ records, dayKey: '2026-12-24', timeZone: tz }).onAnnualLeave, 1)
  assert.deepEqual(siteMapLeaveSummary({ records: null, dayKey: day }), { onAnnualLeave: 0, people: [] })
})
