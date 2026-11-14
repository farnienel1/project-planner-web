import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { organizationTimeZone } from '@/lib/canonical/organizationTimeZone'
import { db } from '@/lib/firebase/config'
import { withTimeoutFallback } from '@/lib/client/withTimeout'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { emptyTimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { timesheetTotals } from '@/lib/canonical/timesheetTotals'
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
export function signedTimesheetValue(sheet: Record<string, unknown>): { pence: number; labourCounted: boolean } {
  const totals = timesheetTotals({ sheet, payrollLines: [], extrasMode: 'decided' })
  const labourCounted = Boolean(sheet.weeklyReportOverride) && typeof sheet.weeklyReportOverride === 'object'
  return { pence: Math.round(totals.total * 100), labourCounted }
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

            const storedHours =
              typeof data.valueHours === 'number' && Number.isFinite(data.valueHours) ? data.valueHours : 0
            const valued = signedTimesheetValue(data)
            if (current) {
              valuePence += valued.pence
              sheetCount += 1
              hours += storedHours
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

  return { valuePence, previousPence, sheetCount, hours, labourNotCountedCount, loaded: true }
}
