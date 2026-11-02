'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BellSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { EmptyState } from '@/components/ios/primitives'
import { inboxNotificationHref } from '@/lib/notifications/notificationHref'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  notificationShowsInInbox,
} from '@/lib/canonical'
import { loadUserNotificationPreferences } from '@/lib/settings/notificationPreferences'
import type { UserNotificationPreferences } from '@/lib/canonical'

type FilterOption = 'Newest' | 'Oldest' | 'Date'

export default function NotificationsPage() {
  const { user, organization } = useAuthStore()
  const { notifications, loading, loadNotifications, markAllAsRead } = useNotificationStore()
  const [filter, setFilter] = useState<FilterOption>('Newest')
  const [timeZone, setTimeZone] = useState(ianaTimeZoneForCountry('GB'))
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(DEFAULT_USER_NOTIFICATION_PREFERENCES)

  useEffect(() => {
    if (!organization?.id || !user?.id) return
    loadNotifications(organization.id, user.id)
  }, [organization?.id, user?.id, loadNotifications])

  useEffect(() => {
    if (!user?.id) return
    void loadUserNotificationPreferences(user.id).then(setPrefs)
  }, [user?.id])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => setTimeZone(ianaTimeZoneForCountry(details?.countryCode)))
      .catch(() => {})
  }, [organization?.id])

  const visible = useMemo(
    // Toggles stop the device push only; every notice stays in the inbox.
    () => notifications.filter((row) => notificationShowsInInbox(prefs, row.type)),
    [notifications, prefs]
  )

  useEffect(() => {
    if (!organization?.id || loading || visible.length === 0) return
    void markAllAsRead(organization.id)
  }, [organization?.id, loading, visible.length, markAllAsRead])

  const rows = useMemo(() => {
    const sorted = [...visible]
    if (filter === 'Oldest') sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    else sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return sorted.slice(0, 100)
  }, [visible, filter])

  return (
    <div className="stack" data-hue="blue">
      <div className="phead" data-hue="blue">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h1>Notifications</h1>
          <div className="sub">Clashes, sign-offs, orders and reminders</div>
        </div>
        <div className="acts">
          <label className="text-sm font-medium text-[var(--ink2)]">
            Filter
            <select
              className="pp-in ml-2"
              style={{ width: 140, height: 44 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
            >
              <option>Newest</option>
              <option>Oldest</option>
              <option>Date</option>
            </select>
          </label>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<BellSlashIcon className="h-16 w-16" />}
          title="No Notifications"
          subtitle="You're all caught up!"
        />
      ) : (
        <div className="rows">
          {rows.map((row) => {
            const href = inboxNotificationHref(row, user, timeZone)
            return (
              <article key={row.id} className="ritem">
                <Link href={href} className="block">
                  <h2 className="text-[17px] font-semibold text-[var(--blue)]">{row.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] text-[var(--ink3)]">{row.message}</p>
                  <p className="mt-2 text-[12px] font-semibold text-[var(--blue)]">Open</p>
                </Link>
                <p className="mt-2 text-[12px] text-[var(--ink3)]">
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
