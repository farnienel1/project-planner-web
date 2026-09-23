export type TimesheetValueBasis = 'day' | 'hour' | 'mixed'

export type TimesheetWorkedDay = {
  date: string
  kind: 'full' | 'half' | 'hours'
  hours?: number
  dayLengthHours?: number
}

export type TimesheetRatePoint = {
  effectiveAt: string
  dayRatePence?: number
  hourlyRatePence?: number
}

export type TimesheetValueInput = {
  days: TimesheetWorkedDay[]
  history?: TimesheetRatePoint[]
  currentDayRatePence?: number | null
  currentHourlyRatePence?: number | null
  defaultDayLengthHours?: number
  overtimeCap?: number
}

export type TimesheetValueResult = {
  valuePence: number
  valueBasis: TimesheetValueBasis | null
  valueDays: number
  valueHours: number
  valueRateSnapshot: { date: string; dayRatePence?: number; hourlyRatePence?: number }[]
  valueMissingRate: boolean
  valueVersion: 1
}

function poundsToPence(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined
  return Math.round(value * 100)
}

export function ratePenceFromPounds(dayRate?: number | null, hourlyRate?: number | null): {
  dayRatePence?: number
  hourlyRatePence?: number
} {
  return {
    dayRatePence: poundsToPence(dayRate),
    hourlyRatePence: poundsToPence(hourlyRate),
  }
}

function rateOnDate(date: string, history: TimesheetRatePoint[], fallback: TimesheetRatePoint): TimesheetRatePoint {
  const applicable = (history || [])
    .filter((row) => row.effectiveAt <= date)
    .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
  return applicable[applicable.length - 1] || fallback
}

function dayFraction(day: TimesheetWorkedDay, defaultDayLengthHours: number, overtimeCap: number): number {
  if (day.kind === 'full') return 1
  if (day.kind === 'half') return 0.5
  const hours = Math.max(0, day.hours || 0)
  const length = Math.max(1, day.dayLengthHours || defaultDayLengthHours)
  return Math.min(overtimeCap, hours / length)
}

export function computeTimesheetValue(input: TimesheetValueInput): TimesheetValueResult {
  const defaultDayLengthHours = input.defaultDayLengthHours && input.defaultDayLengthHours > 0 ? input.defaultDayLengthHours : 8
  const overtimeCap = input.overtimeCap && input.overtimeCap > 0 ? input.overtimeCap : 1.5
  const history = input.history || []
  const fallback: TimesheetRatePoint = {
    effectiveAt: '1970-01-01',
    dayRatePence: input.currentDayRatePence || undefined,
    hourlyRatePence: input.currentHourlyRatePence || undefined,
  }

  let valuePence = 0
  let valueDays = 0
  let valueHours = 0
  let usedDay = false
  let usedHour = false
  let valueMissingRate = false
  const valueRateSnapshot: TimesheetValueResult['valueRateSnapshot'] = []

  for (const day of input.days) {
    const rate = rateOnDate(day.date, history, fallback)
    const snapshot: TimesheetValueResult['valueRateSnapshot'][number] = { date: day.date }
    if (rate.dayRatePence) snapshot.dayRatePence = rate.dayRatePence
    if (rate.hourlyRatePence) snapshot.hourlyRatePence = rate.hourlyRatePence
    valueRateSnapshot.push(snapshot)

    const hours = Math.max(0, day.hours || (day.kind === 'full' ? defaultDayLengthHours : day.kind === 'half' ? defaultDayLengthHours / 2 : 0))
    valueHours += hours
    const fraction = dayFraction(day, defaultDayLengthHours, overtimeCap)
    valueDays += fraction

    if (rate.hourlyRatePence && (!rate.dayRatePence || day.kind === 'hours')) {
      usedHour = true
      valuePence += Math.round(rate.hourlyRatePence * hours)
      continue
    }
    if (rate.dayRatePence) {
      usedDay = true
      valuePence += Math.round(rate.dayRatePence * fraction)
      continue
    }
    valueMissingRate = true
  }

  const valueBasis: TimesheetValueBasis | null =
    input.days.length === 0 ? null : usedDay && usedHour ? 'mixed' : usedHour ? 'hour' : usedDay ? 'day' : null

  return {
    valuePence,
    valueBasis,
    valueDays,
    valueHours,
    valueRateSnapshot,
    valueMissingRate,
    valueVersion: 1,
  }
}

export function clearTimesheetValue(): TimesheetValueResult {
  return {
    valuePence: 0,
    valueBasis: null,
    valueDays: 0,
    valueHours: 0,
    valueRateSnapshot: [],
    valueMissingRate: false,
    valueVersion: 1,
  }
}
