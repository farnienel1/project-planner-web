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
    <div className="phead" data-hue="lib">
      <button type="button" onClick={onBack} className="btn sm ghost" aria-label="Back">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="min-w-0">
        <h1>{title}</h1>
      </div>
      {rightAction ? <div className="acts">{rightAction}</div> : null}
    </div>
  )
}
