'use client'

/**
 * Rulebook 1.51.0 §7 (Q4b): Settings → Data health "Leave not linked to a person" (`leaveRecordsWithoutPerson`). Annual
 * leave records whose person id matches nobody under any id or email — the weekly report lists them as "Person not
 * found (id …)". Admin only. Never writes.
 * Rulebook 1.70.0 §7, §11: leave of a deleted person kept as a former-person record (`deletedPeople`) is listed apart,
 * "Former person · Jane Smith" (`leaveRecordFormerPerson`, `formerPersonDataHealthLabel`); nothing is hidden.
 */

import { useEffect, useMemo } from 'react'
import { formerPersonDataHealthLabel, leaveRecordFormerPerson, leaveRecordsWithoutPerson, organizationTimeZone } from '@/lib/canonical'
import { useFormerPeople } from '@/lib/people/formerPeople'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { weeklyReportLeavePeople } from '@/lib/weekly-report/weeklyReportData'

export function LeaveNotLinkedToPerson({ organizationId }: { organizationId: string }) {
  const { bookings: holidays, loadBookings, loadedOrgId } = useHolidayStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, userIdAliases, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const { data: organization } = useOrganizationDocument()
  const timeZone = organizationTimeZone((organization as { countryCode?: string } | null)?.countryCode)
  const formerPeople = useFormerPeople(organizationId)

  useEffect(() => {
    void loadBookings(organizationId)
    void loadOperatives(organizationId)
    void loadUsers(organizationId)
  }, [organizationId, loadBookings, loadOperatives, loadUsers])

  const rows = useMemo(
    () =>
      leaveRecordsWithoutPerson({
        records: holidays.map((holiday) => ({
          ...holidayBookingDayKeys(holiday, timeZone),
          id: holiday.id,
          userId: holiday.userId ?? null,
          operativeId: holiday.operativeId ?? null,
          timeSlot: holiday.timeSlot,
          status: holiday.status,
        })),
        people: weeklyReportLeavePeople(users, operatives, userIdAliases),
      }).map((row) => ({ ...row, former: leaveRecordFormerPerson(row, formerPeople) })),
    [holidays, users, operatives, userIdAliases, timeZone, formerPeople]
  )
  // Former people first under their own heading; every other record stays listed as before.
  const formerRows = rows.filter((row) => row.former)
  const notFoundRows = rows.filter((row) => !row.former)

  if (loadedOrgId !== organizationId || rosterLoadedOrgId !== organizationId) return null

  return (
    <section className="card p-4" aria-label="Leave not linked to a person">
      <h2 className="text-[15px] font-bold">Leave not linked to a person</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-(--ink3)">Every annual leave record matches a person.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {[...formerRows, ...notFoundRows].map((row) => (
            <li key={row.id} className="text-sm">
              <span className="font-semibold">
                {row.former
                  ? formerPersonDataHealthLabel(row.former.displayName)
                  : `Person not found (id ${row.userId || row.operativeId || '—'})`}
              </span>
              <span className="text-(--ink3)">
                {' '}
                — {row.startDayKey}
                {row.endDayKey && row.endDayKey !== row.startDayKey ? ` to ${row.endDayKey}` : ''} · {row.status} · leave record {row.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
