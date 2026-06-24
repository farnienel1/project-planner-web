import type { ReactNode } from 'react'

export function PanelHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string
  onBack: () => void
  rightAction?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
      >
        <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {rightAction || <div className="w-9" />}
    </div>
  )
}
