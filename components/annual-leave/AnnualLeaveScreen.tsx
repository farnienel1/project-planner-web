'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { DEFAULT_ANNUAL_LEAVE, loadOrganizationDetails, type OrgAnnualLeaveDefaults } from '@/lib/settings/organizationSettings'
import {
  canAccessOperativeAnnualLeaveDirectory,
  isOperativeMode,
} from '@/lib/navigation/menuPermissions'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { OperativeAnnualLeaveManagement } from './OperativeAnnualLeaveManagement'
import { PersonalLeave } from './PersonalLeave'
import { userCanSelfBookAnnualLeave } from '@/lib/annualLeave/holidayApprovalUtils'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { leaveRecordsForAccount } from '@/lib/canonical/bookingPerson'
import { samePersonIds } from '@/lib/staff/userRosterUtils'

export function AnnualLeaveScreen() {
  const { organization, user } = useAuthStore()
  const { bookings, error, saveBooking, createRequests, deleteBooking, requestCancellation } = useHolidayStore()
  const isOperative = isOperativeMode(user)
  const rosterUsers = useOrgUserStore((state) => state.users)
  const users = rosterUsers
  const userIdAliases = useOrgUserStore((state) => state.userIdAliases)
  const operatives = useOperativeStore((state) => state.operatives)
  const loadRosterUsers = useOrgUserStore((state) => state.loadUsers)
  useEffect(() => {
    if (organization?.id) void loadRosterUsers(organization.id).catch(() => undefined)
  }, [organization?.id, loadRosterUsers])
  // `canSelfBookAnnualLeave(user, roster)`: the self-book permission outside operative mode, or an admin / super
  // admin outside operative mode with no active line manager. No line manager is not self-booking for anyone else.
  const booksOwnLeave = userCanSelfBookAnnualLeave(user, rosterUsers)
  const canTeam = !isOperative && canAccessOperativeAnnualLeaveDirectory(user)
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab') === 'team' ? 'team' : 'mine'
  const [tab, setTab] = useState<'mine' | 'team'>(requestedTab)
  const [queueCount, setQueueCount] = useState(0)
  const [orgLeaveDefaults, setOrgLeaveDefaults] = useState<OrgAnnualLeaveDefaults>(DEFAULT_ANNUAL_LEAVE)

  useEffect(() => {
    setTab(requestedTab)
  }, [requestedTab])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.annualLeaveDefaults) setOrgLeaveDefaults(details.annualLeaveDefaults)
      })
      .catch(() => undefined)
  }, [organization?.id])

  const myBookings = useMemo(
    () =>
      // Rulebook 1.9.0 `leaveRecordsForAccount`: every id of this person (former, same-email, catalogue rows).
      (user
        ? leaveRecordsForAccount(
            bookings,
            {
              id: user.id,
              email: user.email,
              formerIds: user.formerUserIds ?? [],
              aliasIds: Array.from(samePersonIds(user.id, users, userIdAliases)),
            },
            operatives
          )
        : []
      ).sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [bookings, user, users, userIdAliases, operatives]
  )

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <h1>Annual leave</h1>
      {error ? <ErrorBanner message={error} /> : null}

      {canTeam ? (
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            My leave
          </button>
          <button
            type="button"
            onClick={() => setTab('team')}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === 'team' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Team
            {queueCount > 0 ? (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">{queueCount}</span>
            ) : null}
          </button>
        </div>
      ) : null}

      {canTeam ? (
        <div className={tab === 'team' ? undefined : 'hidden'}>
          <OperativeAnnualLeaveManagement embedded onQueueCount={setQueueCount} />
        </div>
      ) : null}

      {tab === 'mine' || !canTeam ? (
        <PersonalLeave
          mode={booksOwnLeave ? 'manager' : 'operative'}
          myBookings={myBookings}
          organization={organization}
          user={user}
          orgLeaveDefaults={orgLeaveDefaults}
          saveBooking={saveBooking}
          createRequests={createRequests}
          deleteBooking={deleteBooking}
          requestCancellation={requestCancellation}
        />
      ) : null}
    </div>
  )
}
