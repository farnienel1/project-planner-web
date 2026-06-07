'use client'

import { formatClashSummary, type OperativeBookingClash } from '@/lib/scheduling/bookingClashUtils'
import type { Operative } from '@/types'

export function OperativeClashReviewPanel({
  clashesByOperative,
  onApprove,
  onDismissOperative,
  onCancelAll,
  onConfirmBooking,
  canConfirmBooking,
  saving,
}: {
  clashesByOperative: Array<{ operative: Operative; clashes: OperativeBookingClash[] }>
  onApprove: (operativeId: string) => void
  onDismissOperative: (operativeId: string) => void
  onCancelAll: () => void
  onConfirmBooking: () => void
  canConfirmBooking: boolean
  saving?: boolean
}) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-amber-500">⚠</span>
        <p className="text-sm font-semibold text-slate-900">Warning — time overlap</p>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        These people already have a booking that overlaps this time. Approve with ✓ to add them, or ✕ to remove.
      </p>

      <div className="space-y-3">
        {clashesByOperative.map(({ operative, clashes }) => (
          <div
            key={operative.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {(operative.firstName?.[0] || operative.lastName?.[0] || 'O').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {operative.firstName} {operative.lastName}
              </p>
              <p className="mt-1 text-xs text-slate-600">{formatClashSummary(clashes)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onDismissOperative(operative.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                aria-label={`Remove ${operative.firstName} ${operative.lastName}`}
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => onApprove(operative.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                aria-label={`Approve overlap for ${operative.firstName} ${operative.lastName}`}
              >
                ✓
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCancelAll}
          className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel booking
        </button>
        <button
          type="button"
          disabled={!canConfirmBooking || saving}
          onClick={onConfirmBooking}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Booking…' : 'Confirm booking'}
        </button>
      </div>
    </div>
  )
}
