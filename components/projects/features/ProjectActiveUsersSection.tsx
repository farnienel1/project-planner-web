/**
 * iOS parity source: Views/ProjectActiveOperativesView.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserGroupIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { hasAdminAccess } from '@/lib/permissions'
import { loadSubcontractorBookings } from '@/lib/weekly-report/loadSubcontractorBookings'
import {
  DEFAULT_PAYROLL_POLICY,
  loadOrganizationDetails,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import {
  activeUserDayRows,
  buildProjectActiveUsers,
  canViewProjectActiveUsers,
  countProjectActiveUsers,
  formatActiveUserHours,
  type ActiveUserKind,
  type ActiveUserSummary,
} from '@/lib/projects/activeUsers'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import type { Project } from '@/types'
import { EmptyState } from '@/components/ios/primitives'

function formatRangeDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatCompleteDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function tint(kind: ActiveUserKind): string {
  if (kind === 'staff') return 'var(--user, #6d28d9)'
  if (kind === 'subcontractor') return 'var(--sw, #c2410c)'
  return 'var(--blue)'
}

export function useActiveUserBadge(project: Project, enabled: boolean): number | undefined {
  const data = useProjectActiveUserData(project, enabled)
  if (!enabled || data.loading) return undefined
  return data.count
}

function useProjectActiveUserData(project: Project, enabled: boolean) {
  const { organization, user } = useAuthStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, managers, loadOperatives, loadManagers } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const [subBookings, setSubBookings] = useState<SubcontractorBookingRow[]>([])
  const [payroll, setPayroll] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled || !organization?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const orgId = organization.id
    Promise.all([
      loadBookings(orgId),
      loadManagerSiteBookings(orgId),
      loadOperatives(orgId),
      loadManagers(orgId),
      loadUsers(orgId),
      loadSubcontractors(orgId),
      loadSubcontractorBookings(orgId).then((rows) => {
        if (!cancelled) setSubBookings(rows)
      }),
      loadOrganizationDetails(orgId).then((details) => {
        if (!cancelled && details?.payrollTimePolicy) setPayroll(details.payrollTimePolicy)
      }),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    enabled,
    organization?.id,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadManagers,
    loadUsers,
    loadSubcontractors,
  ])

  const allowed = canViewProjectActiveUsers(user, managers, project)
  const input = useMemo(
    () => ({
      projectId: project.id,
      operativeBookings: bookings,
      operatives,
      managerBookings: managerSiteBookings,
      users,
      subcontractorBookings: subBookings,
      subcontractors,
      payrollPolicy: payroll,
    }),
    [project.id, bookings, operatives, managerSiteBookings, users, subBookings, subcontractors, payroll]
  )

  const summaries = useMemo(() => (enabled ? buildProjectActiveUsers(input) : []), [enabled, input])
  const count = useMemo(
    () =>
      enabled
        ? countProjectActiveUsers({
            projectId: project.id,
            operativeBookings: bookings,
            managerBookings: managerSiteBookings,
            subcontractorBookings: subBookings,
          })
        : 0,
    [enabled, project.id, bookings, managerSiteBookings, subBookings]
  )

  return { loading, allowed, summaries, count, input, user, managers }
}

export function ProjectActiveUsersSection({ project, basePath }: { project: Project; basePath: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const personId = searchParams.get('person')
  const { organization, user } = useAuthStore()
  const { managers, loadManagers } = useOperativeStore()
  const [rosterReady, setRosterReady] = useState(() => hasAdminAccess(user))

  useEffect(() => {
    if (!organization?.id || hasAdminAccess(user) || !user?.permissions.manager) {
      setRosterReady(true)
      return
    }
    let cancelled = false
    loadManagers(organization.id).finally(() => {
      if (!cancelled) setRosterReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [organization?.id, user, loadManagers])

  const allowed = rosterReady && canViewProjectActiveUsers(user, managers, project)
  const data = useProjectActiveUserData(project, allowed)

  if (!rosterReady || (allowed && data.loading && data.summaries.length === 0)) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-[var(--ink3)]">Loading active users...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <EmptyState
        icon={<UserGroupIcon className="h-12 w-12" />}
        title="Active users"
        subtitle="This list is for admins, and for managers assigned to this job."
      />
    )
  }

  const selected = personId ? data.summaries.find((row) => row.id === personId) : null
  if (personId && selected) {
    return (
      <PersonHistory
        project={project}
        summary={selected}
        rows={activeUserDayRows(selected.id, data.input)}
        onBack={() => router.push(`${basePath}/active-users`)}
      />
    )
  }

  const countLabel =
    data.summaries.length === 1
      ? '1 user previously booked on this job'
      : `${data.summaries.length} users previously booked on this job`

  return (
    <div className="stack">
      <section className="card pad">
        <p className="text-[13px] font-bold text-[var(--blue)]">{project.jobNumber}</p>
        <h2 className="h2" style={{ marginTop: 4 }}>
          {project.siteName}
        </h2>
        <p className="muted" style={{ marginTop: 6 }}>
          {countLabel}
        </p>
      </section>

      {data.summaries.length === 0 ? (
        <EmptyState
          icon={<UserGroupIcon className="h-12 w-12" />}
          title="No booking history"
          subtitle={`Operatives, staff and subcontractors booked onto ${project.siteName} will appear here.`}
        />
      ) : (
        <div className="stack">
          {data.summaries.map((summary) => (
            <button
              key={summary.id}
              type="button"
              className="card pad"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => router.push(`${basePath}/active-users?person=${encodeURIComponent(summary.id)}`)}
            >
              <PersonRow summary={summary} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonRow({ summary }: { summary: ActiveUserSummary }) {
  return (
    <span className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <span
        className="ico-chip"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          color: tint(summary.kind),
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {summary.initials}
      </span>
      <span className="grow">
        <span className="t" style={{ display: 'block', fontWeight: 650 }}>
          {summary.displayName}
        </span>
        <span className="s" style={{ display: 'block' }}>
          {summary.subtitle}
        </span>
        <span className="muted small" style={{ display: 'block', marginTop: 2 }}>
          {summary.bookingCount} day{summary.bookingCount === 1 ? '' : 's'} · {formatActiveUserHours(summary.totalHours)}h
        </span>
        <span className="muted small" style={{ display: 'block' }}>
          {formatRangeDay(summary.firstDate)} – {formatRangeDay(summary.lastDate)}
        </span>
      </span>
    </span>
  )
}

function PersonHistory({
  project,
  summary,
  rows,
  onBack,
}: {
  project: Project
  summary: ActiveUserSummary
  rows: ReturnType<typeof activeUserDayRows>
  onBack: () => void
}) {
  const total = rows.reduce((sum, row) => sum + row.hours, 0)
  return (
    <div className="stack">
      <div>
        <button type="button" className="btn sm ghost" onClick={onBack}>
          ← Active users
        </button>
      </div>
      <h2 className="h2">{summary.displayName}</h2>
      <section className="card pad stack" style={{ gap: 10 }}>
        <div className="row">
          <span>Total hours</span>
          <span className="grow" />
          <b>{formatActiveUserHours(total)}h</b>
        </div>
        <div className="row">
          <span>Days booked</span>
          <span className="grow" />
          <b>{rows.length}</b>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span>Job</span>
          <span className="grow" />
          <span className="muted small" style={{ textAlign: 'right' }}>
            {project.jobNumber} · {project.siteName}
          </span>
        </div>
      </section>
      <section className="card">
        <div className="card-h">
          <h3 className="h2">Day by day</h3>
        </div>
        <div className="card-b stack">
          {rows.length === 0 ? (
            <p className="muted">No bookings recorded.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id}>
                <p style={{ fontWeight: 650 }}>{formatCompleteDay(row.date)}</p>
                <p className="muted small">{row.scheduleLabel}</p>
                <p className="small" style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  {formatActiveUserHours(row.hours)}h
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
