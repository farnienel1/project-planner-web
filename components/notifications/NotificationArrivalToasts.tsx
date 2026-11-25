'use client'

/**
 * In-app notification pop-ups (owner request 25 Nov, web only; display only). When a new inbox row arrives for the
 * signed-in person while the app is open — created after the page started listening, never the first load or a
 * reconnect (`notificationArrivals`) — a small card shows at the top right: its title and up to two lines of its
 * message (never `detail`), hiding after 6 s, with ✕. Owner 25 Nov: when two or more are showing (several arrive at
 * once, e.g. after coming back online) they are ONE pop-up, "3 new notifications", listing each title; each row opens
 * its notification. Clicking one opens it exactly as the notification centre does (`notificationOpenHref`) and marks
 * only that row read (`markAsRead`, `notificationReadWriteFields`). ✕ (on the pop-up or a row) only hides it: it never
 * marks anything read or changes the centre's unread count. One short chime per batch (`notificationArrivedSound`,
 * Sounds setting), never one per row.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { notificationOpenHref } from '@/lib/notifications/notificationHref'
import { NOTIFICATION_TOAST_LIST_MAX, NOTIFICATION_TOAST_MS, notificationArrivals, withArrivals } from '@/lib/notifications/notificationArrivals'
import { notificationArrivedSound } from '@/lib/feedbackSounds/feedback'
import type { AppInboxNotification } from '@/lib/ios-parity/converters'
import type { User } from '@/types'

type Props = {
  /** The rows the centre shows (after `notificationShowsInInbox`). */
  notifications: ReadonlyArray<AppInboxNotification>
  ownerIds: ReadonlyArray<string>
  user: User | null | undefined
  organizationId: string | null | undefined
  timeZone: string
}

export function NotificationArrivalToasts({ notifications, ownerIds, user, organizationId, timeZone }: Props) {
  const router = useRouter()
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const [toasts, setToasts] = useState<AppInboxNotification[]>([])
  // Set on the first run (the scope check below), never during render.
  const sinceRef = useRef(0)
  const seenRef = useRef(new Set<string>())
  const scopeRef = useRef<string | null>(null)
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(id)
    setToasts((current) => current.filter((row) => row.id !== id))
  }, [])

  useEffect(() => {
    // Another company or account: start again from now, so its existing inbox never pops up.
    const scope = `${organizationId ?? ''}|${user?.id ?? ''}`
    if (scopeRef.current !== scope) {
      scopeRef.current = scope
      sinceRef.current = Date.now()
      seenRef.current = new Set()
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      setToasts([])
      return
    }
    const arrivals = notificationArrivals({
      rows: notifications,
      seenIds: seenRef.current,
      sinceMs: sinceRef.current,
      ownerIds,
      nowMs: Date.now(),
    })
    if (arrivals.length === 0) return
    for (const row of arrivals) {
      seenRef.current.add(row.id)
      timersRef.current.set(
        row.id,
        setTimeout(() => dismiss(row.id), NOTIFICATION_TOAST_MS)
      )
    }
    setToasts((current) => withArrivals(current, arrivals, NOTIFICATION_TOAST_LIST_MAX))
    notificationArrivedSound()
  }, [notifications, ownerIds, organizationId, user?.id, dismiss])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  // Display only: hides every pop-up; nothing is marked read.
  const dismissAll = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
    setToasts([])
  }, [])

  const open = (row: AppInboxNotification) => {
    dismiss(row.id)
    if (organizationId) void markAsRead(organizationId, row.id).catch(() => undefined)
    router.push(notificationOpenHref(row, { user, openOrganizationId: organizationId, timeZone }))
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="New notifications"
      className="pointer-events-none fixed right-4 top-16 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
    >
      {toasts.length === 1 ? (
        <div className="pointer-events-auto flex items-start gap-2 rounded-xl border border-(--line) bg-(--card) p-3 shadow-lg">
          <button
            type="button"
            onClick={() => open(toasts[0])}
            className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-(--blue)"
          >
            <span className="block truncate text-sm font-semibold text-(--ink)">{toasts[0].title}</span>
            {toasts[0].message ? (
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-(--ink2)">{toasts[0].message}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => dismiss(toasts[0].id)}
            aria-label="Dismiss notification"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-(--ink3) hover:bg-(--soft) focus-visible:outline-2 focus-visible:outline-(--blue)"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : toasts.length > 1 ? (
        <div className="pointer-events-auto rounded-xl border border-(--line) bg-(--card) p-2 shadow-lg">
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="min-w-0 flex-1 text-sm font-semibold text-(--ink)">{toasts.length} new notifications</span>
            <button
              type="button"
              onClick={dismissAll}
              aria-label="Dismiss notifications"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-(--ink3) hover:bg-(--soft) focus-visible:outline-2 focus-visible:outline-(--blue)"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {toasts.map((row) => (
              <li key={row.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => open(row)}
                  className="min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-[13px] text-(--ink2) hover:bg-(--soft) focus-visible:outline-2 focus-visible:outline-(--blue)"
                >
                  {row.title}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(row.id)}
                  aria-label={`Dismiss ${row.title}`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-(--ink3) hover:bg-(--soft) focus-visible:outline-2 focus-visible:outline-(--blue)"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
