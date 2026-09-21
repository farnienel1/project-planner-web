'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Cog6ToothIcon } from '@heroicons/react/24/solid'
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
import { PanelHeader, SectionLabel, SettingsCard } from '@/components/settings/primitives'

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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">User not found.</p>
        <Link href={backHref} className="mt-4 inline-block text-blue-600 hover:underline">
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
    <div className="mx-auto max-w-2xl pb-16">
      <PanelHeader
        title={name}
        onBack={() => router.push(backHref)}
        rightAction={
          canEdit ? (
            <Link
              href={editHref}
              aria-label="Edit profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              View only
            </span>
          )
        }
      />

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <UserAvatar user={target} size={64} className="rounded-2xl" gradient="from-[#7F77DD] to-[#534AB7]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-900">{name}</div>
          <div className="text-sm text-slate-500">{roleLabel(target)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                target.passwordSet
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                  : 'bg-amber-50 text-amber-700 ring-amber-100'
              }`}
            >
              {target.passwordSet ? 'Verified' : 'Pending'}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                status === 'Active' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              {status}
            </span>
          </div>
        </div>
      </div>

      <SectionLabel label="Details" />
      <SettingsCard>
        <dl className="divide-y divide-slate-100">
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
      </SettingsCard>

      {target.permissions.operativeMode ? (
        <>
          <SectionLabel label="Qualifications" />
          <SettingsCard>
            {quals.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                No qualifications yet. Add them from Edit when needed.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {quals.map((qual) => (
                  <li key={qual.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm font-medium text-slate-900">{qual.name}</span>
                    <span className="text-xs text-slate-500">
                      {qual.hasEndDate && qual.endDate ? `Expires ${format(qual.endDate, 'd MMM yyyy')}` : 'No expiry'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {linkedOperative ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <Link
                  href={`/dashboard/operatives/${linkedOperative.id}/edit`}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  View certificates
                </Link>
              </div>
            ) : null}
          </SettingsCard>
        </>
      ) : null}

      {canEdit ? (
        <div className="mt-6">
          <Link
            href={editHref}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            Edit profile
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}
