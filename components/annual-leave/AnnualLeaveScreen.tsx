'use client'

import { useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
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
  const canTeam = !isOperative && canAccessOperativeAnnualLeaveDirectory(user)
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [queueCount, setQueueCount] = useState(0)

  const myBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.userId === user?.id || booking.operativeId === user?.id)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    [bookings, user]
  )

  if (user?.annualLeaveEnabled === false) {
    return (
      <div className="mx-auto max-w-xl pb-10">
        <h1>Annual leave</h1>
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Annual leave is not enabled for your account. Contact your manager if you need this turned on.
        </p>
      </div>
    )
  }

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
          mode={isOperative ? 'operative' : 'manager'}
          myBookings={myBookings}
          organization={organization}
          user={user}
          saveBooking={saveBooking}
          deleteBooking={deleteBooking}
          requestCancellation={requestCancellation}
        />
      ) : null}
    </div>
  )
}
