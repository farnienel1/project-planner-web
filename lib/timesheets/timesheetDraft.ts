/**
 * iOS parity: Models/TimesheetDraftModels.swift
 */

export type TimesheetManagerDecision = 'pending' | 'approved' | 'declined' | 'edited'

export type TimesheetPayrollLineReview = {
  decision: TimesheetManagerDecision
  revisedAmount?: number | null
}

export type TimesheetExpenseEntry = {
  id: string
  title: string
  details: string
  jobNumber: string
  date: Date
  amount: number
  receiptName?: string | null
  managerDecision: TimesheetManagerDecision
  managerRevisedAmount?: number | null
}

export type TimesheetPriceWorkEntry = {
  id: string
  title: string
  details: string
  jobNumber: string
  agreedManagerName: string
  startDate: Date
  endDate?: Date | null
  amount: number
  managerDecision: TimesheetManagerDecision
  managerRevisedAmount?: number | null
}

/** Shared with iOS `TimesheetWeeklyReportLabourLine`. `bookingId` is "" when unknown. */
export type WeeklyReportLabourLine = {
  id: string
  date: Date
  jobNumber: string
  projectName: string
  locationKind: 'project' | 'small_work' | 'office' | 'working_from_home' | 'site_survey' | 'custom' | string
  details: string
  paidHours: number
  days: number
  amount: number
  isOvertime: boolean
  decision: TimesheetManagerDecision
  bookingId: string
}

/** Shared with iOS `TimesheetWeeklyReportMoneyLine`. */
export type WeeklyReportMoneyLine = {
  id: string
  title: string
  details: string
  jobNumber: string
  date: Date
  amount: number
  decision: TimesheetManagerDecision
}

/**
 * Written on `organizations/{orgId}/settings/timesheet_{userId}_{weekStartUnix}`
 * when the timesheet is fully approved. Cleared when signatures are cleared.
 */
export type WeeklyReportOverride = {
  approvedAt: Date
  approvedByUserId: string
  approvedByName: string
  selfSigned: boolean
  lines: WeeklyReportLabourLine[]
  priceWork: WeeklyReportMoneyLine[]
  expenses: WeeklyReportMoneyLine[]
}

export type TimesheetDraft = {
  expenseEntries: TimesheetExpenseEntry[]
  priceWorkEntries: TimesheetPriceWorkEntry[]
  payrollLineReviews: Record<string, TimesheetPayrollLineReview>
  managerNote: string
  operativeSignedAt?: Date | null
  operativeSignedByName?: string | null
  operativeSignatureImageBase64?: string | null
  managerSignedAt?: Date | null
  managerSignedByName?: string | null
  managerSignedByUserId?: string | null
  managerSignatureImageBase64?: string | null
  exportedAt?: Date | null
  weeklyReportOverride?: WeeklyReportOverride | null
}

export function emptyTimesheetDraft(): TimesheetDraft {
  return {
    expenseEntries: [],
    priceWorkEntries: [],
    payrollLineReviews: {},
    managerNote: '',
  }
}

export function draftAdditionalTotal(draft: TimesheetDraft): number {
  return (
    draft.expenseEntries.reduce((sum, item) => sum + item.amount, 0) +
    draft.priceWorkEntries.reduce((sum, item) => sum + item.amount, 0)
  )
}

export function decisionLabel(decision: TimesheetManagerDecision): string {
  switch (decision) {
    case 'pending':
      return 'Awaiting review'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    case 'edited':
      return 'Edited'
    default:
      return 'Awaiting review'
  }
}

/** iOS TimesheetManagerDecision.tint */
export function decisionTint(decision: TimesheetManagerDecision): string {
  switch (decision) {
    case 'pending':
      return '#FF9500'
    case 'approved':
      return '#34C759'
    case 'declined':
      return '#FF3B30'
    case 'edited':
      return '#007AFF'
    default:
      return '#FF9500'
  }
}

export function reviewSelection(decision: TimesheetManagerDecision): TimesheetManagerDecision {
  return decision === 'pending' ? 'approved' : decision
}
