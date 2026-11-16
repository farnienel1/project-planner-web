'use client'

import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { CONSOLE_EVENTS_CAP, consoleEventsState } from '@/lib/analytics/consolePeriod'
import { formatOwnerWhen } from '@/lib/analytics/ownerDirectory'

/**
 * Every page that counts product events says when those counts are not complete (review of #348, M2): loading, could
 * not be read, loaded only from a later day, or cut short at CONSOLE_EVENTS_CAP. `from` is the first instant the page
 * counts (null = all time).
 */
export function ConsoleEventsNotice({ from }: { from: Date | null }) {
  const { eventsSince, eventsTruncated, eventsError, loading } = useAnalyticsStore()
  const state = consoleEventsState({ since: eventsSince, truncated: eventsTruncated, error: eventsError, loading }, from)
  if (state === 'complete') return null
  const tone = state === 'error' || state === 'cut_short' || state === 'partial' ? 'warn' : 'muted'
  const text =
    state === 'error'
      ? `${eventsError} Event counts on this page are not shown as real.`
      : state === 'loading'
        ? 'Loading the product events for this period…'
        : state === 'partial'
          ? `Event counts are partial: events are loaded only from ${formatOwnerWhen(eventsSince || undefined)}. Refresh to load the whole period.`
          : `Cut short: only the newest ${CONSOLE_EVENTS_CAP.toLocaleString('en-GB')} product events and sessions of this period are counted, so the event figures on this page are lower than the real ones. Pick a shorter period for complete counts.`
  return (
    <p
      role={tone === 'warn' ? 'alert' : 'status'}
      data-testid="console-events-notice"
      data-state={state}
      className={
        tone === 'warn'
          ? 'rounded-[10px] border border-[var(--dash-amber)] bg-[var(--dash-tag-amber-bg)] px-3 py-2 text-[12.5px] text-[var(--dash-tag-amber-ink)]'
          : 'text-xs text-[var(--dash-muted)]'
      }
    >
      {text}
    </p>
  )
}
