'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { hasAdminAccess } from '@/lib/permissions'
import { canSeeAnyVariations, canSeeJobVariations } from '@/lib/variations/variationAccess'
import { subscribeOrganisationVariations, subscribeParentVariations } from '@/lib/variations/variationStorage'
import {
  VARIATION_LIST_FILTERS,
  VARIATION_STATUS_COPY,
  variationMatchesListFilter,
  type Variation,
  type VariationListFilter,
} from '@/lib/variations/variationModel'
import type { Project } from '@/types'

export function VariationsRollup() {
  const { user, organization } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { loadUsers } = useOrgUserStore()
  const [rows, setRows] = useState<Variation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<VariationListFilter>('all')

  useEffect(() => {
    if (!organization?.id || !user || !canSeeAnyVariations(user)) return
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadUsers(organization.id)
  }, [organization?.id, user, loadProjects, loadSmallWorks, loadUsers])

  const jobs = [...projects, ...smallWorks]
  const visibleJobs = jobs.filter((job) => canSeeJobVariations(user, job))
  const admin = hasAdminAccess(user)

  useEffect(() => {
    if (!organization?.id || !db || !user || !canSeeAnyVariations(user)) return
    if (admin) {
      return subscribeOrganisationVariations(
        organization.id,
        (next) => {
          setRows(next)
          setError(null)
        },
        () => setError('Variations did not load.')
      )
    }
    const unsubs = visibleJobs.map((job) =>
      subscribeParentVariations(
        organization.id,
        job.id,
        (next) => {
          setRows((current) => {
            const others = current.filter((row) => row.parentId !== job.id)
            return [...others, ...next]
          })
        },
        () => setError('Variations did not load.')
      )
    )
    return () => unsubs.forEach((stop) => stop())
  }, [organization?.id, admin, visibleJobs.map((job) => job.id).join('|'), user])

  if (!canSeeAnyVariations(user)) {
    return (
      <div className="empty card pad">
        <h3>Variations</h3>
        <p>Variations are for admins and managers assigned to a job.</p>
      </div>
    )
  }

  const live = rows.filter(
    (row) =>
      !row.isDeleted &&
      variationMatchesListFilter(row.status, filter) &&
      visibleJobs.some((job) => job.id === row.parentId)
  )
  const counts = {
    all: rows.filter((row) => !row.isDeleted && visibleJobs.some((job) => job.id === row.parentId)).length,
    open: rows.filter((row) => !row.isDeleted && row.status === 'open' && visibleJobs.some((job) => job.id === row.parentId)).length,
    submitted: rows.filter((row) => !row.isDeleted && row.status === 'submitted' && visibleJobs.some((job) => job.id === row.parentId)).length,
    closed: rows.filter((row) => !row.isDeleted && row.status === 'closed' && visibleJobs.some((job) => job.id === row.parentId)).length,
  }
  const groups = new Map<string, { job: Project; rows: Variation[] }>()
  for (const job of visibleJobs) groups.set(job.id, { job, rows: [] })
  for (const row of live) {
    const group = groups.get(row.parentId)
    if (group) group.rows.push(row)
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="phead" data-hue="proj">
        <div>
          <h1>Variations</h1>
          <div className="sub">Projects and small works you can open variations on</div>
        </div>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      <div className="seg" aria-label="Variation status">
        {VARIATION_LIST_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'on' : ''}
            onClick={() => setFilter(item.id)}
          >
            {item.label} {counts[item.id]}
          </button>
        ))}
      </div>
      {filter !== 'all' ? (
        <div className="card pad">
          <p>{VARIATION_STATUS_COPY[filter]}</p>
        </div>
      ) : null}
      {Array.from(groups.values()).filter((group) => filter === 'all' || group.rows.length > 0).length === 0 ? (
        <div className="empty card pad">
          <h3>{filter === 'all' ? 'No jobs' : `No ${filter} variations`}</h3>
          <p>{filter === 'all' ? 'Variations appear here for jobs you can open.' : VARIATION_STATUS_COPY[filter]}</p>
        </div>
      ) : null}
      {Array.from(groups.values())
        .filter((group) => filter === 'all' || group.rows.length > 0)
        .map((group) => {
          const open = group.rows.filter((row) => row.status === 'open').length
          const hrefBase = projects.some((job) => job.id === group.job.id)
            ? `/dashboard/projects/${group.job.id}/variations`
            : `/dashboard/small-works/${group.job.id}/variations`
          return (
            <section key={group.job.id} className="card">
              <div className="card-h">
                <h2 className="h2">{group.job.jobNumber} · {group.job.siteName}</h2>
                <div className="acts">
                  <Link href={hrefBase} className="btn sm ghost">Open</Link>
                </div>
              </div>
              <div className="card-b">
                <p className="muted small">{open} open · {group.rows.length} total</p>
              </div>
            </section>
          )
        })}
    </div>
  )
}
