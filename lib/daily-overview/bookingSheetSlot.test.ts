/**
 * Owner bug 23 Nov: the Daily Overview booking sheet offered custom hours only, so a weekday Full day could not be
 * chosen and saving a Full day booking turned it into Custom. The sheet now offers the rulebook's day slots
 * (`allowedTimeSlotsOnDay` via `slotOfferedOnDate`) and writes the slot chosen, as the scheduling Edit Booking sheet.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  sheetSlotChoiceFromRaw,
  sheetSlotOptions,
  sheetSlotWriteFields,
  sheetTimeSlotWord,
} from './bookingSheetSlot'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'

// Organisation zone defaults to Europe/London. Tue 17 Nov 2026, Sat 21 Nov 2026.
const TUESDAY = new Date('2026-11-17T00:00:00Z')
const SATURDAY = new Date('2026-11-21T00:00:00Z')
const hours = { workStartTime: '07:00', workEndTime: '19:00', isBreakRemoved: true }

const values = (stored: Parameters<typeof sheetSlotOptions>[2], date: Date) =>
  sheetSlotOptions(date, DEFAULT_PAYROLL_POLICY, stored).map((opt) => opt.value)

test('a weekday offers Full day and Custom; a stored Custom booking can be changed to Full day', () => {
  assert.deepEqual(values('CUSTOM', TUESDAY), ['FULL DAY', 'CUSTOM'])
  assert.deepEqual(values('FULL DAY', TUESDAY), ['FULL DAY', 'CUSTOM'])
})

test('Saturday and Sunday offer Custom only; a stored weekend Full day keeps its own slot', () => {
  assert.deepEqual(values('CUSTOM', SATURDAY), ['CUSTOM'])
  assert.deepEqual(values('FULL DAY', SATURDAY), ['FULL DAY', 'CUSTOM'])
})

test('a stored AM / PM keeps its own slot offered', () => {
  assert.deepEqual(values('AM', TUESDAY), ['AM', 'FULL DAY', 'CUSTOM'])
  assert.deepEqual(values('PM', TUESDAY), ['PM', 'FULL DAY', 'CUSTOM'])
})

test('the stored slot opens selected', () => {
  assert.equal(sheetSlotChoiceFromRaw('FULL DAY'), 'FULL DAY')
  assert.equal(sheetSlotChoiceFromRaw('FULL_DAY'), 'FULL DAY')
  assert.equal(sheetSlotChoiceFromRaw('CUSTOM_HOURS'), 'CUSTOM')
  assert.equal(sheetSlotChoiceFromRaw('Custom'), 'CUSTOM')
  assert.equal(sheetSlotChoiceFromRaw('AM'), 'AM')
  assert.equal(sheetSlotChoiceFromRaw('pm'), 'PM')
  assert.equal(sheetSlotChoiceFromRaw(undefined), 'FULL DAY')
  assert.equal(sheetSlotChoiceFromRaw('', { workStartTime: '08:00', workEndTime: '12:00' }), 'CUSTOM')
})

test('Full day is written with its collection word, no clock times and no break removal', () => {
  assert.deepEqual(sheetSlotWriteFields('FULL DAY', 'bookings', hours), {
    timeSlot: 'FULL DAY',
    workStartTime: undefined,
    workEndTime: undefined,
    isBreakRemoved: false,
  })
  assert.equal(sheetSlotWriteFields('FULL DAY', 'managerSiteBookings', hours).timeSlot, 'FULL_DAY')
})

test('Custom hours keep the times and the break toggle; AM / PM are written as stored', () => {
  assert.deepEqual(sheetSlotWriteFields('CUSTOM', 'bookings', hours), { timeSlot: 'CUSTOM_HOURS', ...hours })
  assert.equal(sheetSlotWriteFields('CUSTOM', 'managerSiteBookings', hours).timeSlot, 'CUSTOM_HOURS')
  assert.equal(sheetTimeSlotWord('AM', 'bookings'), 'AM')
  assert.equal(sheetSlotWriteFields('PM', 'managerSiteBookings', hours).workStartTime, undefined)
})

test('a stored Full day saved unchanged is written as Full day, never converted to Custom', () => {
  const choice = sheetSlotChoiceFromRaw('FULL DAY', { workStartTime: '07:30', workEndTime: '16:00' })
  assert.equal(sheetSlotWriteFields(choice, 'bookings', hours).timeSlot, 'FULL DAY')
})

test('the sheet writes the chosen slot on every save path, never a hard-coded CUSTOM_HOURS', () => {
  const sheet = readFileSync(new URL('../../components/daily-overview/DailyOverviewBookingSheet.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(sheet, /timeSlot:\s*'CUSTOM_HOURS'/)
  assert.doesNotMatch(sheet, /SlotFromRaw\('CUSTOM_HOURS'\)/)
  assert.match(sheet, /sheetSlotOptions\(/)
  assert.match(sheet, /sheetSlotWriteFields\(/)
})
