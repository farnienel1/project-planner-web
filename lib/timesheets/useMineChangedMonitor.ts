'use client'

/**
 * Owner decision G (17 Nov follow-up): the yellow triangle beside Timesheets appears as soon as one of the signed-in
 * person's signed timesheets changes — not only after the Timesheets hub has been opened. Mounted once in the app shell;
 * it keeps live listeners on the person's OWN documents only (cheap reads, every one allowed by the security rules for
 * the person themself):
 *   - their timesheets: `settings` where `userId` == their uid (rules 1.43.0, the person's own query);
 *   - their `operatives` rows on their email (so bookings filed under such a row count, `bookingIdsForAccount`);
 *   - their labour bookings (`operativeId in` their ids, `OWN_BOOKING_IDS_PER_QUERY` per query) and manager site
 *     bookings (`userId in` their ids), from the earliest of the last `RECENT_PAY_RUN_COUNT` pay runs.
 * The answer is `mineChangedPeriodStarts` (the rulebook's `signedTimesheetBookingChanges` / `timesheetRevisionDue`), published to
 * `useMineChangedStore`; the sidebar and the hub only read it — one computation.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { OWN_BOOKING_IDS_PER_QUERY, organizationTimeZone } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { organizationDetailsFromData, DEFAULT_INVOICING, DEFAULT_MY_SCHEDULE } from '@/lib/settings/organizationSettings'
import { useOwnPayUser } from '@/lib/pay/useOwnPayUser'
import { withOwnPay } from '@/lib/pay/ownPayRecord'
import { canAccessMyTimesheetsWithPolicy } from '@/lib/timesheets/timesheetPayrollPolicy'
import { recentPayRuns, payRunsStartDayKey } from '@/lib/timesheets/timesheetQueue'
import { mineChangedPeriodStarts, mineSheetRows } from '@/lib/timesheets/mineChanged'
import { mineChangedKey, useMineChangedStore } from '@/lib/timesheets/mineChangedStore'
import { timesheetStateRowsFromDocs, timesheetSourceDocumentId, type TimesheetStateRow } from '@/lib/timesheets/timesheetStorage'
import { timesheetPersonIds, type BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import { emptyDayRateHistory } from '@/lib/timesheets/dayRateHistoryStorage'
import { bookingDownloadConstraints } from '@/lib/firebase/bookingDownloadBound'
import { parseManagerSiteBooking, parseOperative } from '@/lib/ios-parity/converters'
import { bookingsFromListenerDocs } from '@/lib/stores/bookingListMerge'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import type { Booking, Operative, Project } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'

const NO_PROJECTS: Project[] = []
const NO_HISTORY = emptyDayRateHistory()

/** Splits ids into `in` chunks (the rules' own-booking budget). */
function chunks<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}

/** Live query state: rows by query part, and whether every part has had a server answer. */
type Parts<T> = { rows: Map<string, T[]>; server: Set<string>; parts: string[] }

function emptyParts<T>(parts: string[]): Parts<T> {
  return { rows: new Map(), server: new Set(), parts }
}

function partsLoaded<T>(state: Parts<T>): boolean {
  return state.parts.every((part) => state.server.has(part))
}

function partsRows<T>(state: Parts<T>): T[] {
  return state.parts.flatMap((part) => state.rows.get(part) ?? [])
}

export function useMineChangedMonitor(): void {
  const user = useAuthStore((state) => state.user)
  const organizationId = useAuthStore((state) => state.organization?.id ?? '')
  const users = useOrgUserStore((state) => state.users)
  const orgDocument = useOrganizationDocument()
  const ownPay = useOwnPayUser()
  const publish = useMineChangedStore((state) => state.publish)
  const userId = user?.id ?? ''
  const sessionKey = mineChangedKey(organizationId, userId)

  const details = useMemo(
    () =>
      orgDocument.loaded && orgDocument.data && orgDocument.organizationId === organizationId
        ? organizationDetailsFromData(organizationId, orgDocument.data as Record<string, unknown>)
        : null,
    [orgDocument.loaded, orgDocument.data, orgDocument.organizationId, organizationId]
  )
  const timeZone = organizationTimeZone(details?.countryCode)
  const invoicing = details?.invoicing ?? DEFAULT_INVOICING
  const subject = useMemo(() => {
    if (!user || ownPay.status !== 'ready') return null
    return withOwnPay(users.find((row) => row.id === user.id) || user, ownPay)
  }, [user, users, ownPay])
  // Only someone with My Timesheets (as the hub shows the "My timesheets" card).
  const enabled = Boolean(details && subject && canAccessMyTimesheetsWithPolicy(subject, invoicing, new Date(), timeZone))
  // The day the window starts (changes at most when a pay run rolls over or the settings change).
  const scanFromDayKey = useMemo(
    () => (enabled ? payRunsStartDayKey(recentPayRuns(invoicing, new Date(), timeZone), timeZone) : ''),
    [enabled, invoicing, timeZone]
  )

  // 1. The person's own timesheets.
  const [sheets, setSheets] = useState<{ key: string; rows: TimesheetStateRow[]; loaded: boolean }>({ key: '', rows: [], loaded: false })
  useEffect(() => {
    if (!enabled || !organizationId || !userId) return
    const key = `${organizationId}|${userId}`
    setSheets({ key, rows: [], loaded: false })
    return onSnapshot(
      query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId)),
      { includeMetadataChanges: true },
      (snap) => {
        const rows = timesheetStateRowsFromDocs(
          userId,
          snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
        )
        setSheets({ key, rows, loaded: !snap.metadata.fromCache })
      },
      () => setSheets({ key, rows: [], loaded: false })
    )
  }, [enabled, organizationId, userId])

  // 2. Their `operatives` rows on their email.
  const email = (subject?.email ?? '').trim()
  const [ownOperatives, setOwnOperatives] = useState<{ key: string; rows: Operative[]; loaded: boolean }>({ key: '', rows: [], loaded: false })
  useEffect(() => {
    if (!enabled || !organizationId) return
    const key = `${organizationId}|${email}`
    if (!email) {
      setOwnOperatives({ key, rows: [], loaded: true })
      return
    }
    setOwnOperatives({ key, rows: [], loaded: false })
    const values = [...new Set([email, email.toLowerCase()])]
    return onSnapshot(
      query(collection(db, 'organizations', organizationId, 'operatives'), where('email', 'in', values)),
      { includeMetadataChanges: true },
      (snap) => {
        const rows: Operative[] = []
        for (const entry of snap.docs) {
          const parsed = parseOperative(entry.id, entry.data() as Record<string, unknown>, organizationId)
          if (parsed.ok) rows.push(parsed.value)
        }
        setOwnOperatives({ key, rows, loaded: !snap.metadata.fromCache })
      },
      // A refused or failed read: no rows, but loaded — bookings under the users ids still count.
      () => setOwnOperatives({ key, rows: [], loaded: true })
    )
  }, [enabled, organizationId, email])

  // Every id the person's bookings may be filed under (`bookingIdsForAccount`).
  const personIds = useMemo(
    () => (subject ? timesheetPersonIds(subject, users, ownOperatives.rows) : []),
    [subject, users, ownOperatives.rows]
  )
  const idsKey = personIds.join('|')

  // 3. Their labour and manager site bookings in the window.
  const [labour, setLabour] = useState<Parts<Booking>>(() => emptyParts([]))
  const [site, setSite] = useState<Parts<ManagerSiteBooking>>(() => emptyParts([]))
  useEffect(() => {
    if (!enabled || !organizationId || !scanFromDayKey || personIds.length === 0) return
    const bound = bookingDownloadConstraints({ loadedFromDayKey: scanFromDayKey, fullHistory: false })
    const labourParts = chunks(personIds, OWN_BOOKING_IDS_PER_QUERY).map((ids) => ids.join(','))
    const siteParts = chunks(personIds, 10).map((ids) => ids.join(','))
    setLabour(emptyParts(labourParts))
    setSite(emptyParts(siteParts))
    const stops: Unsubscribe[] = []
    for (const part of labourParts) {
      stops.push(
        onSnapshot(
          query(collection(db, 'organizations', organizationId, 'bookings'), where('operativeId', 'in', part.split(',')), ...bound),
          { includeMetadataChanges: true },
          (snap) => {
            const rows = bookingsFromListenerDocs({
              organizationId,
              docs: snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })),
              previous: [],
            })
            setLabour((state) => {
              const next = { ...state, rows: new Map(state.rows), server: new Set(state.server) }
              next.rows.set(part, rows)
              if (!snap.metadata.fromCache) next.server.add(part)
              return next
            })
          },
          () => undefined
        )
      )
    }
    for (const part of siteParts) {
      stops.push(
        onSnapshot(
          query(collection(db, 'organizations', organizationId, 'managerSiteBookings'), where('userId', 'in', part.split(',')), ...bound),
          { includeMetadataChanges: true },
          (snap) => {
            const rows: ManagerSiteBooking[] = []
            for (const entry of snap.docs) {
              const parsed = parseManagerSiteBooking(entry.id, entry.data() as Record<string, unknown>, organizationId)
              if (parsed.ok) rows.push(parsed.value)
            }
            setSite((state) => {
              const next = { ...state, rows: new Map(state.rows), server: new Set(state.server) }
              next.rows.set(part, rows)
              if (!snap.metadata.fromCache) next.server.add(part)
              return next
            })
          },
          // An operative may not read manager site bookings while reads are enforced (they have none): loaded, empty.
          () =>
            setSite((state) => {
              const next = { ...state, rows: new Map(state.rows), server: new Set(state.server) }
              next.rows.set(part, [])
              next.server.add(part)
              return next
            })
        )
      )
    }
    return () => {
      for (const stop of stops) stop()
    }
    // `personIds` is read through `idsKey` (a new array each render with the same ids).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organizationId, scanFromDayKey, idsKey])

  const labourRows = useMemo(() => partsRows(labour), [labour])
  const siteRows = useMemo(() => partsRows(site), [site])
  const liveLoaded = partsLoaded(labour) && partsLoaded(site) && labour.parts.length > 0 && ownOperatives.loaded

  const changedStarts = useMemo(() => {
    // Nothing is decided until the sheets and the bookings have a server answer (never "unchanged" from a partial read).
    if (!enabled || !subject || !details || !liveLoaded || !sheets.loaded || sheets.key !== `${organizationId}|${userId}`) return null
    const catalogue: BookingChangeCatalogue = {
      users,
      liveLoaded,
      coversPeriod: (period) => periodStartKey(period.start, timeZone) >= scanFromDayKey,
      bookings: labourRows,
      managerSiteBookings: siteRows,
      operatives: ownOperatives.rows,
      projects: NO_PROJECTS,
      smallWorks: NO_PROJECTS,
      payrollPolicy: details.payrollTimePolicy,
      payrollPolicyPrior: details.payrollTimePolicyPrior ?? null,
      payrollPolicyEffectiveFrom: details.payrollTimePolicyEffectiveFrom ?? null,
      payrollPolicyState: details.payrollTimePolicyState ?? null,
      timeZone,
      // Pay plays no part in whether a booking changed (only which lines exist and their fingerprints).
      history: NO_HISTORY,
      scheduleOptions: details.myScheduleOptions ?? DEFAULT_MY_SCHEDULE,
    }
    return mineChangedPeriodStarts({
      rows: mineSheetRows(sheets.rows, invoicing, new Date(), timeZone),
      subject,
      catalogue,
      timeZone,
      documentIdOf: timesheetSourceDocumentId,
    })
  }, [enabled, subject, details, sheets, organizationId, userId, users, liveLoaded, timeZone, scanFromDayKey, labourRows, siteRows, ownOperatives.rows, invoicing])

  const changedKey = changedStarts ? changedStarts.join(',') : null
  useEffect(() => {
    if (!sessionKey) return
    if (!enabled && details && ownPay.status === 'ready') {
      publish(sessionKey, [])
      return
    }
    // Nothing is published until the person's own sheets have arrived (the last answer stays meanwhile).
    if (changedKey == null) return
    publish(sessionKey, changedKey ? changedKey.split(',') : [])
  }, [publish, sessionKey, enabled, details, ownPay.status, changedKey])
}
