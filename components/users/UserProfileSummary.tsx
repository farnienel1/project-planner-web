'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePendingNavigation } from '@/lib/navigation/usePendingNavigation'
import { RouteLoading } from '@/components/shell/RouteLoading'
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
import { Chip, IconTile } from '@/components/ui/page'
import { ProfileBack, ProfileBand, ProfileIcon, ProfilePage, SaveState } from '@/components/users/profile-ui'
import { GHOST_UPGRADE_HELP, GHOST_UPGRADE_LABEL, canUpgradeGhost, canViewPersonPay, formatMoney, ghostBadgeLabel, isGhostUser } from '@/lib/canonical'
import { GhostAppAccessCard } from '@/components/users/GhostAppAccessCard'
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
  const { navigate, prefetch, pending: backPending } = usePendingNavigation()
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

  if (loading) return <RouteLoading />

  if (!target) {
    return (
      <ProfilePage>
        <div className="pu-card up-notfound">
          <h3>User not found</h3>
          <p>That profile is not in this organisation.</p>
          <Link href={backHref} className="pu-btn primary">
            Go back
          </Link>
        </div>
      </ProfilePage>
    )
  }

  const canEdit = canShowAdminEditProfile(currentUser)
  const editHref = `/dashboard/users/${target.id}/edit?from=${encodeURIComponent(from)}`
  const name = `${target.firstName} ${target.surname}`.trim() || roleLabel(target)
  const status = rosterStatusLabel(target)
  const quals = linkedOperative?.qualifications || []
  const tradeText = displayTradeType(target.tradeTypePreset, target.tradeTypeCustom)
  const lineManagerText = lineManager ? `${lineManager.firstName} ${lineManager.surname}`.trim() : 'No line manager'
  const rate = payVisible ? profileRateRow(pay, currencyCode) : null

  return (
    <ProfilePage>
      <ProfileBack
        onClick={() => navigate(backHref)}
        onPointerEnter={() => prefetch(backHref)}
        onFocus={() => prefetch(backHref)}
        pending={backPending}
      />

      <ProfileBand
        avatar={<UserAvatar user={target} size={64} className="up-avatar-ring" />}
        eyebrow="User profile"
        name={name}
        chips={[
          { label: roleLabel(target), tone: target.isSuperAdmin ? 'super' : undefined },
          // Rulebook 1.34.0: a ghost shows its "No app login" badge in place of Verified / Pending.
          isGhostUser(target)
            ? { label: ghostBadgeLabel(target), dot: 'slate' }
            : target.passwordSet
              ? { label: 'Verified', dot: 'green' }
              : { label: 'Pending', dot: 'amber', tone: 'warn' },
          { label: status, dot: status === 'Active' ? 'blue' : 'slate' },
        ]}
        aside={
          canEdit ? (
            <Link href={editHref} className="pu-btn white">
              <ProfileIcon name="pencil" />
              Edit profile
            </Link>
          ) : (
            <SaveState tone="view">View only</SaveState>
          )
        }
        stats={[
          // Display only (spec §1): the same values as the Details card, pay behind the same `canViewPersonPay` gate.
          ...(payVisible ? [{ value: employmentLabel(pay?.employmentType), label: 'Employment' }] : []),
          ...(rate ? [{ value: rate.value, label: rate.label }] : []),
          { value: tradeText, label: 'Trade' },
          { value: lineManagerText, label: 'Line manager' },
        ]}
      />

      <div className="up-grid2">
        <section className="pu-card">
          <div className="up-card-h">
            <IconTile tone="blue" size="sm">
              <ProfileIcon name="user" />
            </IconTile>
            <h2>Details</h2>
          </div>
          <dl className="up-dl">
            {/* Rulebook 1.34.0: a ghost has no email, phone or login (an invited ghost shows the invitation email). */}
            {!isGhostUser(target) || target.email ? <SummaryRow label="Email" value={target.email} /> : null}
            {!isGhostUser(target) ? <SummaryRow label="Mobile" value={target.mobileNumber || '—'} /> : null}
            {!isGhostUser(target) ? (
              <SummaryRow
                label="Last active"
                value={target.lastSeenAt ? format(target.lastSeenAt, "d MMM yyyy 'at' HH:mm") : '—'}
              />
            ) : null}
            <SummaryRow label="Trade" value={tradeText} />
            {payVisible ? <SummaryRow label="Employment" value={employmentLabel(pay?.employmentType)} /> : null}
            <SummaryRow label="Line manager" value={lineManagerText} />
            {rate ? <SummaryRow label={rate.label} value={rate.value} /> : null}
          </dl>
        </section>

        {organization?.id && canUpgradeGhost(currentUser as never, target as never) ? (
          <GhostAppAccessCard
            organizationId={organization.id}
            organizationName={organization.name}
            viewer={currentUser!}
            ghost={target}
            title={GHOST_UPGRADE_LABEL}
            help={GHOST_UPGRADE_HELP}
            onDone={() => getUser(userId).then(setTarget)}
            variant="profile"
          />
        ) : null}

        {target.permissions.operativeMode ? (
          <section className="pu-card">
            <div className="up-card-h">
              <IconTile tone="amber" size="sm">
                <ProfileIcon name="badge" />
              </IconTile>
              <h2>Qualifications</h2>
            </div>
            {quals.length === 0 ? (
              <p className="up-empty-text">No qualifications yet.</p>
            ) : (
              <div>
                {quals.map((qual) => (
                  <div key={qual.id} className="up-qrow">
                    <b>{qual.name}</b>
                    <Chip tone={qual.hasEndDate && qual.endDate ? 'amber' : 'slate'}>
                      {qual.hasEndDate && qual.endDate ? `Expires ${format(qual.endDate, 'd MMM yyyy')}` : 'No expiry'}
                    </Chip>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

    </ProfilePage>
  )
}

/**
 * The rate line the profile shows (Details and the band): hourly when the stored basis is hourly with a rate, day when
 * it is day with a rate, else none. Display only — the same test the page used before the restyle.
 */
export function profileRateRow(
  pay: { payBasis?: string; dayRate?: number | null; hourlyRate?: number | null } | null | undefined,
  currencyCode: string
): { label: string; value: string } | null {
  if (pay?.payBasis === 'hourly' && pay.hourlyRate != null) {
    return { label: 'Hourly rate', value: `${formatMoney(Number(pay.hourlyRate), currencyCode)}/hr` }
  }
  if (pay?.payBasis === 'day' && pay.dayRate != null) {
    return { label: 'Day rate', value: `${formatMoney(Number(pay.dayRate), currencyCode)}/day` }
  }
  return null
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
