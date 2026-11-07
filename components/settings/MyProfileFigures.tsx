'use client'

/**
 * Rulebook 1.35.0 §12: My Profile "Your figures" — five figures from `myProfileSummary`, each linking to its screen.
 * Display only: every number comes from the rulebook (`useMyProfileSummary`).
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { canManageUsers } from '@/lib/permissions'
import { daysLabel, formatDayCount } from '@/lib/annualLeave/formatLeaveDays'
import { useMyProfileSummary } from '@/lib/profile/useMyProfileSummary'

function hoursText(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  return `${rounded}h`
}

function FigureRow({
  label,
  value,
  detail,
  href,
  testId,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  href?: string
  testId: string
}) {
  const body = (
    <div className="flex items-start justify-between gap-3 py-2" data-testid={testId}>
      <span className="text-sm text-[var(--ink3)]">{label}</span>
      <span className="text-right">
        <span className="block text-sm font-semibold text-[var(--ink)]">{value}</span>
        {detail ? <span className="block text-xs text-[var(--ink3)]">{detail}</span> : null}
      </span>
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-lg px-1 hover:bg-[var(--surface2,rgba(0,0,0,0.03))]">
      {body}
    </Link>
  ) : (
    <div className="px-1">{body}</div>
  )
}

export function MyProfileFigures() {
  const viewer = useAuthStore((state) => state.user)
  const summary = useMyProfileSummary()
  if (!summary) return null
  const { leave, hoursThisWeek, tasks, qualifications, lineManager } = summary
  const mayOpenProfiles = canManageUsers(viewer)

  const leaveValue = leave.hasAllowance && leave.remaining != null
    ? `${daysLabel(leave.remaining)} left`
    : `Days taken this leave year: ${formatDayCount(leave.usedThisYear)}`
  const leaveDetail = leave.hasAllowance && leave.pending > 0
    ? `after ${daysLabel(leave.pending)} awaiting approval`
    : undefined

  const qualificationsValue = qualifications.total === 0
    ? 'None'
    : [
        qualifications.expired > 0 ? `${qualifications.expired} expired` : '',
        qualifications.expiringSoon > 0 ? `${qualifications.expiringSoon} expiring soon` : '',
      ].filter(Boolean).join(' · ')

  const managersValue: ReactNode = lineManager.ids.length === 0
    ? lineManager.label
    : (
        <span className="flex flex-col items-end">
          {lineManager.ids.map((row) =>
            mayOpenProfiles && row.resolved ? (
              <Link key={row.id} href={`/dashboard/users/${encodeURIComponent(row.id)}?from=users`} className="underline">
                {row.name}
              </Link>
            ) : (
              <span key={row.id}>{row.name}</span>
            )
          )}
        </span>
      )

  return (
    <div className="card pad" data-testid="my-profile-figures">
      <p className="eyebrow" style={{ marginBottom: 8 }}>Your figures</p>
      <FigureRow testId="figure-leave" label="Annual leave this year" value={leaveValue} detail={leaveDetail} href="/dashboard/annual-leave" />
      <FigureRow
        testId="figure-hours"
        label="Hours booked this week"
        value={hoursText(hoursThisWeek.hours)}
        detail="Mon–Sun, unpaid breaks taken off"
        href="/dashboard/my-schedule"
      />
      <FigureRow
        testId="figure-tasks"
        label="Open tasks"
        value={String(tasks.open)}
        detail={`${tasks.overdue} overdue · ${tasks.dueThisWeek} due this week`}
        href="/dashboard/tasks"
      />
      <FigureRow testId="figure-qualifications" label="Qualifications" value={qualificationsValue} href="/dashboard/my-qualifications" />
      <FigureRow
        testId="figure-line-manager"
        label={lineManager.ids.length > 1 ? 'Line managers' : 'Line manager'}
        value={managersValue}
      />
    </div>
  )
}
