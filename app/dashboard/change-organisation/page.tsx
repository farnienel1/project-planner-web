'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  acceptOrgMembership,
  loadUserOrgMemberships,
  switchActiveOrganization,
} from '@/lib/orgMembership/membershipService'
import type { OrgMembership } from '@/lib/orgMembership/types'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export default function ChangeOrganisationPage() {
  const router = useRouter()
  const { user, firebaseUser, organization, loading: authLoading } = useAuthStore()
  const [memberships, setMemberships] = useState<OrgMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSwitchSplash, setShowSwitchSplash] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!firebaseUser?.uid) return
      setLoading(true)
      try {
        const rows = await loadUserOrgMemberships(firebaseUser.uid)
        if (!cancelled) {
          if (rows.length === 0 && organization) {
            setMemberships([
              {
                organizationId: organization.id,
                organizationName: organization.name,
                role: 'admin',
                status: 'active',
                invitedAt: organization.createdAt,
              },
            ])
          } else {
            setMemberships(rows)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load organisations')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser?.uid, organization?.id])

  if (authLoading || loading) {
    return <LoadingSpinner label="Loading organisations…" />
  }

  if (!user) return null

  const activeOrgId = organization?.id || user.organizationId

  async function handleAccept(membership: OrgMembership) {
    if (!firebaseUser?.uid) return
    setAcceptingId(membership.organizationId)
    setError(null)
    try {
      await acceptOrgMembership(firebaseUser.uid, membership.organizationId)
      const rows = await loadUserOrgMemberships(firebaseUser.uid)
      setMemberships(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation')
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleSwitch(membership: OrgMembership) {
    if (!firebaseUser?.uid) return
    setSwitchingId(membership.organizationId)
    setError(null)
    setShowSwitchSplash(true)
    try {
      await switchActiveOrganization(firebaseUser.uid, membership.organizationId)
      await new Promise((resolve) => setTimeout(resolve, 900))
      window.location.href = '/dashboard'
    } catch (err) {
      setShowSwitchSplash(false)
      setError(err instanceof Error ? err.message : 'Could not switch organisation')
      setSwitchingId(null)
    }
  }

  if (showSwitchSplash) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-lg font-bold text-white shadow-lg">
          PP
        </div>
        <p className="text-sm font-semibold text-slate-700">Switching organisation…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Change organisation</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Switch between organisations linked to your account. Each organisation has its own projects, team and
          settings — there is no overlap when you switch.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4">
        {memberships.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            You are currently signed in to <strong>{organization?.name || 'your organisation'}</strong>. Additional
            organisations will appear here when you are invited to join them.
          </div>
        )}

        {memberships.map((membership) => {
          const isActive = membership.organizationId === activeOrgId
          const isPending = membership.status === 'pending'

          return (
            <div
              key={membership.organizationId}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                isActive ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-slate-900">{membership.organizationName}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {membership.role}
                    {isActive ? ' · Current' : ''}
                    {isPending ? ' · Invitation pending' : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => void handleAccept(membership)}
                      disabled={acceptingId === membership.organizationId}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acceptingId === membership.organizationId ? 'Accepting…' : 'Accept invitation'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSwitch(membership)}
                      disabled={isActive || switchingId === membership.organizationId}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActive
                        ? 'Current organisation'
                        : switchingId === membership.organizationId
                          ? 'Switching…'
                          : 'Change to this organisation'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
