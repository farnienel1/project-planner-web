'use client'

/**
 * Rulebook 1.16.0 §5: one conflict list for every booking flow. Double bookings are orange (`--warn`), annual leave
 * purple (`--purple`, `bookingLeaveConflicts`); pending leave is shown softer. Each row is ticked (book anyway) or ✕
 * (drop that day for that person); the flow saves only when every row is one or the other (`conflictsResolved`).
 */
import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { BOOKING_CONFLICTS_HEADING, type BookingLeaveConflict } from '@/lib/canonical'
import { leaveConflictDetail } from '@/lib/scheduling/leaveConflicts'

export type BookingConflictKind = 'double_booking' | 'annual_leave'
export type BookingConflictDecision = 'confirm' | 'drop'

export type BookingConflictRow = {
  /** Stable key: `${personId}|${dayKey}|${kind}`. */
  key: string
  personId: string
  dayKey: string
  kind: BookingConflictKind
  personName: string
  dayLabel: string
  detail: string
  /** Annual leave only: pending leave is shown softer. */
  pending?: boolean
}

export function conflictRowKey(personId: string, dayKey: string, kind: BookingConflictKind): string {
  return `${personId}|${dayKey}|${kind}`
}

/** True when every row is ticked or dropped. */
export function conflictsResolved(
  rows: ReadonlyArray<BookingConflictRow>,
  decisions: Readonly<Record<string, BookingConflictDecision | undefined>>
): boolean {
  return rows.every((row) => decisions[row.key] === 'confirm' || decisions[row.key] === 'drop')
}

/** `${personId}|${dayKey}` pairs the booker dropped. */
export function droppedPersonDays(
  rows: ReadonlyArray<BookingConflictRow>,
  decisions: Readonly<Record<string, BookingConflictDecision | undefined>>
): Set<string> {
  return new Set(rows.filter((row) => decisions[row.key] === 'drop').map((row) => `${row.personId}|${row.dayKey}`))
}

export function BookingConflictLegend() {
  return (
    <p className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink3)]">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)]" aria-hidden /> Already booked
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--purple)]" aria-hidden /> Annual leave
      </span>
    </p>
  )
}

export function BookingConflictRows({
  rows,
  decisions,
  onDecide,
  showHeading = true,
}: {
  rows: ReadonlyArray<BookingConflictRow>
  decisions: Readonly<Record<string, BookingConflictDecision | undefined>>
  onDecide: (key: string, decision: BookingConflictDecision) => void
  showHeading?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      {showHeading ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--ink)]">{BOOKING_CONFLICTS_HEADING}</p>
          <BookingConflictLegend />
        </div>
      ) : null}
      {rows.map((row) => {
        const decision = decisions[row.key]
        const leave = row.kind === 'annual_leave'
        const tone = leave ? 'var(--purple)' : 'var(--warn)'
        const tint = leave ? 'var(--purple-t)' : 'var(--warn-t)'
        return (
          <div
            key={row.key}
            className="flex items-start gap-3 rounded-xl border p-3"
            style={{
              borderColor: decision ? 'var(--line)' : tone,
              background: decision === 'drop' ? 'var(--card)' : tint,
              opacity: leave && row.pending && !decision ? 0.8 : 1,
            }}
          >
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${decision === 'drop' ? 'text-[var(--ink3)] line-through' : 'text-[var(--ink)]'}`}>
                {row.personName} · {row.dayLabel}
              </p>
              <p className="text-xs font-medium" style={{ color: decision === 'drop' ? 'var(--ink3)' : tone }}>
                {row.detail}
                {decision === 'confirm' ? ' · confirmed' : decision === 'drop' ? ' · day dropped' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onDecide(row.key, 'drop')}
                className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
                style={{
                  borderColor: 'var(--red)',
                  color: decision === 'drop' ? 'var(--card)' : 'var(--red)',
                  background: decision === 'drop' ? 'var(--red)' : 'var(--card)',
                }}
                aria-label={`Drop ${row.dayLabel} for ${row.personName}`}
                aria-pressed={decision === 'drop'}
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => onDecide(row.key, 'confirm')}
                className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
                style={{
                  borderColor: 'var(--blue)',
                  color: decision === 'confirm' ? 'var(--card)' : 'var(--blue)',
                  background: decision === 'confirm' ? 'var(--blue)' : 'var(--card)',
                }}
                aria-label={`Confirm ${row.dayLabel} for ${row.personName}`}
                aria-pressed={decision === 'confirm'}
              >
                ✓
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The same list as a confirm step for flows that save from one button (quick add, edit, Daily Overview, Book labour,
 * My Schedule). "Book" is enabled once every row is ticked or dropped; `onConfirm` gets the dropped person-days.
 */
export function BookingConflictsDialog({
  rows,
  decisions,
  onDecide,
  onCancel,
  onConfirm,
  confirmLabel = 'Book',
}: {
  rows: ReadonlyArray<BookingConflictRow>
  decisions: Readonly<Record<string, BookingConflictDecision | undefined>>
  onDecide: (key: string, decision: BookingConflictDecision) => void
  onCancel: () => void
  onConfirm: (dropped: Set<string>) => void
  confirmLabel?: string
}) {
  const ready = conflictsResolved(rows, decisions)
  // Portalled above every sheet and modal (the Modal overlay is z-100), so it is never clipped by a transformed parent.
  const node = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--card)] p-5 shadow-xl">
        <p className="text-[15px] font-semibold text-[var(--ink)]">Check these days</p>
        <div className="mt-3">
          <BookingConflictRows rows={rows} decisions={decisions} onDecide={onDecide} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            className="rounded-xl bg-[var(--blue)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={() => onConfirm(droppedPersonDays(rows, decisions))}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}

/** Leave conflicts (`bookingLeaveConflicts`) as purple rows. */
export function leaveConflictRows(
  conflicts: ReadonlyArray<BookingLeaveConflict>,
  nameFor: (personId: string) => string,
  dayLabelFor: (dayKey: string) => string
): BookingConflictRow[] {
  return conflicts.map((conflict) => ({
    key: conflictRowKey(conflict.personId, conflict.dayKey, 'annual_leave'),
    personId: conflict.personId,
    dayKey: conflict.dayKey,
    kind: 'annual_leave' as const,
    personName: nameFor(conflict.personId),
    dayLabel: dayLabelFor(conflict.dayKey),
    detail: leaveConflictDetail(conflict),
    pending: conflict.status === 'pending',
  }))
}

/**
 * A promise-based confirm step: `await gate.check(rows)` resolves at once with an empty set when there are no rows,
 * otherwise shows `BookingConflictsDialog` and resolves with the dropped person-days, or null when cancelled. Render
 * `gate.dialog` once in the flow.
 */
export function useBookingConflictGate(confirmLabel?: string) {
  const [state, setState] = useState<{
    rows: BookingConflictRow[]
    resolve: (value: Set<string> | null) => void
  } | null>(null)
  const [decisions, setDecisions] = useState<Record<string, BookingConflictDecision | undefined>>({})

  const check = useCallback((rows: BookingConflictRow[]): Promise<Set<string> | null> => {
    if (rows.length === 0) return Promise.resolve(new Set<string>())
    return new Promise((resolve) => {
      setDecisions({})
      setState({ rows, resolve })
    })
  }, [])

  const dialog = state ? (
    <BookingConflictsDialog
      rows={state.rows}
      decisions={decisions}
      confirmLabel={confirmLabel}
      onDecide={(key, decision) => setDecisions((prev) => ({ ...prev, [key]: decision }))}
      onCancel={() => {
        state.resolve(null)
        setState(null)
      }}
      onConfirm={(dropped) => {
        state.resolve(dropped)
        setState(null)
      }}
    />
  ) : null

  return { check, dialog }
}

/** The rows a single-booking sheet asks about for the slot being saved (built by the parent from its stores). */
export type BookingSlotConflictCheck = (slot: {
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
}) => BookingConflictRow[]
