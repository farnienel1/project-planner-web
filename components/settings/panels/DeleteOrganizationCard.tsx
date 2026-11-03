'use client'

import { useState } from 'react'
import { getAuth } from 'firebase/auth'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  ORGANIZATION_DELETE_BODY,
  ORGANIZATION_DELETE_CONFIRMATION,
  ORGANIZATION_DELETE_TITLE,
  isOrganizationSuperAdmin,
  organizationDeleteConfirmationError,
} from '@/lib/canonical/organizationDeletion'
import { SettingsCard, ErrorBanner } from '@/components/settings/primitives'
import { FormInput } from '@/components/forms/FormShell'

/**
 * Rulebook 1.15.0 §20: Settings → Billing → Delete organisation, the super admin only (`isOrganizationSuperAdmin`).
 * The form asks for the company name and DELETE (`organizationDeleteConfirmationError`); the server schedules the
 * erasure, cancels Stripe at the period end and emails the owner and the super admin.
 * No data export exists in the web app yet, so the form says how to ask for a copy instead of linking one.
 */
export function DeleteOrganizationCard() {
  const { user, organization } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [typedConfirmation, setTypedConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const superAdmin =
    !!user &&
    !!organization &&
    isOrganizationSuperAdmin(
      { id: user.id, isSuperAdmin: user.isSuperAdmin, organizationId: user.organizationId },
      { id: organization.id, creatorUserId: organization.creatorUserId }
    )
  if (!superAdmin || !organization) return null

  const confirmationError = organizationDeleteConfirmationError({
    organizationName: organization.name,
    typedName,
    typedConfirmation,
  })

  async function submit() {
    if (!organization || confirmationError) return
    setBusy(true)
    setError('')
    try {
      const token = await getAuth().currentUser?.getIdToken()
      const response = await fetch('/api/organization/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ organizationId: organization.id, typedName, typedConfirmation }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not delete the organisation.')
      // The organisation listener shows the deleted screen; reload in case it is slow.
      window.location.assign('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the organisation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard>
      <div className="space-y-3 p-1">
        <p className="text-sm font-semibold text-red-700">{ORGANIZATION_DELETE_TITLE}</p>
        {!open ? (
          <>
            <p className="text-sm text-slate-600">Delete {organization.name} for everyone. Only the super admin can do this.</p>
            <button type="button" className="btn sm" onClick={() => setOpen(true)}>
              {ORGANIZATION_DELETE_TITLE}
            </button>
          </>
        ) : (
          <>
            {ORGANIZATION_DELETE_BODY.map((line) => (
              <p key={line} className="text-sm text-slate-600">
                {line}
              </p>
            ))}
            <p className="text-xs text-slate-500">
              Need a copy of your data first? There is no export in the app yet — email info@projectplanner.us before you delete.
            </p>
            {error ? <ErrorBanner message={error} /> : null}
            <label className="block text-sm text-slate-700">
              Type the company name ({organization.name})
              <FormInput className="mt-1 w-full" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
            </label>
            <label className="block text-sm text-slate-700">
              Type {ORGANIZATION_DELETE_CONFIRMATION} to confirm
              <FormInput className="mt-1 w-full" value={typedConfirmation} onChange={(e) => setTypedConfirmation(e.target.value)} autoComplete="off" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn sm danger" disabled={busy || !!confirmationError} onClick={() => void submit()}>
                {busy ? 'Deleting…' : ORGANIZATION_DELETE_TITLE}
              </button>
              <button type="button" className="btn sm" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </SettingsCard>
  )
}
