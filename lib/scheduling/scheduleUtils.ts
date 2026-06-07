import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

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
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const monthEnd = endOfMonth(month)
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
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
