'use client'

import type { TimesheetInputsState } from '@/lib/timesheets/timesheetInputs'

/** Shown while the pay settings / pay-rate history are loading, or with Retry when they failed. */
export function PayInputsBanner({ inputs }: { inputs: TimesheetInputsState }) {
  if (inputs.ready || !inputs.message) return null
  if (!inputs.failed) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
        {inputs.message}
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <p className="grow">{inputs.message}</p>
      <button
        type="button"
        onClick={inputs.retry}
        className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
      >
        Retry
      </button>
    </div>
  )
}
