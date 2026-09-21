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
        className="iconbtn"
        aria-label="Back"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 className="text-base font-bold text-[var(--ink)]">{title}</h2>
      {rightAction || <div className="w-11" />}
    </div>
  )
}
