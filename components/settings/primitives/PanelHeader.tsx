import type { ReactNode } from 'react'

/**
 * Settings page header. `description`, `iconPath` and `hue` are optional, so
 * existing callers (e.g. the Book labour flow) render exactly as before.
 */
export function PanelHeader({
  title,
  onBack,
  rightAction,
  description,
  iconPath,
  hue = 'lib',
}: {
  title: string
  onBack: () => void
  rightAction?: ReactNode
  description?: string
  iconPath?: string
  hue?: string
}) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-semibold text-[var(--ink3)] transition hover:text-[var(--ink)]"
        aria-label="Back"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="flex items-start gap-3.5" data-hue={hue}>
        {iconPath ? (
          <span className="ico-chip" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={iconPath} />
            </svg>
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">{title}</h1>
          {description ? <p className="mt-1 text-[14.5px] text-[var(--ink2)]">{description}</p> : null}
        </div>
        {rightAction ? <div className="flex shrink-0 items-center gap-2">{rightAction}</div> : null}
      </div>
    </div>
  )
}
