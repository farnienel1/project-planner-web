import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { parseBooking, parseManagerSiteBooking, parseOperative } from '@/lib/ios-parity/converters'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { draftAdditionalTotal, emptyTimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { draftFromFirestoreMap } from '@/lib/timesheets/timesheetStorage'
import { ratePenceFromPounds } from '@/lib/timesheets/timesheetValue'
import { penceForSignedTimesheet, userIdFromTimesheetDoc } from '@/lib/timesheets/signedSheetPence'
import {
  buildTimesheetSubjects,
  collectSubjectDayEntries,
  weekRangeFromStart,
} from '@/lib/timesheets/timesheetWeekUtils'
import type { User } from '@/types'

export type SignedTimesheetValueTotals = {
  valuePence: number
  previousPence: number
  sheetCount: number
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

async function loadCollection(organizationId: string, name: string) {
  if (!db) return []
  const snap = await getDocs(collection(db, 'organizations', organizationId, name))
  return snap.docs
}

export async function loadSignedTimesheetValueTotals(input: {
  organizationIds: string[]
  users: User[]
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}): Promise<SignedTimesheetValueTotals> {
  if (!db) return { valuePence: 0, previousPence: 0, sheetCount: 0, missingRateCount: 0, loaded: true }
  const usersByOrg = new Map<string, User[]>()
  for (const user of input.users) {
    const list = usersByOrg.get(user.organizationId) || []
    list.push(user)
    usersByOrg.set(user.organizationId, list)
  }

  let valuePence = 0
  let previousPence = 0
  let sheetCount = 0
  let missingRateCount = 0

  const ids = input.organizationIds.filter(Boolean)
  for (let i = 0; i < ids.length; i += 3) {
    const batch = ids.slice(i, i + 3)
    await Promise.all(
      batch.map(async (organizationId) => {
        try {
          const [settingsDocs, bookingDocs, managerDocs, operativeDocs] = await Promise.all([
            loadCollection(organizationId, 'settings'),
            loadCollection(organizationId, 'bookings'),
            loadCollection(organizationId, 'managerSiteBookings'),
            loadCollection(organizationId, 'operatives'),
          ])
          const orgUsers = usersByOrg.get(organizationId) || []
          const usersById = new Map(orgUsers.map((user) => [user.id, user]))
          const operatives = operativeDocs
            .map((row) => parseOperative(row.id, row.data() as Record<string, unknown>, organizationId))
            .flatMap((parsed) => (parsed.ok ? [parsed.value] : []))
          const bookings = bookingDocs
            .map((row) => parseBooking(row.id, row.data() as Record<string, unknown>, organizationId))
            .flatMap((parsed) => (parsed.ok ? [parsed.value] : []))
          const managerSiteBookings = managerDocs
            .map((row) => parseManagerSiteBooking(row.id, row.data() as Record<string, unknown>, organizationId))
            .flatMap((parsed) => (parsed.ok ? [parsed.value] : []))
          const subjects = buildTimesheetSubjects(orgUsers, operatives)

          for (const entry of settingsDocs) {
            if (!entry.id.startsWith('timesheet_')) continue
            const data = entry.data() as Record<string, unknown>
            const userId = userIdFromTimesheetDoc(entry.id, data)
            const user = usersById.get(userId)
            if (!user) continue
            const draft = draftFromFirestoreMap(data, { includeSignatures: false }) || emptyTimesheetDraft()
            if (!isTimesheetFullyApproved(draft, user)) continue
            const signedAt = draft.managerSignedAt || draft.operativeSignedAt
            const current = inRange(signedAt, input.start, input.end)
            const previous = inRange(signedAt, input.previousStart, input.previousEnd)
            if (!current && !previous) continue

            const weekStart = parseFirestoreDate(data.weekStart) || signedAt || new Date()
            const weekEnd =
              parseFirestoreDate(data.weekEnd) || parseFirestoreDate(data.periodEnd) || weekRangeFromStart(weekStart).end
            const linked = findOperativeForUser(user, operatives)
            const subject =
              subjects.find((row) => row.userId === user.id) ||
              subjects.find((row) => linked && row.operativeId === linked.id) || {
                key: `user:${user.id}`,
                kind: 'manager' as const,
                name: `${user.firstName} ${user.surname}`.trim(),
                userId: user.id,
                operativeId: linked?.id,
                dayRate: user.dayRate,
                hourlyRate: user.hourlyRate,
              }
            const hours = collectSubjectDayEntries({
              subject,
              bookings,
              managerSiteBookings,
              weekRange: { start: weekStart, end: weekEnd },
            })
            const rates = ratePenceFromPounds(user.dayRate ?? linked?.dayRate, user.hourlyRate ?? linked?.hourlyRate)
            const valued = penceForSignedTimesheet({
              storedValuePence: asPence(data.valuePence),
              extrasPounds: draftAdditionalTotal(draft),
              hoursByDate: hours.map((row) => ({
                date: row.date.toISOString().slice(0, 10),
                hours: row.hours,
              })),
              dayRatePence: rates.dayRatePence,
              hourlyRatePence: rates.hourlyRatePence,
            })
            if (current) {
              valuePence += valued.valuePence
              sheetCount += 1
              if (valued.missingRate) missingRateCount += 1
            }
            if (previous) previousPence += valued.valuePence
          }
        } catch (error) {
          console.warn('Signed timesheet value skipped for', organizationId, error)
        }
      })
    )
  }

  return { valuePence, previousPence, sheetCount, missingRateCount, loaded: true }
}
