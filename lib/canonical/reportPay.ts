/**
 * Pay cells on the weekly report and its exports. A PAYE person stays on the
 * report with every booking and hour, but their pay is never shown and never
 * added to a pay total: the cell reads PAYE instead of £0. Self-employed lines
 * show their pay and count toward the totals. Web and iOS both call these;
 * neither decides in a screen or export whether a pay figure is shown.
 *
 * Whether a person is PAYE on a day is `employmentTypeOnDay` (userProfile.ts).
 */

import { normalizeEmploymentType } from './userProfile'

/** Text in a PAYE person's pay cell, on screen and in every export. */
export const PAYE_PAY_CELL_LABEL = 'PAYE'

export type ReportPayLineInput = {
  /** True when `employmentTypeOnDay` is `paye` for the day(s) on this line. */
  isPaye?: boolean | null
  /** Stored employment type, used only when `isPaye` is not given. */
  employmentType?: string | null
  pay?: number | null
}

export type ReportPayCell = {
  /** The figure to show, or null when the cell shows `label` (or nothing). */
  pay: number | null
  /** `PAYE` for a PAYE line; null otherwise. */
  label: string | null
  countsTowardPayTotal: boolean
}

function roundPennies(value: number): number {
  return Math.round(value * 100) / 100
}

function lineIsPaye(line: ReportPayLineInput): boolean {
  if (line.isPaye === true) return true
  if (line.isPaye === false) return false
  if (line.employmentType == null || String(line.employmentType).trim() === '') return false
  return normalizeEmploymentType(line.employmentType) === 'paye'
}

/** One pay line. PAYE shows the label and no figure; a missing or non-finite pay shows nothing. */
export function reportPayCell(line: ReportPayLineInput): ReportPayCell {
  if (lineIsPaye(line)) return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false }
  const pay = typeof line.pay === 'number' && Number.isFinite(line.pay) ? roundPennies(line.pay) : null
  return { pay, label: null, countsTowardPayTotal: pay != null }
}

/** Sum of the lines that count toward pay, in pence-rounded pounds. PAYE lines add nothing. */
export function reportPayTotal(lines: ReadonlyArray<ReportPayLineInput>): number {
  let total = 0
  for (const line of lines) {
    const cell = reportPayCell(line)
    if (cell.countsTowardPayTotal && cell.pay != null) total += cell.pay
  }
  return roundPennies(total)
}

/**
 * A person's total row. When every line is PAYE the total reads PAYE too.
 * A person who changed type inside the period totals only the self-employed lines.
 */
export function reportPersonPayCell(lines: ReadonlyArray<ReportPayLineInput>): ReportPayCell {
  if (lines.length > 0 && lines.every(lineIsPaye)) {
    return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false }
  }
  return { pay: reportPayTotal(lines), label: null, countsTowardPayTotal: true }
}
