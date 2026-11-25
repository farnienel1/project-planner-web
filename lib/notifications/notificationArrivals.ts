/**
 * In-app notification pop-ups (owner request 25 Nov, web only; display only — no write shape or rule changes).
 * Which inbox rows count as "new" for a pop-up: rows the notification centre would show (`inboxNotificationVisibleToUser`),
 * unread, created after the page started listening (`sinceMs`) and not seen before. The inbox's first load and a
 * reconnect re-deliver older rows: their `createdAt` is before `sinceMs`, so they never pop up.
 */
import { inboxNotificationVisibleToUser } from '@/lib/canonical'

/** At most this many pop-ups are shown at once (the newest). */
export const NOTIFICATION_TOAST_MAX = 3
/** A pop-up hides itself after this long. */
export const NOTIFICATION_TOAST_MS = 6_000

export type ArrivalRow = {
  id: string
  userId?: string | null
  createdAt: Date
  isRead?: boolean
  type?: string
}

export function notificationArrivals<T extends ArrivalRow>(input: {
  rows: ReadonlyArray<T>
  seenIds: ReadonlySet<string>
  sinceMs: number
  ownerIds: ReadonlyArray<string>
  nowMs: number
}): T[] {
  const { rows, seenIds, sinceMs, ownerIds, nowMs } = input
  return rows
    .filter((row) => {
      if (!row.id || seenIds.has(row.id) || row.isRead === true) return false
      const created = row.createdAt instanceof Date ? row.createdAt.getTime() : Number.NaN
      if (!Number.isFinite(created) || created <= sinceMs) return false
      return inboxNotificationVisibleToUser(row, ownerIds, nowMs)
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/** The pop-ups after `arrivals` join `current`: oldest dropped, at most `max`, newest last. */
export function withArrivals<T extends { id: string }>(current: ReadonlyArray<T>, arrivals: ReadonlyArray<T>, max = NOTIFICATION_TOAST_MAX): T[] {
  const ids = new Set(current.map((row) => row.id))
  const next = [...current, ...arrivals.filter((row) => !ids.has(row.id))]
  return next.slice(Math.max(0, next.length - max))
}
