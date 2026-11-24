'use client'

/**
 * Rulebook 1.81.0 §11 "Names per organisation": the open organisation's `memberNames` entries, live, laid over every
 * person the web holds — the roster (`useOrgUserStore.users`) and the signed-in user (`useAuthStore.user`) — so every
 * screen that shows a name from them (lists, bookings, Daily Overview, timesheets, invoices, PDFs, the weekly report,
 * notices written by this app) shows the person's name in THIS company. The names come from the rulebook only
 * (`parseMemberNameDocuments`, `memberNameFor`); this module only listens and lays them over.
 *
 * Each overlaid user carries `orgNameOverlay` (what was laid over, and the users document's own name under it), so the
 * overlay can be undone when an entry is removed and a screen's own later edit of the name is never reverted:
 * `accountNameOf(user)` is the users document's name (what Edit user writes in the home organisation).
 */
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { MEMBER_NAMES_COLLECTION, parseMemberNameDocuments, type MemberNames } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { overlayMemberNames, overlayOne, type NamedUser } from '@/lib/staff/memberNameOverlay'
export { accountNameOf, hasOrganizationName, overlayMemberName, overlayMemberNames } from '@/lib/staff/memberNameOverlay'

let organizationId = ''
let names: MemberNames = {}
let unsubscribe: Unsubscribe | null = null
let installed = false

/** The entries of the open organisation (lower-case users id → entry), for code that needs them directly. */
export function currentMemberNames(forOrganizationId: string): MemberNames {
  return forOrganizationId && forOrganizationId === organizationId ? names : {}
}

function rosterOrganizationId(): string {
  const state = useOrgUserStore.getState()
  return state.rosterLoadedOrgId || useAuthStore.getState().organization?.id || ''
}

function applyToRoster() {
  const state = useOrgUserStore.getState()
  const entries = rosterOrganizationId() === organizationId ? names : {}
  const next = overlayMemberNames(state.users as NamedUser[], entries)
  if (next !== state.users) useOrgUserStore.setState({ users: next })
}

function applyToSignedInUser() {
  const state = useAuthStore.getState()
  if (!state.user) return
  const entries = state.organization?.id === organizationId ? names : {}
  const next = overlayOne(state.user as NamedUser, entries)
  if (next !== state.user) useAuthStore.setState({ user: next })
}

function listen(nextOrganizationId: string) {
  if (nextOrganizationId === organizationId && unsubscribe) return
  unsubscribe?.()
  unsubscribe = null
  organizationId = nextOrganizationId
  names = {}
  applyToRoster()
  applyToSignedInUser()
  if (!nextOrganizationId) return
  unsubscribe = onSnapshot(
    collection(getFirebaseDb(), 'organizations', nextOrganizationId, MEMBER_NAMES_COLLECTION),
    (snap) => {
      if (organizationId !== nextOrganizationId) return
      names = parseMemberNameDocuments(snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> })))
      applyToRoster()
      applyToSignedInUser()
    },
    (error) => {
      // A refused or failed read leaves the users document names (as before 1.81.0); never an empty name.
      console.warn('[memberNames] listener failed', error)
    }
  )
}

/**
 * Starts the live entries for the open organisation and keeps both stores overlaid. Idempotent; called by the
 * dashboard layout. A sign-out (no user) stops the listener.
 */
export function installMemberNames(): void {
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
