import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { organizationTimeZone } from '@/lib/canonical/organizationTimeZone'
import { db } from '@/lib/firebase/config'
import { withTimeoutFallback } from '@/lib/client/withTimeout'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { emptyTimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { timesheetTotals } from '@/lib/canonical/timesheetTotals'
import { formatMoney, resolveOrganizationCurrency } from '@/lib/canonical/money'
import { draftFromFirestoreMap } from '@/lib/timesheets/timesheetStorage'
import type { User } from '@/types'

export type SignedTimesheetValueTotals = {
  valuePence: number
  previousPence: number
  sheetCount: number
  hours: number
  /**
   * Rulebook 1.46.0: fully signed sheets with no signed snapshot (`weeklyReportOverride`). This screen does not load
   * bookings, so their labour cannot be priced here and only their price work and expenses count.
   */
  labourNotCountedCount: number
  /**
   * Rulebook 1.46.0 (review): `valuePence`, `previousPence`, `sheetCount` and `hours` cover organisations whose money is
   * GBP only (`resolveOrganizationCurrency`); money is never added across currencies. Other currencies are listed here.
   */
  otherCurrencies: { currency: string; pence: number; sheetCount: number }[]
  loaded: boolean
  error?: string
}

/** The person a stored timesheet belongs to: its `userId`, else the uid in `timesheet_{uid}_{period}`. */
export function userIdFromTimesheetDoc(docId: string, data: Record<string, unknown>): string {
  if (typeof data.userId === 'string' && data.userId.trim()) return data.userId.trim()
  if (!docId.startsWith('timesheet_')) return ''
  const rest = docId.slice('timesheet_'.length)
  const cut = rest.lastIndexOf('_')
  return cut > 0 ? rest.slice(0, cut) : ''
}

/**
 * Rulebook 1.46.0 (§8): the value of one fully signed timesheet as its invoice pays it — `timesheetTotals` over the
 * stored sheet (its signed snapshot `weeklyReportOverride` when present: labour, price work and expenses at their
 * signed amounts). With no snapshot only the price work and expenses count (`labourCounted` false). Before 1.46.0 this
 * screen had its own calculator (an 8-hour day, a 1.5 cap, GBP) fed no rates, so labour always read £0.
 */
export function signedTimesheetValue(sheet: Record<string, unknown>): { pence: number; hours: number; labourCounted: boolean } {
  const override = sheet.weeklyReportOverride
  const labourCounted = Boolean(override) && typeof override === 'object'
  // Hours (1.46.0 review): `timesheetTotals` over the signed lines (declined left out), as the sheet showed them when
  // signed — weighted paid hours, overtime at its multiplier. No snapshot: no labour lines, so 0 hours.
  const snapshotLines = labourCounted && Array.isArray((override as Record<string, unknown>).lines)
    ? ((override as Record<string, unknown>).lines as unknown[])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .filter((row) => row.decision !== 'declined')
        .map((row) => ({
          id: String(row.id ?? ''),
          amount: typeof row.amount === 'number' ? row.amount : 0,
          paidHours: typeof row.paidHours === 'number' ? row.paidHours : 0,
          isOvertimeLine: row.isOvertime === true,
          otMultiplier: typeof row.otMultiplier === 'number' ? row.otMultiplier : null,
        }))
    : []
  const totals = timesheetTotals({ sheet, payrollLines: snapshotLines, extrasMode: 'decided' })
  return { pence: Math.round(totals.total * 100), hours: totals.hours, labourCounted }
}

function inRange(date: Date | null | undefined, start: Date, end: Date): boolean {
  if (!date) return false
  const ms = date.getTime()
  return ms >= start.getTime() && ms <= end.getTime()
}

function usersForSheet(orgUsers: User[]) {
  const byId = new Map(orgUsers.map((user) => [user.id, user]))
  const byEmail = new Map(orgUsers.map((user) => [user.email.toLowerCase(), user]))
  return { byId, byEmail }
}

export async function loadSignedTimesheetValueTotals(input: {
  organizationIds: string[]
  users: User[]
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}): Promise<SignedTimesheetValueTotals> {
  const empty: SignedTimesheetValueTotals = {
    valuePence: 0,
    previousPence: 0,
    sheetCount: 0,
    hours: 0,
    labourNotCountedCount: 0,
    otherCurrencies: [],
    loaded: true,
  }
  if (!db) return empty
  const usersByOrg = new Map<string, User[]>()
  for (const user of input.users) {
    const list = usersByOrg.get(user.organizationId) || []
    list.push(user)
    usersByOrg.set(user.organizationId, list)
  }

  let valuePence = 0
  let previousPence = 0
  let sheetCount = 0
  let hours = 0
  let labourNotCountedCount = 0
  const otherCurrencies = new Map<string, { currency: string; pence: number; sheetCount: number }>()

  const ids = input.organizationIds.filter(Boolean)
  for (let i = 0; i < ids.length; i += 4) {
    const batch = ids.slice(i, i + 4)
    await Promise.all(
      batch.map(async (organizationId) => {
        try {
          const settingsDocs = await withTimeoutFallback(
            getDocs(collection(db!, 'organizations', organizationId, 'settings')),
            8000,
            null
          )
          if (!settingsDocs) return
          // Day keys use the organisation's business zone (`organizationTimeZone`), never UTC.
          const orgDoc = await withTimeoutFallback(getDoc(doc(db!, 'organizations', organizationId)), 8000, null)
          const country = orgDoc?.exists() ? (orgDoc.data() as Record<string, unknown>).countryCode : null
          const timeZone = organizationTimeZone(typeof country === 'string' ? country : null)
          const currency = resolveOrganizationCurrency(orgDoc?.exists() ? orgDoc.data() : null)
          const orgUsers = usersByOrg.get(organizationId) || []
          const { byId } = usersForSheet(orgUsers)

          for (const entry of settingsDocs.docs) {
            if (!entry.id.startsWith('timesheet_')) continue
            const data = entry.data() as Record<string, unknown>
            const userId = userIdFromTimesheetDoc(entry.id, data)
            const user = byId.get(userId) || orgUsers.find((row) => row.id === userId)
            if (!user) continue
            const draft = draftFromFirestoreMap(data, { includeSignatures: false, sheetDocId: entry.id, timeZone }) || emptyTimesheetDraft()
            if (!isTimesheetFullyApproved(draft, user, orgUsers)) continue
            const signedAt = draft.managerSignedAt || draft.operativeSignedAt
            const current = inRange(signedAt, input.start, input.end)
            const previous = inRange(signedAt, input.previousStart, input.previousEnd)
            if (!current && !previous) continue

            const valued = signedTimesheetValue(data)
            if (currency !== 'GBP') {
              if (current) {
                const row = otherCurrencies.get(currency) ?? { currency, pence: 0, sheetCount: 0 }
                row.pence += valued.pence
                row.sheetCount += 1
                otherCurrencies.set(currency, row)
              }
              continue
            }
            if (current) {
              valuePence += valued.pence
              sheetCount += 1
              hours += valued.hours
              if (!valued.labourCounted) labourNotCountedCount += 1
            }
            if (previous) previousPence += valued.pence
          }
        } catch (error) {
          console.warn('Signed timesheet value skipped for', organizationId, error)
        }
      })
    )
  }

  return {
    valuePence,
    previousPence,
    sheetCount,
    hours: Math.round(hours * 100) / 100,
    labourNotCountedCount,
    otherCurrencies: Array.from(otherCurrencies.values()),
    loaded: true,
  }
}

/** Owner screen note for organisations in other currencies (never added to the £ figure). */
export function otherCurrenciesNote(rows: SignedTimesheetValueTotals['otherCurrencies']): string {
  if (!rows.length) return ''
  return `Not in the £ figure (other currencies): ${rows
    .map((row) => `${formatMoney(row.pence / 100, row.currency)} (${row.sheetCount} sheet${row.sheetCount === 1 ? '' : 's'})`)
    .join(', ')}`
}
