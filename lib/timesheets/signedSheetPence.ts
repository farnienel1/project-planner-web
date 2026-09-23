import { computeTimesheetValue } from './timesheetValue'

function dayKind(hours: number): 'full' | 'half' | 'hours' {
  if (hours >= 7) return 'full'
  if (hours >= 3.5) return 'half'
  return 'hours'
}

export function userIdFromTimesheetDoc(docId: string, data: Record<string, unknown>): string {
  if (typeof data.userId === 'string' && data.userId.trim()) return data.userId.trim()
  if (!docId.startsWith('timesheet_')) return ''
  const rest = docId.slice('timesheet_'.length)
  const cut = rest.lastIndexOf('_')
  return cut > 0 ? rest.slice(0, cut) : ''
}

export function penceForSignedTimesheet(input: {
  storedValuePence?: number | null
  extrasPounds: number
  hoursByDate: { date: string; hours: number }[]
  dayRatePence?: number
  hourlyRatePence?: number
}): { valuePence: number; missingRate: boolean } {
  if (input.storedValuePence && input.storedValuePence > 0) {
    return { valuePence: input.storedValuePence, missingRate: false }
  }
  const extrasPence = Math.round(Math.max(0, input.extrasPounds) * 100)
  const labour = computeTimesheetValue({
    currentDayRatePence: input.dayRatePence,
    currentHourlyRatePence: input.hourlyRatePence,
    days: input.hoursByDate.map((row) => ({
      date: row.date,
      kind: dayKind(row.hours),
      hours: row.hours,
    })),
  })
  return {
    valuePence: labour.valuePence + extrasPence,
    missingRate: labour.valueMissingRate && labour.valuePence === 0 && extrasPence === 0,
  }
}
