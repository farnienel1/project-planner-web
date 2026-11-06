'use client'

/**
 * Rulebook 1.32.4 (§16): the security rules read the signed-in person's role and company facts from their ID token's
 * custom claims (`pp`), which the Cloud Function sets whenever their users document, a membership or an organisation's
 * `members` / `creatorUserId` changes. A token carries the claims it was issued with, so after a change the app must
 * fetch a new token. The function writes the marker `users/{uid}/private/authClaims` `{ v }` after every change; this
 * module listens to it and calls `getIdToken(true)` when the token's claims are older (`authClaimsTokenIsStale`), then
 * tells the app (`AUTH_CLAIMS_REFRESHED_EVENT`) so open screens reload with the new access.
 *
 * `waitForOrganizationClaims` is for the moments a person gains an organisation and goes straight on to use it:
 * founding a company and accepting an invitation. It waits (bounded) until the token's claims give that organisation.
 */
import type { User as FirebaseUser } from 'firebase/auth'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { authClaimsCoverOrganization, authClaimsMarkerPath, authClaimsTokenIsStale } from '@/lib/canonical'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

export const AUTH_CLAIMS_REFRESHED_EVENT = 'pp:auth-claims-refreshed'

export type AuthClaimsRefreshedDetail = { uid: string; version: number }

let stopMarker: Unsubscribe | null = null
let watchedUid = ''
let lastMarkerVersion: number | null = null
const markerWaiters = new Set<() => void>()

function markerVersion(data: Record<string, unknown> | undefined): number | null {
  const v = data?.v
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Refreshes the ID token when the marker names newer claims. Returns true when it refreshed. */
async function refreshIfStale(user: FirebaseUser, version: number | null): Promise<boolean> {
  if (version == null) return false
  const current = await user.getIdTokenResult().catch(() => null)
  if (current && !authClaimsTokenIsStale(version, current.claims)) return false
  await user.getIdToken(true)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AuthClaimsRefreshedDetail>(AUTH_CLAIMS_REFRESHED_EVENT, { detail: { uid: user.uid, version } }))
  }
  return true
}

/**
 * Listens to the signed-in person's marker (one listener; `null` stops it on sign-out). A marker the rules do not let
 * this build read yet (before the 1.32.4 rules are published) is ignored: the token then refreshes hourly as before.
 */
export function watchAuthClaims(user: FirebaseUser | null): void {
  if (!user) {
    stopMarker?.()
    stopMarker = null
    watchedUid = ''
    lastMarkerVersion = null
    return
  }
  if (stopMarker && watchedUid === user.uid) return
  stopMarker?.()
  watchedUid = user.uid
  lastMarkerVersion = null
  try {
    stopMarker = onSnapshot(
      doc(getFirebaseDb(), authClaimsMarkerPath(user.uid)),
      (snap) => {
        const version = snap.exists() ? markerVersion(snap.data() as Record<string, unknown>) : null
        if (version == null || version === lastMarkerVersion) return
        lastMarkerVersion = version
        void refreshIfStale(user, version)
          .catch((error) => console.warn('Auth claims: token refresh failed', error))
          .finally(() => {
            for (const wake of markerWaiters) wake()
          })
      },
      () => {
        stopMarker = null
      }
    )
  } catch {
    stopMarker = null
  }
}

/**
 * After founding or joining `organizationId`: resolves true once the signed-in token's claims give that organisation,
 * false after `timeoutMs` (the screens then load as far as the rules allow and refresh when the marker arrives).
 */
export async function waitForOrganizationClaims(user: FirebaseUser, organizationId: string, timeoutMs = 20000): Promise<boolean> {
  const orgId = String(organizationId || '').trim()
  if (!orgId) return false
  const covered = async (force: boolean) => {
    const result = await user.getIdTokenResult(force).catch(() => null)
    return Boolean(result && authClaimsCoverOrganization(result.claims, orgId))
  }
  if (await covered(false)) return true
  watchAuthClaims(user)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const left = deadline - Date.now()
    // Wake on the next marker change, or poll every few seconds (the function may already have run).
    await new Promise<void>((resolve) => {
      const wake = () => {
        markerWaiters.delete(wake)
        resolve()
      }
      markerWaiters.add(wake)
      setTimeout(wake, Math.min(4000, Math.max(0, left)))
    })
    if (await covered(true)) return true
  }
  return false
}
