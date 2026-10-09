'use client'

import { useEffect, useMemo, useState } from 'react'
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

export function AnnualLeaveScreen() {
  const { organization, user } = useAuthStore()
  const { bookings, error, saveBooking, deleteBooking, requestCancellation } = useHolidayStore()
  const isOperative = isOperativeMode(user)
  const hasLineManager = Boolean(
    user?.assignedManagerUserId?.trim() || user?.assignedManagerUserIds?.some((id) => id.trim())
  )
  const booksOwnLeave = !isOperative && (!hasLineManager || user?.permissions.annualLeaveSelfBook === true)
  const canTeam = !isOperative && canAccessOperativeAnnualLeaveDirectory(user)
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [queueCount, setQueueCount] = useState(0)
  const [orgLeaveDefaults, setOrgLeaveDefaults] = useState<OrgAnnualLeaveDefaults>(DEFAULT_ANNUAL_LEAVE)

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
      bookings
        .filter((booking) => booking.userId === user?.id || booking.operativeId === user?.id)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [bookings, user]
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
          deleteBooking={deleteBooking}
          requestCancellation={requestCancellation}
        />
      ) : null}
    </div>
  )
}
