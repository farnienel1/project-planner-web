'use client'

/**
 * Rulebook 1.40.0 §4.4 (owner decisions 11 Nov H28–H35): manual annual-leave adjustments on screen.
 *
 * `LeaveAdjustmentsList` — the person sees each adjustment (amount, reason, date) on My leave; admins and their line
 * managers see the history with who made it on the person's annual leave page. `LeaveAdjustmentForm` — add or take
 * off days for this leave year with a reason (online only; admins and the person's line managers, never the person).
 * Every rule is the rulebook's: `annualLeaveAdjustmentValidationError`, `annualLeaveAdjustmentLabel`, `canAdjustAnnualLeave`.
 */

import { useState } from 'react'
import { format } from 'date-fns'
import {
  ANNUAL_LEAVE_ADJUSTMENT_NOTE,
  ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX,
  annualLeaveAdjustmentAuthorName,
  annualLeaveAdjustmentLabel,
  annualLeaveAdjustmentValidationError,
  type AnnualLeaveAdjustment,
} from '@/lib/canonical'

function when(ms: number | null): string {
  return ms ? format(new Date(ms), 'd MMM yyyy') : 'Saving…'
}

export function LeaveAdjustmentsList({
  adjustments,
  yearKey,
  showAuthor,
  hasAllowance,
  roster = [],
}: {
  /** The organisation roster: the author is shown by name from it (`annualLeaveAdjustmentAuthorName`, by `createdBy`). */
  roster?: ReadonlyArray<{ id: string; email?: string | null; firstName?: string | null; surname?: string | null; formerUserIds?: string[] | null }>
  adjustments: AnnualLeaveAdjustment[]
  /** The leave year shown (`annualLeaveBalance.yearKey`): only its adjustments are listed. */
  yearKey: string
  /** True for admins and line managers (the history with who made each one). */
  showAuthor: boolean
  hasAllowance: boolean
}) {
  const rows = adjustments.filter((row) => row.yearKey === yearKey)
  if (rows.length === 0) return null
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--card)] p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-900">Adjustments this leave year</p>
      {!hasAllowance ? (
        <p className="mt-0.5 text-xs text-slate-500">Kept, but not counted while there is no paid allowance.</p>
      ) : null}
      <ul className="mt-2 divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{row.reason || 'No reason given'}</p>
              <p className="text-xs text-slate-500">
                {when(row.createdAtMs)}
                {showAuthor ? ` · by ${annualLeaveAdjustmentAuthorName(row, roster as never)}` : ''}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-bold ${row.days < 0 ? 'text-[var(--red)]' : 'text-emerald-700'}`}>
              {annualLeaveAdjustmentLabel(row.days)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LeaveAdjustmentForm({
  personName,
  remaining,
  onSave,
}: {
  personName: string
  /** Remaining now (`annualLeaveBalance.remaining`), to show what it becomes. */
  remaining: number | null
  onSave: (days: number, reason: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(1)
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signed = direction === 'add' ? days : -days
  const after = remaining == null ? null : remaining + signed

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Adjust leave for this year
      </button>
    )
  }

  const save = async () => {
    const problem = annualLeaveAdjustmentValidationError({ days: signed, reason })
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(signed, reason)
      setOpen(false)
      setReason('')
      setDays(1)
      setDirection('add')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the adjustment. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--card)] p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-900">Adjust {personName}&apos;s leave</p>
      <p className="mt-0.5 text-xs text-slate-500">{ANNUAL_LEAVE_ADJUSTMENT_NOTE}</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or take off">
        {(['add', 'remove'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            onClick={() => setDirection(value)}
            className={`rounded-xl border py-2.5 text-sm font-semibold ${
              direction === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {value === 'add' ? 'Add days' : 'Take off days'}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
        <button
          type="button"
          aria-label="Half a day less"
          className="h-9 w-9 rounded-lg border border-slate-200 text-lg font-bold"
          onClick={() => setDays((value) => Math.max(0.5, value - 0.5))}
        >
          −
        </button>
        <span className="text-lg font-bold text-slate-900">{annualLeaveAdjustmentLabel(signed)}</span>
        <button
          type="button"
          aria-label="Half a day more"
          className="h-9 w-9 rounded-lg border border-slate-200 text-lg font-bold"
          onClick={() => setDays((value) => Math.min(365, value + 0.5))}
        >
          +
        </button>
      </div>
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-widest text-slate-400" htmlFor="leave-adjust-reason">
        Reason (required)
      </label>
      <textarea
        id="leave-adjust-reason"
        value={reason}
        maxLength={ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        placeholder="For example: long service day, or unpaid day off"
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      {after != null ? (
        <p className={`mt-2 text-xs ${after < 0 ? 'font-semibold text-[var(--red)]' : 'text-slate-500'}`}>
          Remaining becomes {after} {Math.abs(after) === 1 ? 'day' : 'days'}
          {after < 0 ? ' — below zero' : ''}.
        </p>
      ) : null}
      {error ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save adjustment'}
        </button>
      </div>
    </section>
  )
}
