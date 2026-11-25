'use client'

/**
 * Rulebook 1.88.0 §8, §11 "Line managers per organisation": a person whose home is another company reads their line
 * manager in THIS company from this company's own record `organizations/{orgId}/memberLineManagers/{uid}` (written by
 * this company's admins; every member may read it — it holds only the three line-manager keys). This module keeps ONE
 * listener on the open company's `memberLineManagers` collection and lays the rulebook's answer
 * (`withOrganizationLineManager`) over the roster rows and the signed-in user, so every screen that reads line managers
 * from them (User Timesheets, leave approvals, notices, pay visibility, warnings scope, Data health, the pickers) reads
 * this company's line manager. Home-company people are never changed (the rulebook ignores a record for them). A
 * refused or failed read leaves the users document's fields (as before 1.88.0).
 *
 * For each person overlaid it remembers the users document's own fields and what it showed (`applied`), so a record
 * that is removed puts the users document's fields back, a later record starts from the users document (never from the
 * previous record), and a row another overlay (names) copied keeps working; a row whose fields no longer match what
 * was shown (a fresh roster read) is taken as the users document.
 */
import { useSyncExternalStore } from 'react'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { MEMBER_LINE_MANAGERS_COLLECTION, withOrganizationLineManager } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import type { User } from '@/types'

type LineManagerBase = Pick<User, 'assignedManagerUserIds' | 'assignedManagerUserId' | 'hasNoLineManager'>

let organizationId = ''
let installed = false
let unsubscribe: Unsubscribe | null = null
/** Lower-case users id → record data, for the open company. */
let records = new Map<string, Record<string, unknown>>()
/** Bumped on every change, for `useMemberLineManagerRecord`. */
let version = 0
const subscribers = new Set<() => void>()
/** Lower-case users id → the users document's own fields and the fields laid over them. */
const applied = new Map<string, { base: LineManagerBase; shown: LineManagerBase }>()

function notify() {
  version += 1
  for (const listener of subscribers) listener()
}

function fieldsOf(user: LineManagerBase): LineManagerBase {
  return {
    assignedManagerUserIds: user.assignedManagerUserIds,
    assignedManagerUserId: user.assignedManagerUserId,
    hasNoLineManager: user.hasNoLineManager,
  }
}

function baseOf(user: User): User {
  const entry = applied.get(user.id.toLowerCase())
  return entry && sameFields(user, entry.shown) ? { ...user, ...entry.base } : user
}

function sameFields(a: LineManagerBase, b: LineManagerBase): boolean {
  return (
    (a.hasNoLineManager === true) === (b.hasNoLineManager === true) &&
    (a.assignedManagerUserId ?? '') === (b.assignedManagerUserId ?? '') &&
    JSON.stringify(a.assignedManagerUserIds ?? []) === JSON.stringify(b.assignedManagerUserIds ?? [])
  )
}

function overlay(user: User, org: string, homeOrganizationId?: unknown): User {
  const key = user.id.toLowerCase()
  const plain = baseOf(user)
  const record = records.get(key) ?? null
  const row = withOrganizationLineManager(plain, { organizationId: org, record, homeOrganizationId })
  if (row === plain) {
    if (plain !== user) applied.delete(key)
    return plain
  }
  applied.set(key, { base: fieldsOf(plain), shown: fieldsOf(row) })
  // Already showing exactly this record: keep the same object, so stores do not re-render for nothing.
  return sameFields(user, row) ? user : row
}

function rosterOrganizationId(): string {
  const state = useOrgUserStore.getState()
  return state.rosterLoadedOrgId || useAuthStore.getState().organization?.id || ''
}

function applyToRoster() {
  const state = useOrgUserStore.getState()
  const org = rosterOrganizationId()
  const live = Boolean(org) && org === organizationId
  let changed = false
  const next = state.users.map((user) => {
    const row = live ? overlay(user, org) : baseOf(user)
    if (row !== user) changed = true
    return row
  })
  if (changed) useOrgUserStore.setState({ users: next })
}

function applyToSignedInUser() {
  const state = useAuthStore.getState()
  const user = state.user
  if (!user) return
  const org = state.organization?.id || ''
  // The session profile's `organizationId` is the open company; its home is `homeOrganizationId`.
  const next =
    org && org === organizationId ? overlay(user, org, user.homeOrganizationId ?? user.organizationId) : baseOf(user)
  if (next !== user) useAuthStore.setState({ user: next })
}

function listen(nextOrganizationId: string) {
  if (nextOrganizationId === organizationId && unsubscribe) return
  unsubscribe?.()
  unsubscribe = null
  organizationId = nextOrganizationId
  records = new Map()
  applyToRoster()
  applyToSignedInUser()
  applied.clear()
  notify()
  if (!nextOrganizationId) return
  const forOrg = nextOrganizationId
  unsubscribe = onSnapshot(
    collection(getFirebaseDb(), 'organizations', forOrg, MEMBER_LINE_MANAGERS_COLLECTION),
    (snap) => {
      if (organizationId !== forOrg) return
      const next = new Map<string, Record<string, unknown>>()
      for (const row of snap.docs) next.set(row.id.toLowerCase(), row.data() as Record<string, unknown>)
      records = next
      applyToRoster()
      applyToSignedInUser()
      notify()
    },
    (error) => {
      // Rules before 1.88.0 refuse the collection: the users document stays the source.
      console.warn('[memberLineManagers] listener failed', error instanceof Error ? error.message : 'unknown')
    }
  )
}

/** Starts the open company's `memberLineManagers` listener. Idempotent; called by the dashboard layout. */
export function installMemberLineManagers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  useAuthStore.subscribe((state) => {
    const org = state.user ? state.organization?.id || '' : ''
    if (org !== organizationId) listen(org)
    else applyToSignedInUser()
  })
  useOrgUserStore.subscribe(() => applyToRoster())
  const initial = useAuthStore.getState()
  listen(initial.user ? initial.organization?.id || '' : '')
}

/** This company's record for `userId` (null when none was read, or another company is open). */
export function heldLineManagerRecord(forOrganizationId: string, userId: string): Record<string, unknown> | null {
  if (!forOrganizationId || forOrganizationId !== organizationId || !userId) return null
  return records.get(userId.toLowerCase()) ?? null
}

function subscribe(listener: () => void) {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

/**
 * React: this company's record for `userId`, re-rendering when it arrives or changes (Edit user re-applies it to a
 * form loaded before the listener answered).
 */
export function useMemberLineManagerRecord(
  forOrganizationId: string | undefined,
  userId: string | undefined
): Record<string, unknown> | null {
  useSyncExternalStore(subscribe, () => version, () => 0)
  return forOrganizationId && userId ? heldLineManagerRecord(forOrganizationId, userId) : null
}
