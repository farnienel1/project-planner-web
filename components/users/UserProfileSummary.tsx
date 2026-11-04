'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import { canShowAdminEditProfile, roleLabel } from '@/lib/staff/userEditPermissions'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { UserAvatar } from '@/components/users/UserAvatar'
import { canViewPersonPay, formatMoney } from '@/lib/canonical'
import { loadPayProfile } from '@/lib/pay/payProfileService'
import { personPayRecord, readsPersonPayProfile } from '@/lib/pay/payProfileOverlay'
import { onSecuritySwitchChange } from '@/lib/access/securitySwitches'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import type { PayProfileDocument } from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { normalizeEmploymentType } from '@/lib/ios-parity/enums'

function employmentLabel(value?: string) {
  return normalizeEmploymentType(value) === 'paye' ? 'PAYE' : 'Self-employed'
}

export function UserProfileSummary({
  userId,
  backHref,
  from,
}: {
  userId: string
  backHref: string
  from: string
}) {
  const router = useRouter()
  const { user: currentUser, organization } = useAuthStore()
  const currencyCode = useOrganizationCurrency()
  const { users, loadUsers } = useOrgUserStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { getUser } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Awaited<ReturnType<typeof getUser>>>(null)
  const [payProfile, setPayProfile] = useState<PayProfileDocument | null>(null)
  // Re-read when `privatePay` changes for the open organisation (the gate below reads it).
  const [switchTick, setSwitchTick] = useState(0)
  useEffect(
    () =>
      onSecuritySwitchChange((name) => {
        if (name === 'privatePay') setSwitchTick((tick) => tick + 1)
      }),
    []
  )

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadOperatives(organization.id)
    getUser(userId)
      .then(setTarget)
      .finally(() => setLoading(false))
  }, [organization?.id, userId, getUser, loadUsers, loadOperatives])

  // Rulebook 1.13.0 §8 (Q1, `canViewPersonPay`): pay, pay basis and employment type only for the person, their
  // active line managers, admins and operatives managers (for operatives). Rulebook 1.26.0 §8: pay comes from the
  // private pay profile (`overlayPayProfile`) only while `privatePay` is on for this organisation; off, older iOS builds
  // still write pay only to users / operatives / managers, so the profile can be stale and the users document is shown,
  // exactly as the roster (`overlayRosterPay`).
  const payVisible = useMemo(
    () =>
      Boolean(
        currentUser &&
          target &&
          canViewPersonPay(
            { ...currentUser, isPlatformOwner: isPlatformOwnerEmail(currentUser.email) } as never,
            target as never,
            users as never
          )
      ),
    [currentUser, target, users]
  )
  useEffect(() => {
    if (!organization?.id || !target?.id || !payVisible || !readsPersonPayProfile(organization.id)) {
      setPayProfile(null)
      return
    }
    let cancelled = false
    void loadPayProfile(organization.id, target.id).then((profile) => {
      if (!cancelled) setPayProfile(profile)
    })
    return () => {
      cancelled = true
    }
  }, [organization?.id, target?.id, payVisible, switchTick])
  const pay = useMemo(
    () => (target ? personPayRecord(organization?.id, target as unknown as Record<string, unknown>, payProfile) : null),
    // switchTick: the gate is re-read when `privatePay` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization?.id, target, payProfile, switchTick]
  ) as { payBasis?: string; dayRate?: number | null; hourlyRate?: number | null; employmentType?: string } | null

  const linkedOperative = useMemo(
    () => (target ? findOperativeForUser(target, operatives) : undefined),
    [target, operatives]
  )
  const lineManager = useMemo(() => {
    if (!target?.assignedManagerUserId) return null
    return users.find((row) => row.id === target.assignedManagerUserId) || null
  }, [users, target?.assignedManagerUserId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="empty card pad mx-auto max-w-2xl">
        <h3>User not found</h3>
        <p>That profile is not in this organisation.</p>
        <Link href={backHref} className="btn primary">
          Go back
        </Link>
      </div>
    )
  }

  const canEdit = canShowAdminEditProfile(currentUser)
  const editHref = `/dashboard/users/${target.id}/edit?from=${encodeURIComponent(from)}`
  const name = `${target.firstName} ${target.surname}`.trim() || roleLabel(target)
  const status = rosterStatusLabel(target)
  const quals = linkedOperative?.qualifications || []

  return (
    <div className="stack" data-hue="user">
      <button type="button" onClick={() => router.push(backHref)} className="btn sm ghost self-start">
        Back
      </button>

      <section className="hero">
        <div className="row wrap" style={{ position: 'relative', zIndex: 1, gap: 20 }}>
          <UserAvatar user={target} size={72} />
          <div className="grow">
            <div className="big">{name}</div>
            <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
              <span className="pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                {roleLabel(target)}
              </span>
              {target.passwordSet ? (
                <span className="pill dot" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                  Verified
                </span>
              ) : (
                <span className="pill dot" data-hue="warn">
                  Pending
                </span>
              )}
              <span className="pill dot" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                {status}
              </span>
            </div>
          </div>
          {canEdit ? (
            <Link href={editHref} className="btn hbtn solid">
              Edit profile
            </Link>
          ) : (
            <span className="pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
              View only
            </span>
          )}
        </div>
      </section>

      <section className="card pad">
        <h2 className="h2" style={{ marginBottom: 16 }}>
          Details
        </h2>
        <dl className="grid g2">
          <SummaryRow label="Email" value={target.email} />
          <SummaryRow label="Mobile" value={target.mobileNumber || '—'} />
          <SummaryRow
            label="Last active"
            value={target.lastSeenAt ? format(target.lastSeenAt, "d MMM yyyy 'at' HH:mm") : '—'}
          />
          <SummaryRow label="Trade" value={displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)} />
          {payVisible ? <SummaryRow label="Employment" value={employmentLabel(pay?.employmentType)} /> : null}
          <SummaryRow
            label="Line manager"
            value={lineManager ? `${lineManager.firstName} ${lineManager.surname}`.trim() : 'No line manager'}
          />
          {!payVisible ? null : pay?.payBasis === 'hourly' && pay.hourlyRate != null ? (
            <SummaryRow label="Hourly rate" value={`${formatMoney(Number(pay.hourlyRate), currencyCode)}/hr`} />
          ) : pay?.payBasis === 'day' && pay.dayRate != null ? (
            <SummaryRow label="Day rate" value={`${formatMoney(Number(pay.dayRate), currencyCode)}/day`} />
          ) : null}
        </dl>
      </section>

      {target.permissions.operativeMode ? (
        <section className="card pad" data-hue="rep">
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 className="h2">Qualifications</h2>
          </div>
          {quals.length === 0 ? (
            <p className="muted small">No qualifications yet.</p>
          ) : (
            <div className="rows">
              {quals.map((qual) => (
                <div key={qual.id} className="ritem" style={{ cursor: 'default' }} data-hue="rep">
                  <span className="grow">
                    <span className="t">{qual.name}</span>
                    <span className="s">
                      {qual.hasEndDate && qual.endDate ? `Expires ${format(qual.endDate, 'd MMM yyyy')}` : 'No expiry'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="f">
      <span className="eyebrow">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
