'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { initialsFrom } from '@/lib/daily-overview/buildDailyOverview'
import {
  analyse,
  clashMinutesFor,
  CLASH_BAR_PALETTES,
  displayTitle,
  formatClock,
  formatDuration,
  fractionInWindow,
  FULL_DAY_TICKS,
  FULL_DAY_WINDOW,
  intervalOf,
  placeWord,
  timeText,
  treatsAsAllDay,
  type ClashTimelineEntry,
} from '@/lib/warnings/clashTimeline'

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function Hatch({ spacing = 7 }: { spacing?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-35"
      style={{
        backgroundImage: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.55) 0, rgba(255,255,255,0.55) 2px, transparent 2px, transparent ${spacing}px)`,
      }}
    />
  )
}

function HourGrid() {
  return (
    <>
      {FULL_DAY_TICKS.map((tick) => (
        <div
          key={`grid-${tick}`}
          className="pointer-events-none absolute inset-y-0 w-px bg-black/[0.08]"
          style={{ left: `${(tick / (24 * 60)) * 100}%` }}
        />
      ))}
    </>
  )
}

function ClashLane({
  entry,
  palette,
  analysis,
  height,
  radius,
}: {
  entry: ClashTimelineEntry
  palette: (typeof CLASH_BAR_PALETTES)[number]
  analysis: ReturnType<typeof analyse>
  height: number
  radius: number
}) {
  const window = FULL_DAY_WINDOW
  const iv = intervalOf(entry, window)
  const left = Math.max(0, fractionInWindow(window, Math.max(iv.start, window.startMinutes)))
  const right = Math.min(1, fractionInWindow(window, Math.min(iv.end, window.endMinutes)))
  const barW = Math.max(0.012, right - left)
  const allDay = treatsAsAllDay(entry)

  return (
    <div className="relative w-full overflow-hidden bg-[#EFEFF4]" style={{ height, borderRadius: radius }}>
      <HourGrid />
      {analysis.regions.map((region) => {
        const rLeft = Math.max(0, fractionInWindow(window, region.startMinutes))
        const rRight = Math.min(1, fractionInWindow(window, region.endMinutes))
        return (
          <div
            key={`${region.startMinutes}-${region.endMinutes}`}
            className="absolute inset-y-0 bg-[#B3261E]/[0.12]"
            style={{ left: `${rLeft * 100}%`, width: `${Math.max(0.2, (rRight - rLeft) * 100)}%` }}
          />
        )
      })}
      <div
        className="absolute inset-y-0 overflow-hidden"
        style={{
          left: `${left * 100}%`,
          width: `${barW * 100}%`,
          borderRadius: radius,
          background: palette.bar,
        }}
      >
        {allDay ? <Hatch spacing={9} /> : null}
        {!allDay
          ? analysis.regions.map((region) => {
              const s = Math.max(region.startMinutes, iv.start)
              const e = Math.min(region.endMinutes, iv.end)
              if (e <= s) return null
              const span = Math.max(1, iv.end - iv.start)
              const ol = ((s - iv.start) / span) * 100
              const ow = ((e - s) / span) * 100
              return (
                <div
                  key={`hatch-${region.startMinutes}`}
                  className="absolute inset-y-0 overflow-hidden"
                  style={{ left: `${ol}%`, width: `${Math.max(1, ow)}%` }}
                >
                  <Hatch />
                </div>
              )
            })
          : null}
      </div>
    </div>
  )
}

function AxisRow() {
  return (
    <div className="relative mt-1.5 h-[13px]">
      {FULL_DAY_TICKS.map((tick, index) => {
        const x = tick / (24 * 60)
        const last = index === FULL_DAY_TICKS.length - 1
        const transform = index === 0 ? 'translateX(0)' : last ? 'translateX(-100%)' : 'translateX(-50%)'
        return (
          <span
            key={tick}
            className="absolute top-0 text-[10px] font-medium tabular-nums text-[#6C6C72]"
            style={{ left: `${x * 100}%`, transform }}
          >
            {formatClock(tick)}
          </span>
        )
      })}
    </div>
  )
}

export function ClashWarningCard({
  title,
  personName,
  date,
  entries,
  busy,
  severity = 'high',
  onApprove,
  onRemove,
}: {
  title: string
  personName: string
  date: Date
  entries: ClashTimelineEntry[]
  busy?: boolean
  severity?: 'high' | 'medium'
  onApprove?: () => Promise<void>
  onRemove?: (entry: ClashTimelineEntry) => Promise<void>
}) {
  const [timelineOpen, setTimelineOpen] = useState(false)
  const analysis = useMemo(() => analyse(entries, FULL_DAY_WINDOW), [entries])
  const label = dateLabel(date)
  const hue = severity === 'medium' ? 'warn' : 'red'

  return (
    <article className="card overflow-hidden" data-hue={hue}>
      <header className="card-h" data-hue={hue}>
        <div className="ico-chip sm">
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="h2 grow" style={{ fontSize: 17 }}>{title}</p>
        <span className="pill solid" data-hue={hue}>{severity === 'medium' ? 'MEDIUM' : 'HIGH'}</span>
      </header>

      <div className="card-b stack" style={{ gap: 12 }}>
        <div>
          <p>
            <span className="font-semibold">{personName}</span> is booked in {placeWord(entries.length)} places on{' '}
            {label}.
          </p>
          <p className="muted small" style={{ marginTop: 4 }}>
            Approve if it&apos;s intentional and it&apos;ll be noted on the weekly report.
          </p>
        </div>

        <div className="ritem" style={{ cursor: 'default', boxShadow: 'none', background: 'var(--soft)' }}>
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--blue)] text-[11px] font-semibold text-white">
            {initialsFrom(personName)}
          </span>
          <span className="grow">
            <span className="t">{personName}</span>
            <span className="s">{label}</span>
          </span>
        </div>

        <div className="banner" data-hue="red" style={{ margin: 0 }}>
          <div>
            <b className="num">{formatDuration(analysis.minutes)} overlap</b>
            {analysis.startMinutes != null && analysis.endMinutes != null ? (
              <span className="muted small"> · {formatClock(analysis.startMinutes)}–{formatClock(analysis.endMinutes)}</span>
            ) : null}
            {analysis.peak > 2 ? (
              <span className="muted small"> · up to {analysis.peak} at once</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-[3px] rounded-xl bg-[#F1F2F6] px-3 pb-[7px] pt-[11px]">
          {entries.map((entry, index) => (
            <ClashLane
              key={entry.managerBookingId || entry.bookingId}
              entry={entry}
              palette={CLASH_BAR_PALETTES[index % CLASH_BAR_PALETTES.length]}
              analysis={analysis}
              height={11}
              radius={3}
            />
          ))}
          <AxisRow />
        </div>

        <div className="overflow-hidden rounded-xl border border-black/[0.08]">
          {entries.map((entry, index) => {
            const palette = CLASH_BAR_PALETTES[index % CLASH_BAR_PALETTES.length]
            const mine = clashMinutesFor(entry, FULL_DAY_WINDOW, analysis)
            return (
              <div key={entry.managerBookingId || entry.bookingId}>
                {index > 0 ? <div className="h-px bg-black/10" /> : null}
                <div className="flex items-center gap-2.5 px-[11px] py-2.5">
                  <span
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-[13px]"
                    style={{ background: palette.soft, color: palette.ink }}
                  >
                    {entry.jobNumber ? '▦' : '⌂'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold">
                      {entry.jobNumber ? (
                        <span className="mr-1 font-bold" style={{ color: palette.ink }}>
                          {entry.jobNumber}
                        </span>
                      ) : null}
                      {displayTitle(entry)}
                    </p>
                    <p className="muted small num">
                      {timeText(entry)} ·{' '}
                      <span className="font-semibold text-[var(--red)]">{formatDuration(mine)} clashing</span>
                    </p>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemove(entry)}
                      className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#EFEFF4] text-[#B3261E] disabled:opacity-50"
                      aria-label={`Remove ${displayTitle(entry)}`}
                    >
                      ⌫
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
          <div className="h-px bg-black/10" />
          <button
            type="button"
            onClick={() => setTimelineOpen((value) => !value)}
            className="btn ghost block"
          >
            {timelineOpen ? 'Hide full timeline' : 'Show full timeline'}
          </button>
        </div>

        {timelineOpen ? (
          <div className="space-y-3 rounded-xl bg-[#F1F2F6] px-3 pb-2 pt-3">
            {entries.map((entry, index) => {
              const palette = CLASH_BAR_PALETTES[index % CLASH_BAR_PALETTES.length]
              return (
                <div key={`full-${entry.managerBookingId || entry.bookingId}`}>
                  {index > 0 ? <div className="mb-3 h-px bg-black/10" /> : null}
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: palette.ink }} />
                    {entry.jobNumber ? (
                      <span className="text-[14px] font-bold" style={{ color: palette.ink }}>
                        {entry.jobNumber}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 text-[13.5px] text-[#121B23]">{displayTitle(entry)}</span>
                    <span className="text-[12.5px] font-semibold tabular-nums text-[#6C6C72]">{timeText(entry)}</span>
                  </div>
                  <ClashLane
                    entry={entry}
                    palette={palette}
                    analysis={analysis}
                    height={16}
                    radius={5}
                  />
                </div>
              )
            })}
            <AxisRow />
          </div>
        ) : null}

        {onApprove ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onApprove()}
            className="btn hue block"
            data-hue="green"
          >
            Approve for weekly report
          </button>
        ) : null}
      </div>

      <div className="card-b" style={{ paddingTop: 0 }}>
        <Link
          href={`/dashboard/daily-overview?date=${dayKey(date)}`}
          className="btn block"
        >
          Open daily overview
        </Link>
      </div>
    </article>
  )
}
