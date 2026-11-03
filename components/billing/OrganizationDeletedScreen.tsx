'use client'

import { useState } from 'react'
import { getAuth } from 'firebase/auth'
import { useAuthStore } from '@/lib/stores/authStore'
import { canRestoreOrganization, organizationDeletedMessage, parseOrganizationDeletion } from '@/lib/canonical/organizationDeletion'
import { organizationTimeZone } from '@/lib/canonical'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'

/**
 * Rulebook 1.15.0 §20 (`organizationDeletionState` scheduled): the whole app while the organisation waits to be
 * erased. Everyone sees `organizationDeletedMessage`; the super admin (when the deletion is theirs to undo,
 * `canRestoreOrganization`) also sees Restore.
 */
export function OrganizationDeletedScreen() {
  const { user, organization, signOut } = useAuthStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const org = { id: organization?.id, creatorUserId: organization?.creatorUserId, deletion: organization?.deletion ?? null }
  const message = organizationDeletedMessage(
    parseOrganizationDeletion(org)?.eraseAfterMs ?? null,
    organizationTimeZone(organization?.countryCode)
  )
  const restorable = canRestoreOrganization({
    org,
    viewer: user ? { id: user.id, isSuperAdmin: user.isSuperAdmin, organizationId: user.organizationId } : null,
    viewerIsPlatformOwner: isPlatformOwnerEmail(user?.email),
  })

  async function restore() {
    if (!organization?.id) return
    setBusy(true)
    setError('')
    try {
      const token = await getAuth().currentUser?.getIdToken()
      const response = await fetch('/api/organization/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ organizationId: organization.id }),
      })
      const data = (await response.json().catch(() => ({}))) as { message?: string; stripeNote?: string; error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not restore the organisation.')
      setNotice([data.message, data.stripeNote].filter(Boolean).join(' '))
      window.setTimeout(() => window.location.assign('/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the organisation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg,white)] px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-lg font-semibold text-[var(--ink,#0f172a)]">Organisation deleted</p>
        <p className="mt-2 text-sm text-[var(--ink2,#475569)]">{message}</p>
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-col items-center gap-3">
          {restorable ? (
            <button type="button" className="btn primary" disabled={busy} onClick={() => void restore()}>
              {busy ? 'Restoring…' : 'Restore organisation'}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
