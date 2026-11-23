/**
 * Regression (23 Nov): opening any booking on Daily Overview crashed the screen ("Something went wrong on this
 * screen"). The booking sheet's Hours breakdown called `hoursFields()` while rendering, before the `const
 * sourceCollection` it reads was initialised, so every render threw `ReferenceError: Cannot access
 * 'sourceCollection' before initialization`. This test renders the real sheet for each kind of booking row.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

// The sheet's component tree imports CSS files (bundled by Next.js); Node cannot load them, so they are ignored here.
const nodeRequire = createRequire(import.meta.url)
;(nodeRequire.extensions as Record<string, unknown>)['.css'] = () => {}

const weekday = new Date('2026-11-23T00:00:00Z') // Monday
const saturday = new Date('2026-11-28T00:00:00Z')

const rows: Array<{ name: string; day: Date; row: Record<string, unknown> }> = [
  { name: 'labour full day, no times', day: weekday, row: { kind: 'operative', timeSlotRaw: 'FULL DAY' } },
  { name: 'labour full day with times', day: weekday, row: { kind: 'operative', timeSlotRaw: 'FULL DAY', workStartTime: '07:30', workEndTime: '16:00' } },
  { name: 'labour custom hours', day: weekday, row: { kind: 'operative', timeSlotRaw: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00' } },
  { name: 'labour AM', day: weekday, row: { kind: 'operative', timeSlotRaw: 'AM' } },
  { name: 'labour PM', day: weekday, row: { kind: 'operative', timeSlotRaw: 'PM' } },
  { name: 'labour stored Evening', day: weekday, row: { kind: 'operative', timeSlotRaw: 'Evening' } },
  { name: 'labour stored Overtime', day: weekday, row: { kind: 'operative', timeSlotRaw: 'Overtime' } },
  { name: 'labour no slot, with times', day: weekday, row: { kind: 'operative', workStartTime: '08:00', workEndTime: '12:00' } },
  { name: 'labour no slot, no times', day: weekday, row: { kind: 'operative' } },
  { name: 'labour weekend custom', day: saturday, row: { kind: 'operative', timeSlotRaw: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00' } },
  { name: 'manager office full day', day: weekday, row: { kind: 'manager', userId: 'u1', timeSlotRaw: 'FULL_DAY', locationType: 'office' } },
  { name: 'manager working from home custom', day: weekday, row: { kind: 'manager', userId: 'u1', timeSlotRaw: 'CUSTOM_HOURS', workStartTime: '09:00', workEndTime: '17:00', locationType: 'working_from_home' } },
  { name: 'manager site survey, no slot', day: weekday, row: { kind: 'manager', userId: 'u1', locationType: 'site_survey' } },
  { name: 'manager on a job', day: weekday, row: { kind: 'manager', userId: 'u1', timeSlotRaw: 'FULL_DAY', locationType: 'project', projectId: 'p1' } },
  { name: 'row with no booking id', day: weekday, row: { kind: 'operative', bookingId: '', timeSlotRaw: 'FULL DAY' } },
]

test('Daily Overview booking sheet renders for every kind of booking row', async () => {
  const { DailyOverviewBookingSheet } = await import('@/components/daily-overview/DailyOverviewBookingSheet')
  for (const { name, day, row } of rows) {
    const target = { id: `row-${name}`, name: 'Sam Smith', bookingId: 'b1', operativeId: 'op1', ...row }
    assert.doesNotThrow(
      () =>
        renderToString(
          createElement(DailyOverviewBookingSheet, { row: target as never, day, onClose: () => {} })
        ),
      `rendering the sheet for: ${name}`
    )
  }
})
