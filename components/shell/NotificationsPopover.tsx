'use client'

import Link from 'next/link'
import type { AppInboxNotification } from '@/lib/ios-parity/converters'

export function NotificationsPopover({
  open,
  onClose,
  notifications,
  onMarkAllRead,
}: {
  open: boolean
  onClose: () => void
  notifications: AppInboxNotification[]
  onMarkAllRead: () => void
}) {
  if (!open) return null
  const recent = notifications.slice(0, 8)
  const unread = notifications.some((row) => !row.isRead)

  return (
    <>
      <button type="button" className="fixed inset-0 z-30 cursor-default bg-transparent" aria-label="Close notifications" onClick={onClose} />
      <div className="absolute right-0 z-40 mt-2 w-[320px] overflow-hidden rounded-[18px] bg-[var(--card)] p-1.5 shadow-[var(--sh-pop)]">
        <div className="flex items-center justify-between px-2.5 py-2">
          <p className="text-[14px] font-semibold">Notifications</p>
          {unread ? (
            <button type="button" className="text-[12.5px] font-semibold text-[var(--blue)]" onClick={onMarkAllRead}>
              Mark all read
            </button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-[var(--ink3)]">You&apos;re all caught up.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            {recent.map((row) => (
              <div key={row.id} className="rounded-[14px] px-2.5 py-2">
                <p className="truncate text-[14px] font-semibold">{row.title}</p>
                <p className="line-clamp-2 text-[12.5px] text-[var(--ink3)]">{row.message}</p>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="mt-1 flex items-center justify-center rounded-[14px] px-2.5 py-2 text-[14px] font-semibold text-[var(--blue)] hover:bg-[var(--soft)]"
        >
          View all
        </Link>
      </div>
    </>
  )
}
