/**
 * Rulebook 1.33.0 §7: the Payrun Snapshot's reads (Weekly report, admins only — `canOpenWeeklyReport`). Every rule is
 * `payrunSnapshotRows` / `payrunSnapshotPeriods` in `@/lib/canonical`; this file only reads the documents (admins read
 * every overtime request, overtime report, claim report, price work and expense item — `overtimeViewer` in
 * firestore.rules — and every timesheet in `settings`), maps them to the rulebook's inputs and turns a cell's link into
 * a web route. Nothing is written. Online only.
 */
import { collection, getDocs, query, where } from 'firebase/firestore'
import {
  EXPENSE_ITEMS_COLLECTION,
  OVERTIME_REPORTS_COLLECTION,
  OVERTIME_REQUESTS_COLLECTION,
  OVERTIME_REVIEWS_COLLECTION,
  PAYE_CLAIM_REPORTS_COLLECTION,
  PRICE_WORK_ITEMS_COLLECTION,
  parseExpenseDocument,
  parseOvertimeReportDocument,
  parseOvertimeRequestDocument,
  parseOvertimeReviewDocument,
  parsePayeClaimReportDocument,
  parsePayrunSnapshotSheet,
  parsePriceWorkDocument,
  payrunSnapshotRows,
  type ExpenseItem,
  type OvertimeBookingInput,
  type PayrunSnapshotInput,
  type PayrunSnapshotLink,
  type PayrunSnapshotPerson,
  type PayrunSnapshotRow,
  type PayrunSnapshotSheet,
  type PriceWorkItem,
} from '@/lib/canonical'
import { db } from '@/lib/firebase/config'
import { rulebookPerson } from '@/lib/staff/rulebookPeople'
import { overtimeHref } from '@/components/overtime/overtimeUi'
import { timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import type { User } from '@/types'

/** The web `User` as the Snapshot reads it: the rulebook person plus the name and effective-dated employment fields. */
export function payrunSnapshotPerson(user: User, users: ReadonlyArray<User>): PayrunSnapshotPerson {
  return {
    ...rulebookPerson(user, users),
    firstName: user.firstName ?? null,
    surname: user.surname ?? null,
    passwordSet: typeof user.passwordSet === 'boolean' ? user.passwordSet : null,
    isActive: typeof user.isActive === 'boolean' ? user.isActive : null,
    employmentType: user.employmentType ?? null,
    employmentTypeTransitionFrom: user.employmentTypeTransitionFrom ?? null,
    employmentTypeEffectiveAt: user.employmentTypeEffectiveAt ?? null,
  } as PayrunSnapshotPerson
}

type Loaded = Omit<PayrunSnapshotInput, 'roster' | 'organization' | 'period' | 'timeZone' | 'bookings' | 'operatives'>

async function readAll<T>(organizationId: string, name: string, parse: (id: string, data: Record<string, unknown>) => T): Promise<T[]> {
  const snap = await getDocs(collection(db, 'organizations', organizationId, name))
  return snap.docs.map((row) => parse(row.id, row.data()))
}

/**
 * Timesheets of the given people: `settings` where `userId` is theirs — the same query User Timesheets and the weekly
 * report feed already make (`listTimesheetStates`), one per id. A failed read leaves that person's sheets out.
 */
async function readSheets(organizationId: string, userIds: ReadonlyArray<string>, timeZone: string): Promise<PayrunSnapshotSheet[]> {
  const unique = Array.from(new Set(userIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
  const results = await Promise.all(
    unique.map((userId) =>
      getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId))).catch(() => null)
    )
  )
  return results.flatMap((snap) =>
    snap ? snap.docs.map((row) => parsePayrunSnapshotSheet(row.id, row.data(), timeZone)).filter((row): row is PayrunSnapshotSheet => row != null) : []
  )
}

/**
 * Reads everything the Snapshot needs once (the period changes only filter it): every overtime request and report,
 * every overtime review (1.33.0: a report's out-of-date check reads its range's live lines), every claim report, price
 * work and expense item of the company, and the timesheets of everyone on the roster. The bookings come from the
 * caller (the weekly report already holds every booking, `fullHistory`).
 */
export async function loadPayrunSnapshotInputs(input: { organizationId: string; users: ReadonlyArray<User>; timeZone: string }): Promise<Loaded> {
  const { organizationId, timeZone } = input
  const ids = input.users.flatMap((user) => [user.id, ...(user.formerUserIds ?? [])])
  const [sheets, overtimeRequests, overtimeReviews, overtimeReports, payeClaimReports, priceWork, expenses] = await Promise.all([
    readSheets(organizationId, ids, timeZone),
    readAll(organizationId, OVERTIME_REQUESTS_COLLECTION, parseOvertimeRequestDocument),
    readAll(organizationId, OVERTIME_REVIEWS_COLLECTION, parseOvertimeReviewDocument),
    readAll(organizationId, OVERTIME_REPORTS_COLLECTION, parseOvertimeReportDocument),
    readAll(organizationId, PAYE_CLAIM_REPORTS_COLLECTION, parsePayeClaimReportDocument),
    readAll<PriceWorkItem>(organizationId, PRICE_WORK_ITEMS_COLLECTION, (id, data) => parsePriceWorkDocument(id, data, { timeZone, organizationId }) as PriceWorkItem),
    readAll<ExpenseItem>(organizationId, EXPENSE_ITEMS_COLLECTION, (id, data) => parseExpenseDocument(id, data, { timeZone, organizationId }) as ExpenseItem),
  ])
  return { sheets, overtimeRequests, overtimeReviews, overtimeReports, payeClaimReports, priceWork, expenses }
}

/** The rows for one period (`payrunSnapshotRows`). */
export function payrunSnapshotRowsFor(input: {
  loaded: Loaded
  users: ReadonlyArray<User>
  organization: unknown
  period: { start: string; end: string }
  timeZone: string
  /** Every booking of the company as overtime inputs (`overtimeBookingInputs`), for the reports' out-of-date check. */
  bookings: ReadonlyArray<OvertimeBookingInput> | null
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
}): PayrunSnapshotRow[] {
  const list = input.users.filter((user) => user && user.id)
  return payrunSnapshotRows({
    ...input.loaded,
    roster: list.map((user) => payrunSnapshotPerson(user, list)),
    organization: input.organization,
    period: input.period,
    timeZone: input.timeZone,
    bookings: input.bookings,
    operatives: input.operatives,
  })
}

/** Where a cell opens on web: the person's timesheet for that pay run, or Users' Overtime / Expenses / Price work. */
export function payrunSnapshotHref(link: PayrunSnapshotLink): string {
  if (link.kind === 'timesheet') return timesheetsTeamHref({ user: link.personId, period: link.start, periodEnd: link.end })
  const section = link.kind === 'overtime' ? 'overtime' : link.kind === 'expenses' ? 'expenses' : 'priceWork'
  return overtimeHref({ scope: 'users', user: link.personId, section, range: 'custom', start: link.start, end: link.end })
}
