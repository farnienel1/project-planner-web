'use client'

/**
 * Rulebook 1.88.0 §8, §11 "Line managers per organisation": a roster member whose home is another company reads their
 * line manager in THIS company from their membership here (`users/{uid}/orgMemberships/{orgId}.lineManager`, written
 * by this company's admins). This module listens to those memberships — only for the people on the open company's
 * roster whose users document names another company — and lays the rulebook's answer over the roster rows
 * (`withOrganizationLineManager`), so every screen and rule that reads line managers from the roster (User Timesheets,
 * leave approvals, notices, pay visibility, warnings scope, Data health, the pickers) reads this company's line
 * manager. Home-company people are never read here and stay exactly as stored. A refused or failed read leaves the
 * users document's fields (as before 1.88.0). The signed-in person's own membership is applied when the session is
 * built (`applyDeviceOrgMembership`).
 */
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isHomeOrganization, withOrganizationLineManager } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import type { User } from '@/types'

let organizationId = ''
let installed = false
/** Lower-case users id → membership data (only for people whose home is elsewhere). */
const memberships = new Map<string, Record<string, unknown> | null>()
const listeners = new Map<string, Unsubscribe>()

function rosterOrganizationId(): string {
  const state = useOrgUserStore.getState()
  return state.rosterLoadedOrgId || useAuthStore.getState().organization?.id || ''
}

/** Roster rows whose users document names another company (`isHomeOrganization` false). */
function visitors(users: readonly User[], org: string): User[] {
  return users.filter((user) => user?.id && !isHomeOrganization(user as unknown as Record<string, unknown>, org))
}

function applyToRoster() {
  const state = useOrgUserStore.getState()
  const org = rosterOrganizationId()
  if (!org || org !== organizationId) return
  let changed = false
  const next = state.users.map((user) => {
    const membership = memberships.get(user.id.toLowerCase())
    if (!membership) return user
    const row = withOrganizationLineManager(user, { organizationId: org, membership })
    if (row !== user) changed = true
    return row
  })
  if (changed) useOrgUserStore.setState({ users: next })
}

function stopAll() {
  for (const stop of listeners.values()) stop()
  listeners.clear()
  memberships.clear()
}

function sync() {
  const org = rosterOrganizationId()
  if (org !== organizationId) {
    stopAll()
    organizationId = org
  }
  if (!org || !useAuthStore.getState().user) return
  const wanted = new Set<string>()
  for (const user of visitors(useOrgUserStore.getState().users, org)) {
    const key = user.id.toLowerCase()
    wanted.add(key)
    if (listeners.has(key)) continue
    const forOrg = org
    listeners.set(
      key,
      onSnapshot(
        doc(getFirebaseDb(), 'users', user.id, 'orgMemberships', org),
        (snap) => {
          if (organizationId !== forOrg) return
          memberships.set(key, snap.exists() ? (snap.data() as Record<string, unknown>) : null)
          applyToRoster()
        },
        (error) => {
          // Older rules let only admins read another person's membership: the users document stays the source.
          console.warn('[memberLineManagers] membership read failed', error instanceof Error ? error.message : 'unknown')
        }
      )
    )
  }
  for (const [key, stop] of listeners) {
    if (wanted.has(key)) continue
    stop()
    listeners.delete(key)
    memberships.delete(key)
  }
  applyToRoster()
}

/** Starts the membership reads for the open company's visiting members. Idempotent; called by the dashboard layout. */
export function installMemberLineManagers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  useAuthStore.subscribe(() => sync())
  useOrgUserStore.subscribe(() => sync())
  sync()
}

/** The membership this module holds for `userId` in the open company (null when none was read). */
export function heldMembership(forOrganizationId: string, userId: string): Record<string, unknown> | null {
  if (!forOrganizationId || forOrganizationId !== organizationId) return null
  return memberships.get(userId.toLowerCase()) ?? null
}
