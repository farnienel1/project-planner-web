import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { withTimeoutFallback } from '@/lib/client/withTimeout'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { draftAdditionalTotal, emptyTimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { draftFromFirestoreMap } from '@/lib/timesheets/timesheetStorage'
import { penceForSignedTimesheet, userIdFromTimesheetDoc } from '@/lib/timesheets/signedSheetPence'
import type { User } from '@/types'

export type SignedTimesheetValueTotals = {
  valuePence: number
  previousPence: number
  sheetCount: number
  hours: number
  missingRateCount: number
  loaded: boolean
  error?: string
}

function asPence(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  return null
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
    missingRateCount: 0,
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
  let missingRateCount = 0

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
          const orgUsers = usersByOrg.get(organizationId) || []
          const { byId } = usersForSheet(orgUsers)

          for (const entry of settingsDocs.docs) {
            if (!entry.id.startsWith('timesheet_')) continue
            const data = entry.data() as Record<string, unknown>
            const userId = userIdFromTimesheetDoc(entry.id, data)
            const user = byId.get(userId) || orgUsers.find((row) => row.id === userId)
            if (!user) continue
            const draft = draftFromFirestoreMap(data, { includeSignatures: false }) || emptyTimesheetDraft()
            if (!isTimesheetFullyApproved(draft, user)) continue
            const signedAt = draft.managerSignedAt || draft.operativeSignedAt
            const current = inRange(signedAt, input.start, input.end)
            const previous = inRange(signedAt, input.previousStart, input.previousEnd)
            if (!current && !previous) continue

            const storedHours =
              typeof data.valueHours === 'number' && Number.isFinite(data.valueHours) ? data.valueHours : 0
            const extrasPounds = draftAdditionalTotal(draft)
            const valued = penceForSignedTimesheet({
              storedValuePence: asPence(data.valuePence),
              extrasPounds,
              hoursByDate: storedHours > 0 ? [{ date: (signedAt || new Date()).toISOString().slice(0, 10), hours: storedHours }] : [],
              dayRatePence: undefined,
              hourlyRatePence: undefined,
            })
            if (current) {
              valuePence += valued.valuePence
              sheetCount += 1
              hours += storedHours
              if (valued.missingRate && !asPence(data.valuePence)) missingRateCount += 1
            }
            if (previous) previousPence += valued.valuePence
          }
        } catch (error) {
          console.warn('Signed timesheet value skipped for', organizationId, error)
        }
      })
    )
  }

  return { valuePence, previousPence, sheetCount, hours, missingRateCount, loaded: true }
}
