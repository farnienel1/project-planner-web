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
import { canEditTargetUser, roleLabel } from '@/lib/staff/userEditPermissions'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { UserAvatar } from '@/components/users/UserAvatar'
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
  const { users, loadUsers } = useOrgUserStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { getUser } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Awaited<ReturnType<typeof getUser>>>(null)

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadOperatives(organization.id)
    getUser(userId)
      .then(setTarget)
      .finally(() => setLoading(false))
  }, [organization?.id, userId, getUser, loadUsers, loadOperatives])

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

  const canEdit = canEditTargetUser(currentUser, target)
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
          {linkedOperative ? (
            <Link href={`/dashboard/operatives/${linkedOperative.id}/edit`} className="btn hbtn">
              View certificates
            </Link>
          ) : null}
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
          <SummaryRow label="Employment" value={employmentLabel(target.employmentType)} />
          <SummaryRow
            label="Line manager"
            value={lineManager ? `${lineManager.firstName} ${lineManager.surname}`.trim() : 'No line manager'}
          />
          {target.dayRate != null ? (
            <SummaryRow label="Day rate" value={`£${Number(target.dayRate).toFixed(2)}`} />
          ) : null}
        </dl>
      </section>

      {target.permissions.operativeMode ? (
        <section className="card pad" data-hue="rep">
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 className="h2">Qualifications</h2>
            <span className="grow" />
            {linkedOperative ? (
              <Link href={`/dashboard/operatives/${linkedOperative.id}/edit`} className="btn sm">
                View certificates
              </Link>
            ) : null}
          </div>
          {quals.length === 0 ? (
            <p className="muted small">No qualifications yet. Add them from Edit when needed.</p>
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
