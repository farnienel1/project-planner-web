/**
 * Rulebook 1.77.0 §8 (owner 23 Nov, points 1, 2, 3, 5): the timesheet's "whose turn" line, the "Changed since you signed"
 * card and the one "Correct this timesheet" entry. Presentational only — every word and every row comes from the
 * rulebook (`timesheetNextStep`, `signedTimesheetChangeDetails`, `timesheetCorrectionOption`); handlers are the page's
 * existing ones. iOS shows the same (`InvoicingView.swift`).
 */
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SignedTimesheetChangeDetails, TimesheetChangeRow, TimesheetCorrectionOption, TimesheetNextStep } from '@/lib/canonical'
import { TIMESHEET_GENERATE_INVOICE_PROMPT } from '@/lib/canonical'
import { Chip, PuButton } from '@/components/ui/page'

const STEP_LABEL: Record<TimesheetNextStep['tone'], string> = {
  action: 'Your turn',
  waiting: 'Waiting',
  done: 'Done',
}

/** Point 2 (and 5): one line at the top of the timesheet; Generate invoice right there on a signed-off sheet. */
export function TimesheetNextStepLine({
  step,
  invoiceButton,
}: {
  step: TimesheetNextStep
  /** Point 5: the page's existing Generate invoice button (same handler and disabled state). */
  invoiceButton?: ReactNode
}) {
  // Review of 1.77.0 (nit d): screen readers hear the line only when its text changes (never on every re-render or on
  // first load — the line is read with the page). The visible box is not a live region.
  const previous = useRef(step.text)
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    if (previous.current === step.text) return
    previous.current = step.text
    setAnnounced(step.text)
  }, [step.text])
  return (
    <div className={`pu-nextstep ${step.tone}`}>
      <span className="sr-only" role="status" aria-live="polite">
        {announced}
      </span>
      <span className="pu-nextstep-dot" aria-hidden="true" />
      <div className="pu-nextstep-body">
        <span className="pu-nextstep-k">{step.generateInvoice ? TIMESHEET_GENERATE_INVOICE_PROMPT : STEP_LABEL[step.tone]}</span>
        <b className="pu-nextstep-t">{step.text}</b>
      </div>
      {step.generateInvoice && invoiceButton ? <div className="pu-nextstep-act">{invoiceButton}</div> : null}
    </div>
  )
}

const CHIP_TONE: Record<TimesheetChangeRow['tone'], 'green' | 'red' | 'amber'> = { green: 'green', red: 'red', amber: 'amber' }

function ChangeRow({ row }: { row: TimesheetChangeRow }) {
  return (
    <li className="pu-change" aria-label={row.accessibilityLabel}>
      <div className="pu-change-where" aria-hidden="true">
        {row.dayLabel ? <span className="pu-change-day">{row.dayLabel}</span> : null}
        <span className="pu-change-title">{row.title}</span>
      </div>
      <div className="pu-change-what" aria-hidden="true">
        {row.beforeText ? <s className="pu-change-old">{row.beforeText}</s> : null}
        {row.beforeText && row.afterText ? <span className="pu-change-arrow">→</span> : null}
        {row.afterText ? <b className="pu-change-new">{row.afterText}</b> : null}
        <Chip tone={CHIP_TONE[row.tone]}>{row.chipLabel}</Chip>
      </div>
    </li>
  )
}

/** Point 3: one tidy card, one compact row per change; three rows, then "Show all (N)". */
export function TimesheetChangesCard({ details, embedded }: { details: SignedTimesheetChangeDetails; embedded?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  if (details.rows.length === 0) return null
  const rows = expanded ? details.rows : details.rows.slice(0, details.collapsedCount)
  const Tag = embedded ? 'div' : 'section'
  return (
    <Tag className={embedded ? 'pu-changes embedded' : 'pu-card pu-changes'} aria-label={details.heading} role={embedded ? 'group' : undefined}>
      <div className="pu-card-h">
        <h2>
          {details.heading}
          {details.summary ? <span className="pu-card-sub" style={{ display: 'block' }}>{details.summary}</span> : null}
        </h2>
        <span className="pu-count">{details.rows.length}</span>
      </div>
      <ul className="pu-change-list">
        {rows.map((row) => (
          <ChangeRow key={row.key} row={row} />
        ))}
      </ul>
      {details.showAllLabel ? (
        <div className="pu-change-more">
          <button type="button" className="pu-linkbtn" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Show fewer' : details.showAllLabel}
          </button>
        </div>
      ) : null}
    </Tag>
  )
}

/** Point 1: the one "Correct this timesheet" entry with one help line saying exactly what will happen. */
export function TimesheetCorrectionEntry({
  option,
  disabled,
  onCorrect,
  active,
}: {
  option: TimesheetCorrectionOption
  disabled?: boolean
  onCorrect: () => void
  /** Make changes is open: the page shows its own Stop control instead. */
  active?: ReactNode
}) {
  if (!option.action) return null
  return (
    <div className="pu-correct">
      {active ?? (option.hasButton ? (
        <PuButton variant="primary" block disabled={disabled} onClick={onCorrect}>
          {option.label}
        </PuButton>
      ) : (
        <b className="pu-correct-t">{option.label}</b>
      ))}
      {option.help ? <p className="pu-sub" style={{ margin: 0 }}>{option.help}</p> : null}
    </div>
  )
}

/**
 * Rulebook 1.90.0 (owner 24 Nov, point 5): the one status card at the top of a timesheet, under the band — whose turn
 * (`timesheetNextStep`), any error (red, inside the card), the actions for this state (Correct this timesheet, Stop
 * making changes, a draft revision's Save changes and send / Cancel revision, Generate invoice) and one help line.
 * Presentational only; every word comes from the rulebook or the page's existing copy.
 */
export function TimesheetStatusCard({
  step,
  error,
  actions,
  help,
  invoiceButton,
  children,
}: {
  step: TimesheetNextStep
  error?: string | null
  actions?: ReactNode
  help?: string | null
  invoiceButton?: ReactNode
  /** 1.90.0 (owner 24 Nov): what changed and every notice, inside the same card, above the actions. */
  children?: ReactNode
}) {
  const previous = useRef(step.text)
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    if (previous.current === step.text) return
    previous.current = step.text
    setAnnounced(step.text)
  }, [step.text])
  return (
    <section className={`pu-card pu-status ${step.tone}`} aria-label="Timesheet status">
      <span className="sr-only" role="status" aria-live="polite">
        {announced}
      </span>
      <div className="pu-status-head">
        <span className="pu-nextstep-dot" aria-hidden="true" />
        <div className="pu-nextstep-body">
          <span className="pu-nextstep-k">{step.generateInvoice ? TIMESHEET_GENERATE_INVOICE_PROMPT : STEP_LABEL[step.tone]}</span>
          <b className="pu-nextstep-t">{step.text}</b>
        </div>
        {step.generateInvoice && invoiceButton ? <div className="pu-nextstep-act">{invoiceButton}</div> : null}
      </div>
      {error ? (
        <div className="pu-status-error" role="alert">
          {error}
        </div>
      ) : null}
      {children}
      {actions ? <div className="pu-status-actions">{actions}</div> : null}
      {help ? <p className="pu-status-help">{help}</p> : null}
    </section>
  )
}

export type TimesheetNotice = {
  key: string
  tone: 'info' | 'amber' | 'green'
  content: ReactNode
}

/**
 * Rulebook 1.90.0 (owner 24 Nov, points 3 and 5): every notice about the timesheet in ONE calm card — booking updates,
 * what the reviewer may change, the revision and its difference, a revision due, overlapping bookings — one row each
 * with a small coloured marker, instead of a stack of coloured tiles. `footer` holds Earlier versions.
 */
export function TimesheetNoticesCard({
  notices,
  footer,
  embedded,
}: {
  notices: ReadonlyArray<TimesheetNotice>
  footer?: ReactNode
  /** Inside the status card (no card of its own). */
  embedded?: boolean
}) {
  if (notices.length === 0 && !footer) return null
  const Tag = embedded ? 'div' : 'section'
  return (
    <Tag className={embedded ? 'pu-notices embedded' : 'pu-card pu-notices'} aria-label="Notes on this timesheet" role={embedded ? 'group' : undefined}>
      {notices.length > 0 ? (
        <ul className="pu-notices-list">
          {notices.map((notice) => (
            <li key={notice.key} className={`pu-notice-row ${notice.tone}`}>
              <span className="pu-notice-mark" aria-hidden="true" />
              <div className="pu-notice-text">{notice.content}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? <div className="pu-notices-foot">{footer}</div> : null}
    </Tag>
  )
}
