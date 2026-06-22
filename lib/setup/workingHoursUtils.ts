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

export type DayTimelineSegment = {
  startPct: number
  widthPct: number
  kind: 'work' | 'break' | 'overtime'
  label?: string
}

export function buildWeekdayTimeline(params: {
  dayStart: string
  dayEnd: string
  breakStart: string
  breakEnd: string
}): { segments: DayTimelineSegment[]; rangeLabel: string } {
  const start = timeToMinutes(params.dayStart)
  const end = timeToMinutes(params.dayEnd)
  const breakS = timeToMinutes(params.breakStart)
  const breakE = timeToMinutes(params.breakEnd)

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

  if (breakS < breakE && breakS >= start && breakE <= end) {
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
