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

// Review of w-do-fullday (1): a slot word the sheet does not offer is never read as Full day over stored times.
test('a stored Evening / Overtime booking with clock times opens as Custom and is saved back exactly as stored', () => {
  const storedTimes = { workStartTime: '18:00', workEndTime: '22:00' }
  assert.equal(sheetSlotChoiceFromRaw('Evening', storedTimes), 'CUSTOM')
  assert.equal(sheetSlotChoiceFromRaw('OVERTIME', storedTimes), 'CUSTOM')
  const stored = { collection: 'bookings' as const, timeSlot: 'Evening', ...storedTimes, isBreakRemoved: true }
  // Unchanged save: the stored word, times and break stay as they were.
  assert.deepEqual(
    sheetSlotWriteFields('CUSTOM', 'bookings', { workStartTime: '18:00', workEndTime: '22:00', isBreakRemoved: true }, stored),
    { timeSlot: 'Evening', workStartTime: '18:00', workEndTime: '22:00', isBreakRemoved: true }
  )
  // Hours changed on screen: written as custom hours with the new times.
  assert.deepEqual(
    sheetSlotWriteFields('CUSTOM', 'bookings', { workStartTime: '17:00', workEndTime: '22:00', isBreakRemoved: true }, { ...stored, hoursTouched: true }),
    { timeSlot: 'CUSTOM_HOURS', workStartTime: '17:00', workEndTime: '22:00', isBreakRemoved: true }
  )
  // Moved to the other collection: that collection's own word.
  assert.equal(sheetSlotWriteFields('CUSTOM', 'managerSiteBookings', { ...storedTimes, isBreakRemoved: true }, stored).timeSlot, 'CUSTOM_HOURS')
  // The person picks Full day on purpose: Full day, no clock times.
  assert.equal(sheetSlotWriteFields('FULL DAY', 'bookings', { ...storedTimes, isBreakRemoved: true }, stored).timeSlot, 'FULL DAY')
})

test('a stored slot word with no clock times saved unchanged keeps its word, never becomes Full day', () => {
  const stored = { collection: 'managerSiteBookings' as const, timeSlot: 'Overtime', isBreakRemoved: false }
  assert.equal(sheetSlotChoiceFromRaw('Overtime'), 'FULL DAY')
  assert.deepEqual(sheetSlotWriteFields('FULL DAY', 'managerSiteBookings', hours, stored), {
    timeSlot: 'Overtime',
    workStartTime: undefined,
    workEndTime: undefined,
    isBreakRemoved: false,
  })
})

// Review of w-do-fullday (2): a labour row passes the stored slot through (no Full day default).
test('a labour booking stored with no slot word but with clock times opens the sheet as Custom', async () => {
  const { buildDailyOverview } = await import('./buildDailyOverview.ts')
  const { dateFromDayKey } = await import('../ios-parity/londonTime.ts')
  const day = dateFromDayKey('2026-11-17')
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [{ id: 'P1', jobNumber: 'J1', siteName: 'Site', jobType: 'CAT A' } as never],
    bookings: [
      { id: 'B1', operativeId: 'op', projectId: 'P1', date: day, timeSlot: '', workStartTime: '08:00', workEndTime: '12:00', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
      { id: 'B2', operativeId: 'op2', projectId: 'P1', date: day, timeSlot: 'FULL DAY', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
    ] as never,
    managerBookings: [],
    holidays: [],
    users: [],
    operatives: [],
  })
  const rows = model.projectCards.flatMap((card) => card.people)
  const noWord = rows.find((row) => row.bookingId === 'B1')
  const fullDay = rows.find((row) => row.bookingId === 'B2')
  assert.ok(noWord && fullDay)
  assert.equal(noWord.timeSlotRaw, undefined)
  assert.equal(sheetSlotChoiceFromRaw(noWord.timeSlotRaw, noWord), 'CUSTOM')
  assert.equal(fullDay.timeSlotRaw, 'FULL DAY')
  assert.equal(sheetSlotChoiceFromRaw(fullDay.timeSlotRaw, fullDay), 'FULL DAY')
})
