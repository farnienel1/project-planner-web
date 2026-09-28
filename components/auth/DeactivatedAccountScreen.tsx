'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { loadUserOrgMemberships, switchActiveOrganization } from '@/lib/orgMembership/membershipService'
import {
  DEACTIVATED_ACCOUNT_MESSAGE,
  otherOrganisations,
  SWITCH_ORGANISATION_LABEL,
  type DeactivatedOrgChoice,
} from '@/lib/auth/deactivatedAccount'

export function DeactivatedAccountScreen() {
  const { user, firebaseUser, organization, signOut } = useAuthStore()
  const [others, setOthers] = useState<DeactivatedOrgChoice[]>([])
  const [showSwitch, setShowSwitch] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeOrgId = user?.organizationId || organization?.id || ''

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!firebaseUser?.uid || !activeOrgId) return
      try {
        const rows = await loadUserOrgMemberships(firebaseUser.uid, activeOrgId)
        if (cancelled) return
        setOthers(
          otherOrganisations(
            rows.map((row) => ({
              organizationId: row.organizationId,
              organizationName: row.organizationName,
            })),
            activeOrgId
          )
        )
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load organisations')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser?.uid, activeOrgId])

  async function switchTo(organizationId: string) {
    if (!firebaseUser?.uid) return
    setSwitchingId(organizationId)
    setError(null)
    try {
      await switchActiveOrganization(firebaseUser.uid, organizationId)
      window.location.assign('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch organisation')
      setSwitchingId(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <div className="w-full max-w-md rounded-[22px] bg-[var(--card)] p-6 shadow-[var(--sh-pop)]" role="dialog" aria-modal="true">
        <h1 className="font-[family-name:var(--head)] text-xl font-extrabold text-[var(--ink)]">Account deactivated</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink2)]">{DEACTIVATED_ACCOUNT_MESSAGE}</p>
        {organization?.name ? (
          <p className="mt-2 text-xs text-[var(--ink3)]">{organization.name}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-[var(--red)]">{error}</p> : null}
        {others.length > 0 ? (
          <div className="mt-5">
            <button type="button" className="btn primary w-full" onClick={() => setShowSwitch(true)}>
              {SWITCH_ORGANISATION_LABEL}
            </button>
            {showSwitch ? (
              <ul className="mt-3 space-y-2">
                {others.map((row) => (
                  <li key={row.organizationId}>
                    <button
                      type="button"
                      className="btn w-full"
                      disabled={switchingId !== null}
                      onClick={() => void switchTo(row.organizationId)}
                    >
                      {switchingId === row.organizationId ? 'Switching…' : row.organizationName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <button type="button" className="btn ghost mt-4 w-full" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
