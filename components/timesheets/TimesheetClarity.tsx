/**
 * Rulebook 1.77.0 §8 (owner 23 Nov, points 1, 2, 3, 5): the timesheet's "whose turn" line, the "Changed since you signed"
 * card and the one "Correct this timesheet" entry. Presentational only — every word and every row comes from the
 * rulebook (`timesheetNextStep`, `signedTimesheetChangeDetails`, `timesheetCorrectionOption`); handlers are the page's
 * existing ones. iOS shows the same (`InvoicingView.swift`).
 */
'use client'

import { useState, type ReactNode } from 'react'
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
  return (
    <div className={`pu-nextstep ${step.tone}`} role="status" aria-live="polite">
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
export function TimesheetChangesCard({ details }: { details: SignedTimesheetChangeDetails }) {
  const [expanded, setExpanded] = useState(false)
  if (details.rows.length === 0) return null
  const rows = expanded ? details.rows : details.rows.slice(0, details.collapsedCount)
  return (
    <section className="pu-card pu-changes" aria-label={details.heading}>
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
    </section>
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
