import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import {
  organizationCalendarWeekEnd,
  organizationCalendarWeekStart,
  organizationTodayCalendarDate,
} from '@/lib/orgTime/organizationWeek'

export type ScheduleSlotChoice = 'AM' | 'PM' | 'FULL DAY' | 'CUSTOM'

export interface ScheduleDateSlot {
  date: Date
  slot: ScheduleSlotChoice
  workStartTime?: string
  workEndTime?: string
}

export function slotKey(date: Date): string {
  const d = startOfDay(date)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function weekDaysFrom(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function calendarGridDays(month: Date): Date[] {
  const monthStart = startOfMonth(month)
  // Rulebook §1 (1.36.0, FU-4): rows are organisation weeks (Monday–Sunday, `organizationWeekDayKeys`).
  const gridStart = organizationCalendarWeekStart(monthStart)
  const monthEnd = endOfMonth(month)
  const gridEnd = organizationCalendarWeekEnd(monthEnd)
  const days: Date[] = []
  let current = gridStart
  while (current <= gridEnd) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

export function quickSelectDates(days: number): Date[] {
  const today = startOfDay(new Date())
  return Array.from({ length: days }, (_, i) => addDays(today, i))
}

export function formatScheduleDay(date: Date): string {
  return format(date, 'EEE · d MMM yyyy')
}

export function isDateSelected(date: Date, selected: Date[]): boolean {
  return selected.some((d) => isSameDay(d, date))
}

export function toggleSelectedDate(date: Date, selected: Map<string, ScheduleDateSlot>): Map<string, ScheduleDateSlot> {
  const key = slotKey(date)
  const next = new Map(selected)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.set(key, { date: startOfDay(date), slot: 'FULL DAY' })
  }
  return next
}

export function setQuickSelectDates(days: number): Map<string, ScheduleDateSlot> {
  const next = new Map<string, ScheduleDateSlot>()
  for (const date of quickSelectDates(days)) {
    next.set(slotKey(date), { date, slot: 'FULL DAY' })
  }
  return next
}

export function sortedDateSlots(slots: Map<string, ScheduleDateSlot>): ScheduleDateSlot[] {
  return Array.from(slots.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function slotToFirestore(slot: ScheduleDateSlot): {
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
} {
  if (slot.slot === 'CUSTOM') {
    return {
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: slot.workStartTime || '07:30',
      workEndTime: slot.workEndTime || '16:00',
    }
  }
  return { timeSlot: slot.slot }
}

export function isInMonth(date: Date, month: Date): boolean {
  return isSameMonth(date, month)
}

/**
 * Rulebook 1.13.0 (Q2) date selection for the scheduling grids: a weekend day is custom hours only (opened with
 * `customHoursPrefillForDate`), and one request never mixes weekdays and weekend days
 * (`WEEKEND_WEEKDAY_MIX_MESSAGE`). Returns the new selection, or the unchanged one with the message.
 */
export function toggleSelectedDateChecked(
  date: Date,
  selected: Map<string, ScheduleDateSlot>,
  rules: {
    isWeekend: (date: Date) => boolean
    prefill: (date: Date) => { start: string; end: string }
    mixMessage: (dates: Date[]) => string | null
  }
): { slots: Map<string, ScheduleDateSlot>; error: string | null } {
  const key = slotKey(date)
  if (selected.has(key)) return { slots: toggleSelectedDate(date, selected), error: null }
  const message = rules.mixMessage([...Array.from(selected.values()).map((slot) => slot.date), startOfDay(date)])
  if (message) return { slots: selected, error: message }
  const next = new Map(selected)
  // `rules.isWeekend` is the organisation-zone weekend test (`useScheduleDateRules` → `isWeekendDayKey`).
  const weekendDay = rules.isWeekend
  if (weekendDay(date)) {
    const hours = rules.prefill(date)
    next.set(key, { date: startOfDay(date), slot: 'CUSTOM', workStartTime: hours.start, workEndTime: hours.end })
  } else {
    next.set(key, { date: startOfDay(date), slot: 'FULL DAY' })
  }
  return { slots: next, error: null }
}

/** Quick select N working days from today, skipping Saturdays and Sundays (as iOS `quickSelect`). */
export function setQuickSelectWeekdays(
  days: number,
  weekendDay: (date: Date) => boolean,
  today: Date = organizationTodayCalendarDate()
): Map<string, ScheduleDateSlot> {
  const next = new Map<string, ScheduleDateSlot>()
  // Rulebook §1 (1.36.0, FU-4): from the organisation's today, not the browser's (a browser abroad or near midnight
  // started the next N working days on the wrong day).
  let cursor = startOfDay(today)
  let guard = 0
  while (next.size < days && guard < 60) {
    if (!weekendDay(cursor)) next.set(slotKey(cursor), { date: cursor, slot: 'FULL DAY' })
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return next
}
