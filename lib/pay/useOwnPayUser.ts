'use client'

/**
 * Pay strip: the signed-in person's own record with their pay profile laid over (`ownPayRecord.ts`), as a hook and as
 * a promise. One read per person and organisation, shared by every screen; read again when `privatePay` changes.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  onPlatformConfigChange,
  privatePayFor,
  securitySwitchesLoaded,
  securitySwitchesReady,
} from '@/lib/access/securitySwitches'
import { readPayProfile } from '@/lib/pay/payProfileService'
import { ownPayReadAfter, ownPayState, readOwnPayProfile, type OwnPayRead, type OwnPayState } from '@/lib/pay/ownPayRecord'
import { useAuthStore } from '@/lib/stores/authStore'
import type { User } from '@/types'

let entry: { key: string; read: OwnPayRead | null; promise: Promise<OwnPayRead> | null } = { key: '', read: null, promise: null }
// The last read that answered, per person and organisation (offline fallback for `ownPayReadAfter`).
const lastGood = new Map<string, OwnPayRead>()
let version = 0
const listeners = new Set<() => void>()
let watching = false

function notify(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (!watching) {
    watching = true
    // A switch change (or the first read of the switches) may change the answer.
    onPlatformConfigChange(() => {
      entry = { key: '', read: null, promise: null }
      notify()
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): number {
  return version
}

function keyFor(organizationId: string, user: User): string {
  return `${organizationId}|${user.id}|${(user.formerUserIds ?? []).join(',')}`
}

/** Starts (or joins) the own pay-profile read for `user` in `organizationId`. */
function ensureOwnPayRead(organizationId: string, user: User): Promise<OwnPayRead> {
  const key = keyFor(organizationId, user)
  if (entry.key === key && entry.read) return Promise.resolve(entry.read)
  if (entry.key === key && entry.promise) return entry.promise
  const promise = readOwnPayProfile(organizationId, user, readPayProfile).then((fresh) => {
    if (fresh.status === 'found' || fresh.status === 'missing') lastGood.set(key, fresh)
    if (fresh.status === 'refused') lastGood.delete(key)
    const read = ownPayReadAfter(lastGood.get(key) ?? null, fresh)
    if (entry.key === key) {
      // A failed read is kept until `retryOwnPayRead` (or a switch change) asks again.
      entry = { key, read, promise: null }
      notify()
    }
    return read
  })
  entry = { key, read: null, promise }
  return promise
}

function currentRead(organizationId: string, user: User): OwnPayRead | null {
  const key = keyFor(organizationId, user)
  // While a re-read is in flight the last answer stands (no flicker back to loading).
  return (entry.key === key ? entry.read : null) ?? lastGood.get(key) ?? null
}

/** Forgets the own pay-profile read (a failed one included) so the next screen that asks reads again. */
export function retryOwnPayRead(): void {
  entry = { key: '', read: null, promise: null }
  notify()
}

/** The signed-in person with their own pay (see `OwnPayState`). */
export function useOwnPayUser(): OwnPayState {
  const user = useAuthStore((state) => state.user)
  const organizationId = useAuthStore((state) => state.organization?.id ?? null)
  const rawDocument = useAuthStore((state) => state.currentUserDocument)
  const tick = useSyncExternalStore(subscribe, snapshot, snapshot)
  const privatePay = Boolean(organizationId) && privatePayFor(organizationId)
  useEffect(() => {
    if (!organizationId || !user) return
    let cancelled = false
    const switchesKnown = securitySwitchesLoaded()
    void securitySwitchesReady().then(() => {
      if (cancelled) return undefined
      // The switches were read since this render: render again with them.
      if (!switchesKnown && securitySwitchesLoaded()) notify()
      if (!privatePayFor(organizationId)) return undefined
      return ensureOwnPayRead(organizationId, user)
    })
    return () => {
      cancelled = true
    }
    // `tick`: a retry or a switch change cleared the read.
  }, [organizationId, user, tick])
  return useMemo(
    () =>
      ownPayState({
        user,
        rawDocument,
        switchesLoaded: securitySwitchesLoaded(),
        privatePay,
        read: organizationId && user ? currentRead(organizationId, user) : null,
      }),
    // `tick`: the read or the switches changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, rawDocument, organizationId, privatePay, tick]
  )
}

/** The same record outside React (timesheet reminders): waits for the switches and the own pay-profile read. */
export async function resolveOwnPayUser(): Promise<OwnPayState> {
  await securitySwitchesReady()
  const { user, organization, currentUserDocument } = useAuthStore.getState()
  const organizationId = organization?.id ?? null
  if (!user || !organizationId) return { user: null, status: 'loading', overlaid: false }
  const privatePay = privatePayFor(organizationId)
  const read = privatePay ? await ensureOwnPayRead(organizationId, user) : null
  return ownPayState({
    user,
    rawDocument: currentUserDocument,
    switchesLoaded: securitySwitchesLoaded(),
    privatePay,
    read,
  })
}
