import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone, LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import type { DateRangePreset } from '@/lib/analytics/events'

export type AnalyticsDateRange = {
  preset: DateRangePreset
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
  label: string
}

function startOfDay(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  return dateFromDayKeyInZone(dayKeyInZone(date, timeZone), timeZone)
}

function startOfMonth(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  const key = dayKeyInZone(date, timeZone)
  const [y, m] = key.split('-').map(Number)
  return dateFromDayKeyInZone(`${y}-${String(m).padStart(2, '0')}-01`, timeZone)
}

export function resolveDateRange(
  preset: DateRangePreset,
  now = new Date(),
  custom?: { start: Date; end: Date },
  timeZone = LONDON_TIME_ZONE
): AnalyticsDateRange {
  const today = startOfDay(now, timeZone)
  const tomorrow = addDaysInZone(today, 1, timeZone)
  if (preset === 'custom' && custom) {
    const start = startOfDay(custom.start, timeZone)
    const endExclusive = addDaysInZone(startOfDay(custom.end, timeZone), 1, timeZone)
    const days = Math.max(1, Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000))
    return {
      preset,
      start,
      end: endExclusive,
      previousStart: addDaysInZone(start, -days, timeZone),
      previousEnd: start,
      label: 'Custom',
    }
  }

  const configs: Record<Exclude<DateRangePreset, 'custom'>, () => AnalyticsDateRange> = {
    today: () => ({
      preset: 'today',
      start: today,
      end: tomorrow,
      previousStart: addDaysInZone(today, -1, timeZone),
      previousEnd: today,
      label: 'Today',
    }),
    yesterday: () => ({
      preset: 'yesterday',
      start: addDaysInZone(today, -1, timeZone),
      end: today,
      previousStart: addDaysInZone(today, -2, timeZone),
      previousEnd: addDaysInZone(today, -1, timeZone),
      label: 'Yesterday',
    }),
    last_7: () => ({
      preset: 'last_7',
      start: addDaysInZone(today, -6, timeZone),
      end: tomorrow,
      previousStart: addDaysInZone(today, -13, timeZone),
      previousEnd: addDaysInZone(today, -6, timeZone),
      label: 'Last 7 days',
    }),
    last_30: () => ({
      preset: 'last_30',
      start: addDaysInZone(today, -29, timeZone),
      end: tomorrow,
      previousStart: addDaysInZone(today, -59, timeZone),
      previousEnd: addDaysInZone(today, -29, timeZone),
      label: 'Last 30 days',
    }),
    last_90: () => ({
      preset: 'last_90',
      start: addDaysInZone(today, -89, timeZone),
      end: tomorrow,
      previousStart: addDaysInZone(today, -179, timeZone),
      previousEnd: addDaysInZone(today, -89, timeZone),
      label: 'Last 90 days',
    }),
    this_month: () => {
      const start = startOfMonth(today, timeZone)
      const prev = addDaysInZone(start, -1, timeZone)
      const prevStart = startOfMonth(prev, timeZone)
      return {
        preset: 'this_month',
        start,
        end: tomorrow,
        previousStart: prevStart,
        previousEnd: start,
        label: 'This month',
      }
    },
    last_month: () => {
      const thisStart = startOfMonth(today, timeZone)
      const prev = addDaysInZone(thisStart, -1, timeZone)
      const prevStart = startOfMonth(prev, timeZone)
      const earlier = addDaysInZone(prevStart, -1, timeZone)
      return {
        preset: 'last_month',
        start: prevStart,
        end: thisStart,
        previousStart: startOfMonth(earlier, timeZone),
        previousEnd: prevStart,
        label: 'Last month',
      }
    },
  }

  return configs[preset === 'custom' ? 'last_7' : preset]()
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
