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
      <div className="empty card pad" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <div className="brand-logo" style={{ width: 64, height: 64, fontSize: 18 }}>PP</div>
        <p className="muted">Switching organisation…</p>
      </div>
    )
  }

  return (
    <div className="stack" data-hue="lib" style={{ maxWidth: 900 }}>
      <div className="phead" data-hue="lib">
        <div className="badge-ico">
          <BuildingOffice2Icon className="h-6 w-6" />
        </div>
        <div>
          <h1>Switch organisation</h1>
          <div className="sub">Choose which company you are working in</div>
        </div>
      </div>

      <section className="card pad">
        <h2 className="h2">Work across teams</h2>
        <p className="muted small" style={{ marginTop: 8 }}>
          Choose which organisation you want to use in the app. Your schedule, projects, and settings will update to
          match.
        </p>
        <p className="muted xs" style={{ marginTop: 10 }}>
          Organisations with the same name are listed with the date they were created and a short ID so you can tell
          them apart. Rows marked Setup incomplete were started during organisation setup and do not contain your
          company data yet — stay on the one that has your projects.
        </p>
      </section>

      {error ? <p className="banner" data-hue="red">{error}</p> : null}

      {memberships.length === 0 ? (
        <div className="empty card pad">
          <h3>No organisations found</h3>
          <p>If you were invited to another organisation, pull to refresh or sign out and sign in again.</p>
        </div>
      ) : (
        <div className="rows">
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
                className={`ritem ${isActive ? 'sel' : ''}`}
                data-hue="lib"
              >
                <span className="ico-chip">
                  <BuildingOffice2Icon className="h-5 w-5" />
                </span>
                <span className="grow">
                  <span className="t" style={{ fontSize: 17 }}>{membership.organizationName}</span>
                  <span className="s">
                    {roleDisplayName(membership.role)}
                    {isActive ? ' · Current organisation' : ''}
                    {membership.isTrial ? ' · Trial' : ''}
                    {locked ? ' · Locked' : ''}
                    {setupIncomplete ? ' · Setup incomplete' : ''}
                    {isPending ? ' · Invitation pending' : ''}
                  </span>
                  <span className="s">
                    {createdLabel ? `Created ${createdLabel}` : 'Created date unknown'} · ID {shortId}
                  </span>
                </span>
                {switching || acceptingId === membership.organizationId ? (
                  <span className="muted small">{isPending ? 'Accepting…' : 'Switching…'}</span>
                ) : isActive ? (
                  <span className="pill" data-hue="green">Current</span>
                ) : locked ? (
                  <LockClosedIcon className="h-4 w-4 text-[var(--ink3)]" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-[var(--ink3)]" />
                )}
              </button>
            )
          })}
        </div>
      )}

      <Link
        href="/setup"
        className="card pad click"
        style={{ border: '2px dashed var(--line2)', boxShadow: 'none', background: 'transparent', display: 'block' }}
      >
        <div className="row">
          <div className="ico-chip lg" data-hue="blue">
            <span style={{ fontSize: 22, fontWeight: 700 }}>+</span>
          </div>
          <div>
            <b style={{ fontFamily: 'var(--head)', fontSize: 17 }}>Set up a new organisation</b>
            <div className="muted">
              Create your own organisation at any time. You will be billed separately for it, and your existing
              organisations stay as they are.
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
