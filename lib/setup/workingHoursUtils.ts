import type { OrgPayrollTimePolicy, WeekendPayrollSettings } from '@/lib/settings/organizationSettings'

/** Parse "HH:mm" to minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime12h(time: string): string {
  const mins = timeToMinutes(time)
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const period = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 || 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`
}

export function computeSpanHours(dayStart: string, dayEnd: string): number {
  const span = timeToMinutes(dayEnd) - timeToMinutes(dayStart)
  if (span <= 0) return 0
  return Math.round((span / 60) * 10) / 10
}

export function computeStandardPaidHours(dayStart: string, dayEnd: string, unpaidBreakMinutes: number): number {
  const spanMins = timeToMinutes(dayEnd) - timeToMinutes(dayStart)
  if (spanMins <= 0) return 0
  const paidMins = Math.max(0, spanMins - unpaidBreakMinutes)
  return Math.round((paidMins / 60) * 10) / 10
}

export function syncBreakWindowEnd(breakWindowStart: string, unpaidBreakMinutes: number): string {
  return minutesToTime(timeToMinutes(breakWindowStart) + unpaidBreakMinutes)
}

export function withSyncedPayrollPolicy(patch: Partial<OrgPayrollTimePolicy>, current: OrgPayrollTimePolicy): OrgPayrollTimePolicy {
  const next = { ...current, ...patch }

  if (patch.unpaidBreakMinutes !== undefined || patch.breakWindowStart !== undefined) {
    next.breakWindowEnd = syncBreakWindowEnd(next.breakWindowStart, next.unpaidBreakMinutes)
  }

  if (
    patch.standardDayStart !== undefined ||
    patch.standardDayEnd !== undefined ||
    patch.unpaidBreakMinutes !== undefined
  ) {
    next.standardPaidHours = computeStandardPaidHours(
      next.standardDayStart,
      next.standardDayEnd,
      next.unpaidBreakMinutes
    )
  }

  return next
}

export type DayTimelineSegment = {
  startPct: number
  widthPct: number
  kind: 'work' | 'break' | 'overtime'
}

export function buildWeekdayTimeline(params: {
  dayStart: string
  dayEnd: string
  breakStart: string
  unpaidBreakMinutes: number
}): { segments: DayTimelineSegment[]; rangeLabel: string } {
  const start = timeToMinutes(params.dayStart)
  const end = timeToMinutes(params.dayEnd)
  const breakS = timeToMinutes(params.breakStart)
  const breakE = breakS + params.unpaidBreakMinutes

  if (end <= start) {
    return { segments: [], rangeLabel: `${params.dayStart} – ${params.dayEnd}` }
  }

  const total = end - start
  const segments: DayTimelineSegment[] = []

  const push = (from: number, to: number, kind: DayTimelineSegment['kind']) => {
    const clampedFrom = Math.max(from, start)
    const clampedTo = Math.min(to, end)
    if (clampedTo <= clampedFrom) return
    segments.push({
      startPct: ((clampedFrom - start) / total) * 100,
      widthPct: ((clampedTo - clampedFrom) / total) * 100,
      kind,
    })
  }

  if (params.unpaidBreakMinutes > 0 && breakS >= start && breakE <= end) {
    push(start, breakS, 'work')
    push(breakS, breakE, 'break')
    push(breakE, end, 'work')
  } else {
    push(start, end, 'work')
  }

  return {
    segments,
    rangeLabel: `${formatTime12h(params.dayStart)} – ${formatTime12h(params.dayEnd)}`,
  }
}

export function effectiveWeekendSettings(
  day: 'saturday' | 'sunday',
  policy: OrgPayrollTimePolicy
): WeekendPayrollSettings {
  const settings = policy[day]
  if (day === 'sunday' && settings.sameAsSaturday) {
    return { ...policy.saturday, sameAsSaturday: true }
  }
  return settings
}

export function weekendHoursLabel(settings: WeekendPayrollSettings, weekdayMultiplier: number): string {
  if (settings.allHoursAtMultiplierMode) {
    return `All hours ×${settings.allHoursMultiplier.toFixed(1)}`
  }
  const start = settings.definedWindowStart ?? '07:30'
  const end = settings.definedWindowEnd ?? '16:00'
  const hours = settings.countsAsStandardHours ?? 8
  return `${formatTime12h(start)} – ${formatTime12h(end)} · ${hours}h standard · outside ×${weekdayMultiplier.toFixed(1)}`
}

export function defaultDefinedWeekendSettings(policy: OrgPayrollTimePolicy): WeekendPayrollSettings {
  return {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: policy.standardDayStart,
    definedWindowEnd: policy.standardDayEnd,
    countsAsStandardHours: policy.standardPaidHours,
    sameAsSaturday: false,
  }
}
