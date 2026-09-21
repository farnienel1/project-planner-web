'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BellSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { EmptyState } from '@/components/ios/primitives'
import { timesheetNotificationHref } from '@/lib/timesheets/timesheetNotifications'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'

type FilterOption = 'Newest' | 'Oldest' | 'Date'

export default function NotificationsPage() {
  const { user, organization } = useAuthStore()
  const { notifications, loading, loadNotifications, markAllAsRead } = useNotificationStore()
  const [filter, setFilter] = useState<FilterOption>('Newest')
  const [timeZone, setTimeZone] = useState(ianaTimeZoneForCountry('GB'))

  useEffect(() => {
    if (!organization?.id || !user?.id) return
    loadNotifications(organization.id, user.id)
  }, [organization?.id, user?.id, loadNotifications])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => setTimeZone(ianaTimeZoneForCountry(details?.countryCode)))
      .catch(() => {})
  }, [organization?.id])

  useEffect(() => {
    if (!organization?.id || loading || notifications.length === 0) return
    void markAllAsRead(organization.id)
  }, [organization?.id, loading, notifications.length, markAllAsRead])

  const rows = useMemo(() => {
    const sorted = [...notifications]
    if (filter === 'Oldest') sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    else sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return sorted.slice(0, 100)
  }, [notifications, filter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <label className="text-sm font-medium text-[#185FA5]">
          Filter
          <select
            className="ml-2 rounded-lg border border-ios-border bg-ios-card px-2 py-1 text-ios-ink"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
          >
            <option>Newest</option>
            <option>Oldest</option>
            <option>Date</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<BellSlashIcon className="h-16 w-16" />}
          title="No Notifications"
          subtitle="You're all caught up!"
        />
      ) : (
        <div className="divide-y divide-ios-border overflow-hidden rounded-[16px] border border-ios-border bg-ios-card">
          {rows.map((row) => {
            const href = timesheetNotificationHref(row, timeZone)
            return (
              <article key={row.id} className="px-4 py-4">
                {href ? (
                  <Link href={href} className="block">
                    <h2 className="text-[17px] font-semibold text-[#185FA5]">{row.title}</h2>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] text-ios-muted">{row.message}</p>
                    <p className="mt-2 text-[12px] font-semibold text-[#185FA5]">Open timesheet</p>
                  </Link>
                ) : (
                  <>
                    <h2 className="text-[17px] font-semibold">{row.title}</h2>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] text-ios-muted">{row.message}</p>
                  </>
                )}
                <p className="mt-2 text-[12px] text-ios-placeholder">
                  {row.createdAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
