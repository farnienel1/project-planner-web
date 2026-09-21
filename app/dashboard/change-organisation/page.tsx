/**
 * iOS parity source: Views/SwitchOrganisationView.swift, Core/FirebaseBackend+OrganizationMembership.swift
 * Spec: docs/ios-parity/sections/26-switch-organisation.md
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BuildingOffice2Icon, ChevronRightIcon, LockClosedIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  acceptOrgMembership,
  loadUserOrgMemberships,
  switchActiveOrganization,
} from '@/lib/orgMembership/membershipService'
import { roleDisplayName } from '@/lib/orgMembership/organizationTrialPolicy'
import {
  formatMembershipCreatedLabel,
  shortOrganizationId,
} from '@/lib/orgSetup/pendingOrganizationReuse'
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

  const activeOrgId = organization?.id || user?.organizationId

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
        const rows = await loadUserOrgMemberships(firebaseUser.uid, activeOrgId)
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
  }, [firebaseUser?.uid, organization?.id, activeOrgId])

  async function reload() {
    if (!firebaseUser?.uid) return
    const rows = await loadUserOrgMemberships(firebaseUser.uid, activeOrgId)
    setMemberships(rows)
  }

  async function handleAccept(membership: OrgMembership) {
    if (!firebaseUser?.uid) return
    setAcceptingId(membership.organizationId)
    setError(null)
    try {
      await acceptOrgMembership(firebaseUser.uid, membership.organizationId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation')
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleSwitch(membership: OrgMembership) {
    if (!firebaseUser?.uid) return
    if (membership.organizationId === activeOrgId || membership.trialAccessBlocked) return
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

  if (authLoading || loading) {
    return <LoadingSpinner label="Loading organisations…" />
  }

  if (!user) return null

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
    <div className="mx-auto max-w-3xl space-y-5 pb-10 xl:grid xl:max-w-6xl xl:grid-cols-12 xl:gap-8 xl:space-y-0">
      <div className="xl:col-span-5">
        <h1>Switch organisation</h1>
        <div className="mt-4 card p-5 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Work across teams</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Choose which organisation you want to use in the app. Your schedule, projects, and settings will update to
            match.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Organisations with the same name are listed with the date they were created and a short ID so you can tell
            them apart. Rows marked Setup incomplete were started during organisation setup and do not contain your
            company data yet — stay on the one that has your projects.
          </p>
        </div>
        {error && (
          <p className="mt-4 text-xs font-medium text-red-600">{error}</p>
        )}
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-950">Need another workspace?</p>
          <p className="mt-1 text-sm text-blue-900">
            Create your own organisation at any time. You will be billed separately for it, and your existing
            organisations stay as they are.
          </p>
          <Link
            href="/setup"
            className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Set up a new organisation
          </Link>
        </div>
      </div>

      <div className="xl:col-span-7">
        {memberships.length === 0 ? (
          <div className="card p-6">
            <p className="text-base font-semibold text-slate-900">No organisations found</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              If you were invited to another organisation, pull to refresh or sign out and sign in again.
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">
              Your organisations
            </p>
            <div className="overflow-hidden card shadow-sm divide-y divide-slate-100">
              {memberships.map((membership) => {
                const isActive = membership.organizationId === activeOrgId
                const isPending = membership.status === 'pending'
                const locked = membership.trialAccessBlocked === true
                const setupIncomplete = membership.setupIncomplete === true
                const switching = switchingId === membership.organizationId
                const disabled =
                  isActive || switching || locked || Boolean(switchingId) || (setupIncomplete && !isActive)
                const createdLabel = formatMembershipCreatedLabel(membership.createdAt)
                const shortId = shortOrganizationId(membership.organizationId)

                return (
                  <button
                    key={membership.organizationId}
                    type="button"
                    disabled={disabled && !isPending}
                    onClick={() => {
                      if (isPending) void handleAccept(membership)
                      else void handleSwitch(membership)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-100"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-t)] text-[var(--blue)]">
                      <BuildingOffice2Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{membership.organizationName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{roleDisplayName(membership.role)}</span>
                        {membership.isTrial && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">
                            Trial
                          </span>
                        )}
                        {locked && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                            Locked
                          </span>
                        )}
                        {setupIncomplete && (
                          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-800">
                            Setup incomplete
                          </span>
                        )}
                        {isPending && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                            Invitation pending
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {createdLabel ? `Created ${createdLabel}` : 'Created date unknown'}
                        {' · '}
                        ID {shortId}
                      </p>
                    </div>
                    {switching || acceptingId === membership.organizationId ? (
                      <span className="text-xs font-medium text-slate-400">
                        {isPending ? 'Accepting…' : 'Switching…'}
                      </span>
                    ) : isActive ? (
                      <span className="rounded-full bg-[var(--blue-t)] px-2 py-0.5 text-[11px] font-bold text-[var(--blue)]">
                        Active
                      </span>
                    ) : locked ? (
                      <LockClosedIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-300" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
