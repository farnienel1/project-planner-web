/**
 * iOS parity: Models/WarningModels.swift WarningTimelineMath + ClashTimelineEntry
 */

export const DAY_MINUTES = 24 * 60

export type ClashTimelineEntry = {
  bookingId: string
  managerBookingId?: string
  jobNumber?: string
  siteName?: string
  isSmallWorks?: boolean
  locationLabel: string
  timeLabel: string
  startMinutes: number
  endMinutes: number
  hoursLabel: string
}

export type ClashWindow = { startMinutes: number; endMinutes: number }
export const FULL_DAY_WINDOW: ClashWindow = { startMinutes: 0, endMinutes: DAY_MINUTES }
export const FULL_DAY_TICKS = [0, 6 * 60, 12 * 60, 18 * 60, DAY_MINUTES]
export type ClashRegion = { startMinutes: number; endMinutes: number; concurrency: number }
export type ClashAnalysis = {
  regions: ClashRegion[]
  minutes: number
  peak: number
  startMinutes?: number
  endMinutes?: number
}

export function treatsAsAllDay(entry: ClashTimelineEntry): boolean {
  const span = Math.max(0, entry.endMinutes - entry.startMinutes)
  if (span >= 23 * 60) return true
  const t = entry.timeLabel.toLowerCase()
  const h = entry.hoursLabel.toLowerCase()
  return t.includes('full day') || t === 'all day' || t.includes('full-day') || h.includes('full day')
}

export function displayTitle(entry: ClashTimelineEntry): string {
  if (entry.siteName && entry.jobNumber) return entry.siteName
  return entry.locationLabel
}

export function formatClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, DAY_MINUTES))
  if (clamped === DAY_MINUTES) return '24:00'
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const h = Math.max(0, minutes) / 60
  if (h > 0 && h < 1) return `${Math.round(h * 60)}m`
  const r = Math.round(h * 10) / 10
  if (Math.abs(r - Math.round(r)) < 0.05) return `${Math.round(r)}h`
  return `${r.toFixed(1)}h`
}

export function placeWord(count: number): string {
  if (count === 2) return 'two'
  if (count === 3) return 'three'
  return String(count)
}

export function windowSpan(window: ClashWindow): number {
  return Math.max(1, window.endMinutes - window.startMinutes)
}

export function fitWindow(entries: ClashTimelineEntry[]): ClashWindow {
  const timed = entries.filter((entry) => !treatsAsAllDay(entry))
  if (timed.length === 0) return { startMinutes: 6 * 60, endMinutes: 20 * 60 }
  let start = Math.max(0, Math.floor(Math.min(...timed.map((e) => e.startMinutes)) / 60) * 60 - 60)
  let end = Math.min(
    DAY_MINUTES,
    Math.ceil(Math.max(...timed.map((e) => e.endMinutes)) / 60) * 60 + 60
  )
  let guard = 0
  while (end - start < 8 * 60 && guard < 48) {
    guard += 1
    if (start > 0) start = Math.max(0, start - 60)
    else if (end < DAY_MINUTES) end = Math.min(DAY_MINUTES, end + 60)
    else break
  }
  return { startMinutes: start, endMinutes: end }
}

export function axisTicks(window: ClashWindow): number[] {
  const spanHours = windowSpan(window) / 60
  const steps = [1, 2, 3, 4, 6]
  for (const step of steps) {
    if (Math.floor(spanHours / step) + 1 <= 6) {
      const stepMin = step * 60
      const ticks: number[] = []
      let t = Math.ceil(window.startMinutes / stepMin) * stepMin
      while (t <= window.endMinutes) {
        ticks.push(t)
        t += stepMin
      }
      return ticks.length === 0 ? [window.startMinutes, window.endMinutes] : ticks
    }
  }
  return [window.startMinutes, window.endMinutes]
}

export function intervalOf(entry: ClashTimelineEntry, window: ClashWindow): { start: number; end: number } {
  const start = Math.max(window.startMinutes, Math.min(entry.startMinutes, window.endMinutes))
  const end = Math.max(start, Math.min(entry.endMinutes, window.endMinutes))
  return { start, end }
}

export function analyse(entries: ClashTimelineEntry[], window: ClashWindow): ClashAnalysis {
  const ivs = entries.map((entry) => intervalOf(entry, window))
  const pts = [...new Set(ivs.flatMap((iv) => [iv.start, iv.end]))].sort((a, b) => a - b)
  const raw: ClashRegion[] = []
  if (pts.length >= 2) {
    for (let i = 0; i < pts.length - 1; i++) {
      const start = pts[i]
      const end = pts[i + 1]
      const concurrency = ivs.filter((iv) => iv.start < end && iv.end > start).length
      if (concurrency >= 2) raw.push({ startMinutes: start, endMinutes: end, concurrency })
    }
  }
  const regions: ClashRegion[] = []
  for (const region of raw) {
    const last = regions[regions.length - 1]
    if (last && last.endMinutes === region.startMinutes) {
      last.endMinutes = region.endMinutes
      last.concurrency = Math.max(last.concurrency, region.concurrency)
    } else {
      regions.push({ ...region })
    }
  }
  return {
    regions,
    minutes: regions.reduce((sum, region) => sum + (region.endMinutes - region.startMinutes), 0),
    peak: raw.reduce((max, region) => Math.max(max, region.concurrency), 0),
    startMinutes: regions[0]?.startMinutes,
    endMinutes: regions[regions.length - 1]?.endMinutes,
  }
}

export function clashMinutesFor(
  entry: ClashTimelineEntry,
  window: ClashWindow,
  analysis: ClashAnalysis
): number {
  const iv = intervalOf(entry, window)
  return analysis.regions.reduce((sum, region) => {
    return sum + Math.max(0, Math.min(region.endMinutes, iv.end) - Math.max(region.startMinutes, iv.start))
  }, 0)
}

export function fractionInWindow(window: ClashWindow, minutes: number): number {
  return (minutes - window.startMinutes) / windowSpan(window)
}

export function timeText(entry: ClashTimelineEntry): string {
  if (treatsAsAllDay(entry)) return 'All day'
  return `${formatClock(entry.startMinutes)}–${formatClock(entry.endMinutes)}`
}

export const CLASH_BAR_PALETTES = [
  {
    ink: '#177248',
    soft: '#DFF1E8',
    bar: 'linear-gradient(#2AA06B, #177248)',
  },
  {
    ink: '#0A5FC0',
    soft: '#E2EEFB',
    bar: 'linear-gradient(#2E85E8, #0A5FC0)',
  },
  {
    ink: '#4A3FC0',
    soft: '#E7E5FB',
    bar: 'linear-gradient(#7C6FE8, #4A3FC0)',
  },
  {
    ink: '#9A5B08',
    soft: '#FBEFD8',
    bar: 'linear-gradient(#D08A1C, #9A5B08)',
  },
] as const
