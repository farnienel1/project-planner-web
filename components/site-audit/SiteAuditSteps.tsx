'use client'

/** The New site audit page's steps (display only): Job, Details, Photos, Review & save. */
export const SITE_AUDIT_NEW_STEPS = ['Job', 'Details', 'Photos', 'Review & save'] as const

export function SiteAuditSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="sa-steps" aria-label="New site audit steps">
      {SITE_AUDIT_NEW_STEPS.map((label, index) => {
        const number = index + 1
        const state = number < current ? 'done' : number === current ? 'on' : 'todo'
        return (
          <li key={label} className={`sa-step ${state}`} aria-current={state === 'on' ? 'step' : undefined}>
            <span className="sa-step-n" aria-hidden="true">
              {state === 'done' ? '✓' : number}
            </span>
            <span className="sa-step-t">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
