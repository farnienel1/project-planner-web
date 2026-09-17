import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  analyse,
  axisTicks,
  fitWindow,
  formatClock,
  FULL_DAY_TICKS,
  FULL_DAY_WINDOW,
  type ClashTimelineEntry,
} from './clashTimeline.ts'

function entry(partial: Partial<ClashTimelineEntry> & { startMinutes: number; endMinutes: number }): ClashTimelineEntry {
  return {
    bookingId: partial.bookingId || 'B1',
    locationLabel: partial.locationLabel || 'Site',
    timeLabel: partial.timeLabel || 'CUSTOM_HOURS',
    hoursLabel: partial.hoursLabel || '8h',
    ...partial,
  }
}

test('formatClock shows 00:00 through 24:00', () => {
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(6 * 60), '06:00')
  assert.equal(formatClock(24 * 60), '24:00')
})

test('full day window is 00:00 to 24:00 with 6-hour ticks', () => {
  assert.equal(FULL_DAY_WINDOW.startMinutes, 0)
  assert.equal(FULL_DAY_WINDOW.endMinutes, 24 * 60)
  assert.deepEqual(
    FULL_DAY_TICKS.map((tick) => formatClock(tick)),
    ['00:00', '06:00', '12:00', '18:00', '24:00']
  )
})

test('analyse reports overlap minutes on the 00-24 window', () => {
  const entries = [
    entry({ bookingId: 'A', startMinutes: 7 * 60 + 30, endMinutes: 16 * 60, locationLabel: 'Office' }),
    entry({ bookingId: 'B', startMinutes: 8 * 60, endMinutes: 12 * 60, locationLabel: 'Riverside' }),
  ]
  const analysis = analyse(entries, FULL_DAY_WINDOW)
  assert.equal(analysis.minutes, 4 * 60)
  assert.equal(analysis.peak, 2)
  assert.equal(formatClock(analysis.startMinutes || 0), '08:00')
  assert.equal(formatClock(analysis.endMinutes || 0), '12:00')
})

test('fitWindow still pads booked hours for zoomed views', () => {
  const window = fitWindow([
    entry({ startMinutes: 8 * 60, endMinutes: 12 * 60 }),
  ])
  assert.ok(window.startMinutes <= 7 * 60)
  assert.ok(window.endMinutes >= 13 * 60)
  assert.ok(window.endMinutes - window.startMinutes >= 8 * 60)
  assert.ok(axisTicks(window).length >= 2)
})
