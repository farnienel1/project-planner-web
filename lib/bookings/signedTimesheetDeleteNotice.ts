/**
 * Rulebook 1.33.0 §2 (signed timesheets): after a labour or manager schedule booking is deleted, tell the person who
 * deleted it once when the day is on one of the booked person's signed or exported timesheets
 * (`bookingDeleteSignedTimesheetWarning`). The delete has already gone ahead and is never held up by this; the signed
 * sheet never changes. The same as iOS `BookingStore` / `ManagerScheduleStore.warnIfOnSignedTimesheet`, which shows the
 * text once in an alert titled "Booking deleted" (`BookingDeleteNotice` here).
 *
 * The person's timesheets are `settings` documents where `userId ==` each of their ids — the query User Timesheets,
 * the weekly report feed and the Payrun Snapshot already make. A read the viewer may not make (private pay on, a
 * manager who is not a pay viewer) gives no sheets and so no warning, as on iOS.
 */

import { collection, getDocs, query, where } from 'firebase/firestore'
import { create } from 'zustand'
import { db } from '@/lib/firebase/config'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { bookedPersonTimesheetUserIds, signedTimesheetDeleteWarningFromDocs } from '@/lib/bookings/signedTimesheetDeleteWarning'

/** "Booking deleted" — the iOS alert title for this notice (`OfflineStatusBanner`). */
export const BOOKING_DELETED_NOTICE_TITLE = 'Booking deleted'

type BookingDeleteNoticeState = {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

/** The one notice waiting to be shown (the iOS `OfflineOutboxStore.lastNoticeMessage`). */
export const useBookingDeleteNoticeStore = create<BookingDeleteNoticeState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))

async function personTimesheetDocs(organizationId: string, userIds: ReadonlyArray<string>) {
  const results = await Promise.all(
    userIds.map((userId) =>
      getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId))).catch(() => null)
    )
  )
  const seen = new Set<string>()
  const docs: Array<{ id: string; data: Record<string, unknown> }> = []
  for (const snap of results) {
    for (const row of snap?.docs ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      docs.push({ id: row.id, data: row.data() as Record<string, unknown> })
    }
  }
  return docs
}

/**
 * Best effort, after a delete that went through: reads the booked person's timesheets and shows the warning when the
 * rulebook gives one. `personId` is the booking's stored person (`operativeId` for a labour booking, `userId` for a
 * manager schedule booking); `date` its day. Never throws.
 */
export function announceSignedTimesheetDelete(input: { organizationId: string; personId: string | null | undefined; date: Date | string | number | null | undefined }): void {
  void (async () => {
    const organizationId = String(input.organizationId ?? '').trim()
    if (!organizationId || !db || input.date == null) return
    const date = input.date instanceof Date ? input.date : new Date(input.date)
    if (Number.isNaN(date.getTime())) return
    const [{ useOrgUserStore }, { useOperativeStore }] = await Promise.all([
      import('@/lib/stores/siteAuditStore'),
      import('@/lib/stores/operativeStore'),
    ])
    const { users, userIdAliases } = useOrgUserStore.getState()
    const ids = bookedPersonTimesheetUserIds(input.personId, users, useOperativeStore.getState().operatives, userIdAliases)
    if (ids.length === 0) return
    const timeZone = organizationZoneOr()
    const docs = await personTimesheetDocs(organizationId, ids)
    const warning = signedTimesheetDeleteWarningFromDocs(dayKeyInZone(date, timeZone), docs, timeZone)
    if (warning) useBookingDeleteNoticeStore.getState().show(warning)
  })().catch(() => undefined)
}
