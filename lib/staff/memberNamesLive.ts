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
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  MEMBER_NAMES_COLLECTION,
  memberNameEntryMissing,
  memberNameJoinEntry,
  memberNameWriteFields,
  parseMemberNameDocuments,
  type MemberNames,
} from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { accountNameOf, overlayMemberNames, overlayOne, type NamedUser } from '@/lib/staff/memberNameOverlay'
export { accountNameOf, hasOrganizationName, overlayMemberName, overlayMemberNames } from '@/lib/staff/memberNameOverlay'

let organizationId = ''
let names: MemberNames = {}
let unsubscribe: Unsubscribe | null = null
let installed = false
/** `orgId/uid` pairs this session already tried to seed (one attempt each). */
const seeded = new Set<string>()

/**
 * Rulebook 1.82.0 §1, §11 (`memberNameEntryMissing`): the signed-in person has no entry in the open organisation yet —
 * create it, once, with the name this organisation shows them today (the users document's name), so a later name
 * edit in another of their organisations never changes the name here. Create-only: read in a transaction and never
 * written over an entry (a refusal or a lost race changes nothing). The security rules let a member write their own
 * entry.
 */
function seedOwnEntry(forOrganizationId: string, entries: MemberNames, serverRead: boolean) {
  const state = useAuthStore.getState()
  const user = state.user as NamedUser | null
  if (!user || state.organization?.id !== forOrganizationId) return
  const pair = `${forOrganizationId}/${user.id}`.toLowerCase()
  if (seeded.has(pair)) return
  if (!memberNameEntryMissing({ person: user, names: entries, serverRead })) return
  const name = memberNameJoinEntry([accountNameOf(user)])
  const fields = name ? memberNameWriteFields({ ...name, writerUserId: user.id, platform: 'web' }) : null
  if (!fields) return
  seeded.add(pair)
  const db = getFirebaseDb()
  const ref = doc(db, 'organizations', forOrganizationId, MEMBER_NAMES_COLLECTION, user.id)
  void runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (snap.exists()) return
    transaction.set(ref, { ...fields, updatedAt: serverTimestamp() })
  }).catch((error) => console.warn('[memberNames] own entry not created', error instanceof Error ? error.message : 'unknown'))
}

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
      seedOwnEntry(nextOrganizationId, names, !snap.metadata.fromCache)
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
