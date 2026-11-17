'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { DEFAULT_ANNUAL_LEAVE, loadOrganizationDetails, type OrgAnnualLeaveDefaults } from '@/lib/settings/organizationSettings'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { OperativeAnnualLeaveManagement } from './OperativeAnnualLeaveManagement'
import { PersonalLeave } from './PersonalLeave'
import { userCanSelfBookAnnualLeave } from '@/lib/annualLeave/holidayApprovalUtils'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { leaveRecordsForAccount } from '@/lib/canonical/bookingPerson'
import { samePersonIds } from '@/lib/staff/userRosterUtils'
import { teamLeaveTab } from '@/lib/annualLeave/teamLeaveQueue'
import { leaveIdKeys } from '@/lib/annualLeave/annualLeavePerson'
import { AnnualLeaveReportButton } from './AnnualLeaveReport'
import { annualLeaveReportLeaveState } from '@/lib/annualLeave/annualLeaveReport'
import { useLeaveEmployment } from '@/lib/annualLeave/useLeaveEmployment'
import { userLeaveReportYearMonths } from '@/lib/annualLeave/leaveBalance'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'

export function AnnualLeaveScreen() {
  const { organization, user } = useAuthStore()
  const { bookings, error, saveBooking, createRequests, deleteBooking, requestCancellation } = useHolidayStore()
  const rosterUsers = useOrgUserStore((state) => state.users)
  const users = rosterUsers
  const userIdAliases = useOrgUserStore((state) => state.userIdAliases)
  const operatives = useOperativeStore((state) => state.operatives)
  const loadRosterUsers = useOrgUserStore((state) => state.loadUsers)
  const loadOperatives = useOperativeStore((state) => state.loadOperatives)
  useEffect(() => {
    if (organization?.id) void loadRosterUsers(organization.id).catch(() => undefined)
  }, [organization?.id, loadRosterUsers])
  // Rulebook 1.56.0 (`leaveQueryPlan`): an operative's own leave is queried under their `operatives` rows too, so the
  // rows are loaded here (the leave listener re-plans when they arrive).
  useEffect(() => {
    if (organization?.id) void loadOperatives(organization.id).catch(() => undefined)
  }, [organization?.id, loadOperatives])
  // `canSelfBookAnnualLeave(user, roster)`: the self-book permission outside operative mode, or the Super Admin
  // (rulebook 1.28.0). Having no line manager is not self-booking for anyone.
  const booksOwnLeave = userCanSelfBookAnnualLeave(user, rosterUsers)
  // Rulebook 1.40.0 `annualLeaveTeamTabVisible`: admins, and anyone who line-manages at least one current person —
  // the Operatives toggle plays no part (a line manager without it had no Team tab on web before).
  const canTeam = teamLeaveTab(user, users, operatives)
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab') === 'team' ? 'team' : 'mine'
  const [tab, setTab] = useState<'mine' | 'team'>(requestedTab)
  const [queueCount, setQueueCount] = useState(0)
  const [orgLeaveDefaults, setOrgLeaveDefaults] = useState<OrgAnnualLeaveDefaults>(DEFAULT_ANNUAL_LEAVE)
  const [leaveDefaultsOrgId, setLeaveDefaultsOrgId] = useState<string | null>(null)

  useEffect(() => {
    setTab(requestedTab)
  }, [requestedTab])

  useEffect(() => {
    if (!organization?.id) return
    const orgId = organization.id
    loadOrganizationDetails(orgId)
      .then((details) => {
        if (details?.annualLeaveDefaults) setOrgLeaveDefaults(details.annualLeaveDefaults)
      })
      .catch(() => undefined)
      .finally(() => setLeaveDefaultsOrgId(orgId))
  }, [organization?.id])
  const leaveDefaultsLoaded = Boolean(organization?.id) && leaveDefaultsOrgId === organization?.id

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

  // Annual leave report (rulebook §9 `leaveReportRows`): every id this person's leave may be filed under
  // (`leaveRecordsForAccount`'s ids, the email included), the same set `myBookings` was matched on.
  const myLeaveIds = useMemo(
    () =>
      user
        ? leaveIdKeys(
            {
              id: user.id,
              email: user.email,
              formerIds: user.formerUserIds ?? [],
              aliasIds: Array.from(samePersonIds(user.id, users, userIdAliases)),
            },
            operatives
          )
        : [],
    [user, users, userIdAliases, operatives]
  )

  // Rulebook 1.54.0 §9: the report counts the leave year the balance on My leave counts (`annualLeaveReportYearMonths`):
  // the person's own leave year while they have an allowance, else the organisation's.
  const timeZone = useOrganizationTimeZone()
  // The report waits for the person's leave records (never "0 days" while loading or after a failed load).
  const holidayLoading = useHolidayStore((state) => state.loading)
  const holidayError = useHolidayStore((state) => state.error)
  const holidayLoadedOrgId = useHolidayStore((state) => state.loadedOrgId)
  const reportLeaveState = annualLeaveReportLeaveState({
    organizationId: organization?.id,
    loading: holidayLoading,
    error: holidayError,
    loadedOrgId: holidayLoadedOrgId,
  })
  const leaveEmployment = useLeaveEmployment(organization?.id, user)
  const reportYearMonths = userLeaveReportYearMonths({ user, employment: leaveEmployment.employment, orgDefaults: orgLeaveDefaults, timeZone })

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

      {(tab === 'mine' || !canTeam) && user ? (
        <AnnualLeaveReportButton
          personName={`${user.firstName ?? ''} ${user.surname ?? ''}`.trim() || user.email}
          personSubtitle={user.email}
          bookings={myBookings}
          personIds={myLeaveIds}
          startMonth={reportYearMonths.startMonth}
          leaveState={reportLeaveState}
          employmentStartDayKey={user.employmentStartDate ?? null}
          ready={leaveDefaultsLoaded && leaveEmployment.ready}
        />
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
