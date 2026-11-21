'use client'

/**
 * Owner console: Restore a company scheduled for erasure (rulebook §11 / §20). A company deleted with its last
 * member's account (`restoreBy: 'platform_owner'`) can only be restored by the platform owner, who never sees the
 * locked screen with the super admin's Restore. Shown only while `canRestoreOrganization` allows it (scheduled, not
 * erased); the erase date is in the organisation's zone (`organizationDeletedMessage`, `organizationTimeZone`).
 */
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  canRestoreOrganization,
  organizationDeletedMessage,
  organizationDeletionState,
  organizationTimeZone,
} from '@/lib/canonical'
import { ownerRestoreOrganisation } from '@/lib/owner/ownerActions'

export function OwnerRestoreOrganisation({ organisationId, onRestored }: { organisationId: string; onRestored: (message: string) => void }) {
  const [org, setOrg] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(getFirebaseDb(), 'organizations', organisationId))
      .then((snap) => {
        if (!cancelled) setOrg(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      })
      .catch(() => {
        if (!cancelled) setOrg(null)
      })
    return () => {
      cancelled = true
    }
  }, [organisationId, reload])

  if (!org || !canRestoreOrganization({ org, viewerIsPlatformOwner: true })) return null
  const state = organizationDeletionState(org)
  const eraseAfterMs = state.state === 'scheduled' ? state.eraseAfterMs : null
  const zone = organizationTimeZone(typeof org.countryCode === 'string' ? org.countryCode : null)

  return (
    <section className="card pad space-y-3">
      <h2 className="h2">Scheduled for deletion</h2>
      <p className="text-sm text-(--ink2)">{organizationDeletedMessage(eraseAfterMs, zone)}</p>
      {error ? (
        <p className="banner" data-hue="red">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn sm primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            const result = await ownerRestoreOrganisation(organisationId)
            onRestored(result.message)
            setReload((value) => value + 1)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not restore that organisation.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Restoring…' : 'Restore organisation'}
      </button>
    </section>
  )
}
