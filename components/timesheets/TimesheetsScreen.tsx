'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  loadTimesheetDrafts,
} from '@/lib/timesheets/timesheetStorage'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import {
  collectSubjectDayEntries,
  teamTimesheetUsers,
  totalHours,
} from '@/lib/timesheets/timesheetWeekUtils'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import type { Booking, Operative, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { LONDON_TIME_ZONE } from '@/lib/ios-parity/londonTime'

export type TeamTimesheetTab = 'awaiting' | 'signed' | 'exported'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function TimesheetsScreen({
  bookings,
  managerSiteBookings,
  operatives,
  users,
  periodStart,
  periodEnd,
  payrollPolicy,
  loading,
  teamTab,
  timeZone = LONDON_TIME_ZONE,
}: {
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  periodStart: Date
  periodEnd: Date
  payrollPolicy: OrgPayrollTimePolicy
  loading?: boolean
  teamTab: TeamTimesheetTab
  timeZone?: string
}) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const [drafts, setDrafts] = useState<Map<string, TimesheetDraft>>(new Map())
  const [recordsLoading, setRecordsLoading] = useState(false)

  const roster = useMemo(() => (user ? teamTimesheetUsers(user, users) : []), [user, users])

  const reload = useCallback(async () => {
    if (!organization?.id) return
    const userIds = roster.map((row) => row.id)
    if (userIds.length === 0) return
    setRecordsLoading(true)
    try {
      setDrafts(await loadTimesheetDrafts(organization.id, userIds, periodStart, timeZone))
    } finally {
      setRecordsLoading(false)
    }
  }, [organization?.id, roster, periodStart, timeZone])

  useEffect(() => {
    void reload()
  }, [reload])

  const visible = useMemo(() => {
    return roster.filter((member) => {
      const draft = drafts.get(member.id)
      if (!draft) return false
      if (teamTab === 'exported') return Boolean(draft.exportedAt)
      if (teamTab === 'signed') return isTimesheetFullyApproved(draft, member) && !draft.exportedAt
      return awaitingManagerSignOff(draft, member) && !draft.exportedAt
    })
  }, [roster, drafts, teamTab])

  if (loading || recordsLoading) return <LoadingSpinner />

  const emptyTitle =
    teamTab === 'exported'
      ? 'No exported timesheets'
      : teamTab === 'signed'
        ? 'No signed-off timesheets'
        : 'No timesheets awaiting sign-off'
  const emptyDescription =
    teamTab === 'exported'
      ? 'Exported timesheets stay here for years after you generate an invoice.'
      : teamTab === 'signed'
        ? 'Counter-signed timesheets ready to export will appear here.'
        : 'People appear here only after they have signed their own timesheet. Unsigned booked hours stay on My Timesheets until they sign.'

  if (visible.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-3">
      {visible.map((member) => {
        const draft = drafts.get(member.id)
        const entries = collectSubjectDayEntries({
          subject: {
            key: `user:${member.id}`,
            kind: member.permissions.operativeMode ? 'operative' : 'manager',
            name: `${member.firstName} ${member.surname}`.trim() || member.email,
            userId: member.id,
            operativeId: operatives.find((row) => row.email.toLowerCase() === member.email.toLowerCase())?.id,
          },
          bookings,
          managerSiteBookings,
          weekRange: { start: periodStart, end: periodEnd },
          payrollPolicy,
        })
        const hours = totalHours(entries)
        return (
          <button
            key={member.id}
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/timesheets?surface=team&tab=${teamTab}&user=${member.id}&period=${periodStartKey(periodStart, timeZone)}`
              )
            }
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:ring-2 hover:ring-[#185FA5]/20"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-[13px] font-bold text-[#185FA5]">
              {initials(`${member.firstName} ${member.surname}`.trim() || member.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[17px] font-semibold">{`${member.firstName} ${member.surname}`.trim() || member.email}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    teamTab === 'exported'
                      ? 'bg-slate-100 text-slate-600'
                      : teamTab === 'signed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {teamTab === 'exported' ? 'Exported' : teamTab === 'signed' ? 'Signed off' : 'Pending'}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-ios-muted">
                Hrs {hours.toFixed(1)}
                {draft?.priceWorkEntries.length ? ` · PW ${draft.priceWorkEntries.length}` : ''}
                {draft?.expenseEntries.length ? ` · Exp ${draft.expenseEntries.length}` : ''}
                {member.permissions.operativeMode ? ' · Operative' : hasAdminAccess(member) ? ' · Admin' : ' · Manager'}
              </p>
              {hasAdminAccess(user) && (member.assignedManagerUserIds?.[0] || member.assignedManagerUserId) ? (
                <p className="mt-0.5 text-[12px] text-ios-muted">
                  Line manager:{' '}
                  {(() => {
                    const managerId = member.assignedManagerUserIds?.[0] || member.assignedManagerUserId
                    const manager = users.find((row) => row.id === managerId)
                    return manager ? `${manager.firstName} ${manager.surname}`.trim() : 'Assigned'
                  })()}
                </p>
              ) : null}
            </div>
            <span className="text-[#185FA5]">›</span>
          </button>
        )
      })}
    </div>
  )
}
